import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

/** The screen colour of the opening video, kept behind it and through the hand-off. */
export const SPLASH_BACKGROUND = "#FCF9F2";

// Made from the design export by scripts/crop-splash-video.swift.
const SPLASH_VIDEO = require("../../assets/videos/wasfa-splash-gather.mp4");
// The video runs 3.4s; if it has not finished by now the splash stops waiting for it.
const VIDEO_TIMEOUT_MS = 5000;

type SplashGatherProps = {
  /** True once the app knows where to go next; the splash never ends before this. */
  ready: boolean;
  /** False when the splash already played this launch: leave as soon as `ready`. */
  animate?: boolean;
  /** Called once, when the splash should hand off to the app. */
  onDone: () => void;
};

/**
 * The app's opening screen: the "Wasfa Splash Gather" video, in which the
 * ingredients gather, the spoon stirs them and the wordmark rises around it.
 * It starts and ends on the bare background, so the hand-off is a plain cut.
 */
export function SplashGather({ ready, animate = true, onDone }: SplashGatherProps) {
  const [played, setPlayed] = useState(!animate);
  const finished = useRef(false);

  const player = useVideoPlayer(animate ? SPLASH_VIDEO : null, (video) => {
    video.muted = true;
    video.play();
  });

  useEventListener(player, "playToEnd", () => setPlayed(true));

  useEffect(() => {
    if (played) return;

    const timer = setTimeout(() => setPlayed(true), VIDEO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [played]);

  useEffect(() => {
    if (!ready || !played || finished.current) return;

    finished.current = true;
    onDone();
  }, [onDone, played, ready]);

  return (
    <View style={styles.screen}>
      {animate ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
  },
});
