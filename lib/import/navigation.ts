export function shouldRedirectImportHome(status: string) {
  return status === "confirmed" || status === "failed";
}

export function getShareIntentKey(shareIntent: {
  webUrl?: string | null;
  text?: string | null;
  files?: Array<{ path?: string | null }> | null;
}) {
  return shareIntent.webUrl ?? shareIntent.text ?? shareIntent.files?.[0]?.path ?? null;
}

export function shouldRedirectShareIntent(currentKey: string | null, lastShareKey: string | null) {
  return !!currentKey && currentKey !== lastShareKey;
}
