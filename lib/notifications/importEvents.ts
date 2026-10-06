// What the open app knows about imports that the notifications need: which import is
// on screen, and who wants to hear that one has finished.

let watchedJobId: string | null = null;

/** The import whose progress screen is open, or null when none is. */
export function setWatchedImportJob(jobId: string | null): void {
  watchedJobId = jobId;
}

/** True while this import's progress screen is open, where its result shows without a notification. */
export function isWatchedImportJob(jobId: string): boolean {
  return watchedJobId === jobId;
}

const finishedListeners = new Set<() => void>();

/** Calls `listener` when an import finishes while the app is open. Returns the unsubscribe. */
export function subscribeToFinishedImports(listener: () => void): () => void {
  finishedListeners.add(listener);
  return () => {
    finishedListeners.delete(listener);
  };
}

export function announceFinishedImport(): void {
  finishedListeners.forEach((listener) => listener());
}
