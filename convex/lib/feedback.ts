/** Keep public board posts short and readable before storing them. */
export function normalizeFeedback(title: string, detail: string): { title: string; detail: string } {
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  const normalizedDetail = detail.trim().replace(/\s+/g, " ");
  if (!normalizedTitle || normalizedTitle.length > 100) {
    throw new Error("Title must be 1–100 characters.");
  }
  if (!normalizedDetail || normalizedDetail.length > 1000) {
    throw new Error("Details must be 1–1000 characters.");
  }
  return { title: normalizedTitle, detail: normalizedDetail };
}
