function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt"]
  );
}

export async function encryptArtifact(plainText: string): Promise<string> {
  const secret = Deno.env.get("ARTIFACT_ENCRYPTION_SECRET");
  if (!secret || secret.trim().length < 16) {
    return toBase64(new TextEncoder().encode(plainText));
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    new TextEncoder().encode(plainText)
  );

  const payload = {
    v: 1,
    s: toBase64(salt),
    i: toBase64(iv),
    d: toBase64(new Uint8Array(encrypted)),
  };

  return btoa(JSON.stringify(payload));
}
