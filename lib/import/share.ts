export type ParsedImportLink = {
  sourceUrl?: string;
  sharedText?: string;
  shareId?: string;
};

export function parseImportDeepLink(inputUrl: string): ParsedImportLink | null {
  try {
    const url = new URL(inputUrl);
    const normalizedPath = url.pathname.replace(/^\/+/, "");
    if (url.protocol !== "mealplanner:" || normalizedPath !== "import") {
      return null;
    }
    return {
      sourceUrl: url.searchParams.get("url") ?? undefined,
      sharedText: url.searchParams.get("text") ?? undefined,
      shareId: url.searchParams.get("share_id") ?? undefined,
    };
  } catch {
    return null;
  }
}
