// Pure geometry for dragging recipes onto planner days. Kept free of React
// Native imports so it runs under `node --test`. The gesture lives in
// ./useRecipeDrag.ts.

/** A drop zone in page coordinates, as measured when the drag started. */
export type DropTarget = {
  dayKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** The day under the finger, or null when it is over none of them. */
export function findDropTarget(targets: DropTarget[], x: number, y: number): string | null {
  const hit = targets.find(
    (target) =>
      x >= target.x && x <= target.x + target.width && y >= target.y && y <= target.y + target.height
  );
  return hit ? hit.dayKey : null;
}

const AUTO_SCROLL_EDGE = 90;
const AUTO_SCROLL_MAX_SPEED = 900;

/**
 * Scroll speed in points per second while the finger rests near the top
 * (negative) or bottom (positive) edge of the list; faster the closer it gets.
 */
export function getAutoScrollSpeed(y: number, top: number, bottom: number): number {
  if (y < top + AUTO_SCROLL_EDGE) {
    return -AUTO_SCROLL_MAX_SPEED * Math.min(1, (top + AUTO_SCROLL_EDGE - y) / AUTO_SCROLL_EDGE);
  }
  if (y > bottom - AUTO_SCROLL_EDGE) {
    return AUTO_SCROLL_MAX_SPEED * Math.min(1, (y - (bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE);
  }
  return 0;
}
