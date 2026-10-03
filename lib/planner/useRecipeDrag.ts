import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type View,
} from "react-native";
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { findDropTarget, getAutoScrollSpeed, type DropTarget } from "./drag";

/** `fromDayKey` is null when the recipe comes from the library rather than a day. */
export type DraggedRecipe = {
  recipeId: string;
  fromDayKey: string | null;
};

type DragSession = {
  item: DraggedRecipe;
  /** True once the root view owns the touch, i.e. the finger has moved. */
  claimed: boolean;
  targets: DropTarget[];
  scrollStart: number;
  root: { x: number; y: number; width: number; height: number };
  pointer: { x: number; y: number };
  hover: string | null;
  frame: number | null;
  lastFrameTime: number | null;
};

type RecipeDragOptions = {
  onDrop: (item: DraggedRecipe, dayKey: string) => void;
  /** Screen edges the list is hidden behind (status bar, floating tab bar). */
  edgeTop: number;
  edgeBottom: number;
};

/**
 * Long-press drag of a recipe onto a planner day, built on the core responder
 * system so it needs no native gesture module. A row starts the drag from its
 * `onLongPress`; the root view then takes the touch over on the first move,
 * and the list scrolls itself while the finger rests near an edge.
 */
export function useRecipeDrag({ onDrop, edgeTop, edgeBottom }: RecipeDragOptions) {
  const [dragged, setDragged] = useState<DraggedRecipe | null>(null);
  const [hoverDayKey, setHoverDayKey] = useState<string | null>(null);

  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const session = useRef<DragSession | null>(null);
  const scroll = useRef({ y: 0, viewport: 0, content: 0 });
  const targetNodes = useRef(new Map<string, { dayKey: string; node: View }>());
  const targetCallbacks = useRef(new Map<string, (node: View | null) => void>());

  const latest = useRef({ onDrop, edgeTop, edgeBottom });
  latest.current = { onDrop, edgeTop, edgeBottom };

  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostLift = useSharedValue(0);

  const updateHover = useCallback((current: DragSession) => {
    // Targets were measured at `scrollStart`; undo the scrolling done since.
    const hit = findDropTarget(
      current.targets,
      current.pointer.x,
      current.pointer.y + scroll.current.y - current.scrollStart
    );
    const hover = hit === current.item.fromDayKey ? null : hit;
    if (hover === current.hover) return;
    current.hover = hover;
    setHoverDayKey(hover);
  }, []);

  const placeGhost = useCallback(
    (current: DragSession) => {
      ghostX.value = current.pointer.x - current.root.x - current.root.width / 2;
      ghostY.value = current.pointer.y - current.root.y;
    },
    [ghostX, ghostY]
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      const current = session.current;
      if (!current) return;
      session.current = null;
      if (current.frame !== null) cancelAnimationFrame(current.frame);
      ghostLift.value = 0;
      setDragged(null);
      setHoverDayKey(null);
      if (commit && current.hover) latest.current.onDrop(current.item, current.hover);
    },
    [ghostLift]
  );

  const startDrag = useCallback(
    (item: DraggedRecipe, event: GestureResponderEvent) => {
      if (session.current) return;
      const window = Dimensions.get("window");
      const current: DragSession = {
        item,
        claimed: false,
        targets: [],
        scrollStart: scroll.current.y,
        root: { x: 0, y: 0, width: window.width, height: window.height },
        pointer: { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY },
        hover: null,
        frame: null,
        lastFrameTime: null,
      };
      session.current = current;

      rootRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
        if (session.current !== current) return;
        current.root = { x: pageX, y: pageY, width, height };
        placeGhost(current);
      });
      targetNodes.current.forEach(({ dayKey, node }) => {
        node.measure((_x, _y, width, height, pageX, pageY) => {
          if (session.current !== current) return;
          current.targets.push({ dayKey, x: pageX, y: pageY, width, height });
        });
      });

      const tick = (time: number) => {
        if (session.current !== current) return;
        const elapsed =
          current.lastFrameTime === null ? 0 : Math.min(0.05, (time - current.lastFrameTime) / 1000);
        current.lastFrameTime = time;

        const top = current.root.y + latest.current.edgeTop;
        const bottom = current.root.y + current.root.height - latest.current.edgeBottom;
        const speed = current.claimed ? getAutoScrollSpeed(current.pointer.y, top, bottom) : 0;
        if (speed !== 0) {
          const maxScroll = Math.max(0, scroll.current.content - scroll.current.viewport);
          const next = Math.min(maxScroll, Math.max(0, scroll.current.y + speed * elapsed));
          if (next !== scroll.current.y) {
            scroll.current.y = next;
            scrollRef.current?.scrollTo({ y: next, animated: false });
            updateHover(current);
          }
        }
        current.frame = requestAnimationFrame(tick);
      };
      current.frame = requestAnimationFrame(tick);

      placeGhost(current);
      ghostLift.value = withSpring(1, { damping: 16, stiffness: 260 });
      setDragged(item);
    },
    [ghostLift, placeGhost, updateHover]
  );

  /**
   * For the dragged row's `onPressOut`: ends a drag whose finger lifted before
   * moving. The row also gets a press-out when the root view takes the touch
   * over, so the check waits for that hand-off to settle.
   */
  const releaseIfUnclaimed = useCallback(() => {
    const current = session.current;
    if (!current) return;
    setTimeout(() => {
      if (session.current === current && !current.claimed) endDrag(false);
    }, 0);
  }, [endDrag]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: () => session.current !== null,
        onPanResponderGrant: () => {
          if (session.current) session.current.claimed = true;
        },
        onPanResponderMove: (_event, gesture) => {
          const current = session.current;
          if (!current) return;
          current.pointer = { x: gesture.moveX, y: gesture.moveY };
          placeGhost(current);
          updateHover(current);
        },
        onPanResponderRelease: () => endDrag(true),
        onPanResponderTerminate: () => endDrag(false),
        onPanResponderTerminationRequest: () => false,
      }),
    [endDrag, placeGhost, updateHover]
  );

  useEffect(
    () => () => {
      if (session.current?.frame != null) cancelAnimationFrame(session.current.frame);
      session.current = null;
    },
    []
  );

  /** Ref callback that makes a view a drop zone for `dayKey`; `id` must be unique per zone. */
  const registerTarget = useCallback((id: string, dayKey: string) => {
    let callback = targetCallbacks.current.get(id);
    if (!callback) {
      callback = (node: View | null) => {
        if (node) targetNodes.current.set(id, { dayKey, node });
        else targetNodes.current.delete(id);
      };
      targetCallbacks.current.set(id, callback);
    }
    return callback;
  }, []);

  const scrollProps = useMemo(
    () => ({
      scrollEventThrottle: 16,
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        // While dragging, the auto-scroll loop owns the offset.
        if (!session.current) scroll.current.y = event.nativeEvent.contentOffset.y;
      },
      onLayout: (event: LayoutChangeEvent) => {
        scroll.current.viewport = event.nativeEvent.layout.height;
      },
      onContentSizeChange: (_width: number, height: number) => {
        scroll.current.content = height;
      },
    }),
    []
  );

  // Moves a full-width overlay so that its top centre sits under the finger.
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: ghostLift.value,
    transform: [
      { translateX: ghostX.value },
      { translateY: ghostY.value },
      { scale: 0.9 + ghostLift.value * 0.1 },
    ],
  }));

  return {
    dragged,
    hoverDayKey,
    rootRef,
    scrollRef,
    panHandlers: panResponder.panHandlers,
    scrollProps,
    registerTarget,
    startDrag,
    releaseIfUnclaimed,
    ghostStyle,
  };
}
