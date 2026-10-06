// Sharing a post to Wasfa opens the app with a link that carries the shared
// content and is not a screen. The root layout reads the share and opens the
// import itself, so the router must not treat the link as a route: it would land
// on the "not found" screen and leave it stacked over the tabs.
const SHARE_LINK_MARKER = "dataUrl=";

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (!path.includes(SHARE_LINK_MARKER)) return path;
  // On a cold start the app opens normally; while it is running an empty path
  // means "stay where you are".
  return initial ? "/" : "";
}
