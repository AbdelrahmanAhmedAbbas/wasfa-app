import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { track } from "@/lib/analytics/posthog";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { announceFinishedImport, isWatchedImportJob } from "@/lib/notifications/importEvents";
import { Notifications, prepareNotificationChannels } from "@/lib/notifications/native";
import { cancelDailyReminders } from "@/lib/notifications/reminders";
import { syncNotifications } from "@/lib/notifications/sync";
import {
  DAILY_REMINDER_TYPE,
  getFinishedImportJobId,
  getNotificationTarget,
  type NotificationTarget,
} from "@/lib/notifications/targets";

// While the app is open a notification only appears when it tells the user something
// the screen does not: a reminder to open the app never does, and an import's result
// does not while its own progress screen is showing.
Notifications?.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const jobId = getFinishedImportJobId(data);
    const show = data?.type !== DAILY_REMINDER_TYPE && !(jobId && isWatchedImportJob(jobId));
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

/**
 * Keeps the phone's notifications in step with the signed-in user and opens the right
 * screen when one is tapped. Rendered once, inside the root layout; shows nothing.
 */
export function AppNotifications() {
  const { language, t } = useLanguage();
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const userId = user?.id ?? null;
  const [target, setTarget] = useState<NotificationTarget | null>(null);

  useEffect(() => {
    if (!Notifications) return;
    const module = Notifications;

    const received = module.addNotificationReceivedListener((notification) => {
      if (getFinishedImportJobId(notification.request.content.data)) announceFinishedImport();
    });
    const opened = (data: Record<string, unknown> | undefined) => {
      track("notification_opened", { type: typeof data?.type === "string" ? data.type : null });
      setTarget(getNotificationTarget(data));
    };
    const tapped = module.addNotificationResponseReceivedListener((response) => {
      opened(response.notification.request.content.data);
      module.clearLastNotificationResponse();
    });
    // The tap that opened the app, which arrived before anything was listening. It is
    // cleared once read so a restart (changing language, an update) does not replay it.
    void module
      .getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        opened(response.notification.request.content.data);
        module.clearLastNotificationResponse();
      })
      .catch(() => {});

    return () => {
      received.remove();
      tapped.remove();
    };
  }, []);

  const importsChannel = t("notificationsChannelImports");
  const remindersChannel = t("notificationsChannelReminders");

  // Each time the app is opened: the phone is registered if it is not yet, and the
  // reminders start again from tomorrow.
  useEffect(() => {
    if (!userId) return;
    const sync = () => {
      void prepareNotificationChannels({ imports: importsChannel, reminders: remindersChannel }).then(() =>
        syncNotifications(language)
      );
    };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      sync();
      // An import that finished while the app was in the background left its
      // notification waiting, and the library on screen has not heard of the recipe.
      void Notifications?.getPresentedNotificationsAsync()
        .then((waiting) => {
          if (waiting.some((notification) => getFinishedImportJobId(notification.request.content.data))) {
            announceFinishedImport();
          }
        })
        .catch(() => {});
    });
    return () => subscription.remove();
  }, [userId, language, importsChannel, remindersChannel]);

  useEffect(() => {
    if (loading || userId) return;
    void cancelDailyReminders();
    setTarget(null);
  }, [loading, userId]);

  // The tabs sit under every signed-in screen. On a launch from a notification they
  // are not open yet, so the tap waits for them.
  const screenGroup: string | undefined = segments[0];
  useEffect(() => {
    if (!target || loading || !userId) return;
    if (screenGroup !== "(tabs)" && screenGroup !== "recipe" && screenGroup !== "import") return;
    setTarget(null);

    // An import's progress screen returns to the tabs by itself when it finishes, and
    // would take a recipe opened on top of it along.
    if (screenGroup === "import") router.dismissTo("/(tabs)");

    if (target.kind === "recipe") {
      router.push({ pathname: "/recipe/[id]", params: { id: target.recipeId } });
    } else if (target.kind === "planner") {
      router.navigate("/(tabs)/planner");
    } else if (screenGroup !== "import") {
      router.dismissTo("/(tabs)");
    }
  }, [target, loading, userId, screenGroup, router]);

  return null;
}
