import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import { track } from "@/lib/analytics/posthog";
import { AppLanguage, isLanguageRTL, t as translate } from "@/lib/i18n/translations";

type LanguageContextValue = {
  language: AppLanguage;
  isRTL: boolean;
  t: (key: Parameters<typeof translate>[1]) => string;
  setLanguage: (next: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectDeviceLanguage(): AppLanguage {
  const locales = Localization.getLocales();
  if (locales.length > 0 && locales[0]?.languageCode) {
    const code = locales[0].languageCode.toLowerCase();
    return code.startsWith("ar") ? "ar" : "en";
  }
  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem("@wasfa/language");
        if (saved === "en" || saved === "ar") {
          setLanguageState(saved);
        } else {
          setLanguageState(detectDeviceLanguage());
        }
      } catch {
        setLanguageState(detectDeviceLanguage());
      }
      setIsReady(true);
    };

    initializeLanguage();

    const subscription = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active") {
        try {
          const saved = await AsyncStorage.getItem("@wasfa/language");
          if (saved === "en" || saved === "ar") {
            return;
          }
          setLanguageState(detectDeviceLanguage());
        } catch {
          setLanguageState(detectDeviceLanguage());
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const setLanguage = async (lang: AppLanguage) => {
    if (lang !== language) track("language_changed", { language: lang });
    await AsyncStorage.setItem("@wasfa/language", lang);
    setLanguageState(lang);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isRTL: isLanguageRTL(language),
      t: (key) => translate(language, key),
      setLanguage,
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
