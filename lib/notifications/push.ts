import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { api } from "@/convex/_generated/api";
import { getCurrentUserId } from "@/lib/auth/session";
import { convex } from "@/lib/convex/client";
import type { AppLanguage } from "@/lib/i18n/translations";

import { Notifications, getNotificationPermission } from "./native";

// The token the server holds for this phone, kept so signing out can withdraw it.
const PUSH_TOKEN_KEY = "@wasfa/push_token";
const UNREGISTER_TIMEOUT_MS = 3000;

const projectId: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

// The user and language the server was last told about, so opening the app again asks nothing.
let registeredFor: string | null = null;

/**
 * Registers this phone to be told when the signed-in user's imports finish, in the
 * given language. Does nothing until the user has allowed notifications.
 */
export async function registerDeviceForPush(language: AppLanguage): Promise<void> {
  const userId = getCurrentUserId();
  if (!Notifications || !projectId || !userId) return;
  const registration = `${userId}:${language}`;
  if (registeredFor === registration) return;
  if ((await getNotificationPermission()) !== "granted") return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await convex.mutation(api.notifications.registerDevice, {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      language,
    });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    registeredFor = registration;
  } catch {
    // No token while offline or on a simulator without push; the next time the app opens tries again.
  }
}

/**
 * Stops import results reaching this phone. Called while the user is still signed in,
 * just before signing out, and never holds the sign-out up for long.
 */
export async function unregisterDeviceForPush(): Promise<void> {
  registeredFor = null;
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) return;
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    await Promise.race([
      convex.mutation(api.notifications.unregisterDevice, { token }),
      new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
    ]);
  } catch {
    // The phone is handed to the next user who signs in on it.
  }
}
