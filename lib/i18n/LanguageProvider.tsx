import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState, NativeModules, Platform } from "react-native";

import { AppLanguage, isLanguageRTL, t as translate } from "@/lib/i18n/translations";

type LanguageContextValue = {
  language: AppLanguage;
  isRTL: boolean;
  t: (key: Parameters<typeof translate>[1]) => string;
  setLanguage: (next: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectDeviceLanguage(): AppLanguage {
  const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  if (intlLocale) {
    const normalized = intlLocale.toLowerCase();
    return normalized.startsWith("ar") ? "ar" : "en";
  }

  if (Platform.OS === "ios") {
    const iosLocale =
      NativeModules.SettingsManager?.settings?.AppleLocale ||
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
    const normalized = String(iosLocale || "").toLowerCase();
    return normalized.startsWith("ar") ? "ar" : "en";
  }

  if (Platform.OS === "android") {
    const androidLocale = NativeModules.I18nManager?.localeIdentifier;
    const normalized = String(androidLocale || "").toLowerCase();
    return normalized.startsWith("ar") ? "ar" : "en";
  }

  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setLanguageState(detectDeviceLanguage());
    setIsReady(true);

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setLanguageState(detectDeviceLanguage());
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isRTL: isLanguageRTL(language),
      t: (key) => translate(language, key),
      // Language is controlled by device settings on iOS/Android.
      setLanguage: async () => Promise.resolve(),
    }),
    [language]
  );

  if (!isReady) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
