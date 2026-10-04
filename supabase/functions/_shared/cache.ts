const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set([
  "fbclid",
  "feature",
  "gclid",
  "igsh",
  "lang",
  "share_item_id",
  "si",
]);

function normalizeSocialHost(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host === "instagr.am" || host.endsWith("instagram.com")) return "instagram.com";
  if (host.endsWith("tiktok.com")) return "tiktok.com";
  return host.replace(/^www\./, "").replace(/^m\./, "");
}

function shouldStripParam(name: string): boolean {
  const normalized = name.toLowerCase();
  return TRACKING_PARAMS.has(normalized) || TRACKING_PARAM_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function normalizeSourceUrlForCache(sourceUrl: string): string {
  const parsed = new URL(sourceUrl.trim());
  parsed.protocol = "https:";
  parsed.hostname = normalizeSocialHost(parsed.hostname);
  parsed.hash = "";

  // An Instagram or TikTok post is named by its path alone. Its query only says who
  // shared it (Instagram adds a new "stkn" on every share), so keeping it would give
  // each share of one reel its own cache entry.
  if (parsed.hostname === "instagram.com" || parsed.hostname === "tiktok.com") {
    parsed.search = "";
  }

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (shouldStripParam(key)) parsed.searchParams.delete(key);
  }

  parsed.searchParams.sort();
  const query = parsed.searchParams.toString();
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.hostname}${path}${query ? `?${query}` : ""}`;
}
