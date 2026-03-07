import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, LocaleDirContext, ThemeProvider } from '@react-navigation/native';
import * as ExpoFont from 'expo-font';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageProvider';
import { brandFontSources } from '@/lib/theme/fonts';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [brandFontsAttempted, setBrandFontsAttempted] = useState(false);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    let isMounted = true;

    async function loadBrandFonts() {
      try {
        await ExpoFont.loadAsync(brandFontSources);
      } catch {
        // Keep app usable with fallback fonts if network is unavailable.
      } finally {
        if (isMounted) {
          setBrandFontsAttempted(true);
        }
      }
    }

    void loadBrandFonts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (loaded && brandFontsAttempted) {
      SplashScreen.hideAsync();
    }
  }, [loaded, brandFontsAttempted]);

  if (!loaded || !brandFontsAttempted) {
    return null;
  }

  return (
    <LanguageProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </LanguageProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isRTL } = useLanguage();
  const direction = isRTL ? "rtl" : "ltr";

  return (
    <View style={{ flex: 1, direction }}>
      <LocaleDirContext.Provider value={direction}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="import/index" options={{ headerShown: false }} />
            <Stack.Screen name="import/[jobId]" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </LocaleDirContext.Provider>
    </View>
  );
}
