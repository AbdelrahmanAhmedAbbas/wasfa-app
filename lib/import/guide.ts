import type { TranslationKey } from "@/lib/i18n/translations";

export type ImportGuidePlatform = "tiktok" | "instagram" | "youtube";

/** What a slide's picture shows: the video, the app's own share panel, the phone's share sheet, the result. */
export type ImportGuideScene = "video" | "sharePanel" | "systemSheet" | "recipe";

export type ImportGuideSlide = {
  scene: ImportGuideScene;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
};

/** The phone's own share sheet differs: an iPhone hides apps it has not been told to show. */
export type ImportGuideOS = "ios" | "android";

const PICK_WASFA_BODY: Record<ImportGuideOS, TranslationKey> = {
  ios: "importGuidePickWasfaBodyIos",
  android: "importGuidePickWasfaBodyAndroid",
};

// All three apps keep the phone's share sheet behind a button in their own share
// panel, so every guide has the same four scenes and only the wording changes.
const GUIDE_SLIDES: Record<ImportGuidePlatform, ImportGuideSlide[]> = {
  tiktok: [
    { scene: "video", titleKey: "importGuideTiktokShareTitle", bodyKey: "importGuideTiktokShareBody" },
    { scene: "sharePanel", titleKey: "importGuideTiktokMoreTitle", bodyKey: "importGuideTiktokMoreBody" },
    { scene: "systemSheet", titleKey: "importGuidePickWasfaTitle", bodyKey: "importGuidePickWasfaBodyIos" },
    { scene: "recipe", titleKey: "importGuideDoneTitle", bodyKey: "importGuideDoneBody" },
  ],
  instagram: [
    { scene: "video", titleKey: "importGuideInstagramShareTitle", bodyKey: "importGuideInstagramShareBody" },
    { scene: "sharePanel", titleKey: "importGuideInstagramMoreTitle", bodyKey: "importGuideInstagramMoreBody" },
    { scene: "systemSheet", titleKey: "importGuidePickWasfaTitle", bodyKey: "importGuidePickWasfaBodyIos" },
    { scene: "recipe", titleKey: "importGuideDoneTitle", bodyKey: "importGuideDoneBody" },
  ],
  youtube: [
    { scene: "video", titleKey: "importGuideYoutubeShareTitle", bodyKey: "importGuideYoutubeShareBody" },
    { scene: "sharePanel", titleKey: "importGuideYoutubeMoreTitle", bodyKey: "importGuideYoutubeMoreBody" },
    { scene: "systemSheet", titleKey: "importGuidePickWasfaTitle", bodyKey: "importGuidePickWasfaBodyIos" },
    { scene: "recipe", titleKey: "importGuideDoneTitle", bodyKey: "importGuideDoneBody" },
  ],
};

export function getImportGuideSlides(platform: ImportGuidePlatform, os: ImportGuideOS): ImportGuideSlide[] {
  return GUIDE_SLIDES[platform].map((slide) =>
    slide.scene === "systemSheet" ? { ...slide, bodyKey: PICK_WASFA_BODY[os] } : slide
  );
}

// Web addresses rather than app schemes: the phone opens the app when it is installed
// and the site when it is not, with nothing to declare in the native build.
const PLATFORM_LINKS: Record<ImportGuidePlatform, string> = {
  tiktok: "https://www.tiktok.com/",
  instagram: "https://www.instagram.com/reels/",
  youtube: "https://www.youtube.com/shorts/",
};

export function getImportGuidePlatformLink(platform: ImportGuidePlatform): string {
  return PLATFORM_LINKS[platform];
}

/** A drag shorter than this is a tap or a wobble, not a swipe. */
export const GUIDE_SWIPE_DISTANCE = 44;

/**
 * The slide a sideways swipe leads to. Pages turn the way the language reads: in
 * English dragging left brings the next slide, in Arabic dragging right does.
 */
export function getGuideSlideAfterSwipe(swipe: {
  /** How far the finger moved: negative to the left, positive to the right. */
  dx: number;
  isRTL: boolean;
  index: number;
  total: number;
}): number {
  if (Math.abs(swipe.dx) < GUIDE_SWIPE_DISTANCE) return swipe.index;
  const draggedLeft = swipe.dx < 0;
  const forward = draggedLeft !== swipe.isRTL;
  const target = swipe.index + (forward ? 1 : -1);
  return Math.min(Math.max(target, 0), Math.max(swipe.total - 1, 0));
}
