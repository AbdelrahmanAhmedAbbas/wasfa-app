import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, LocaleDirContext, ThemeProvider } from '@react-navigation/native';
import * as ExpoFont from 'expo-font';
import { useFonts } from 'expo-font';
import { Stack, useNavigationContainerRef, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { AppNotifications } from '@/components/notifications/AppNotifications';
import { useColorScheme } from '@/components/useColorScheme';
import { AnalyticsProvider } from '@/lib/analytics/AnalyticsProvider';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageProvider';
import { getShareIntentKey, shouldRedirectShareIntent } from '@/lib/import/navigation';
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
    <ShareIntentProvider options={{ scheme: 'mealplanner' }}>
      <LanguageProvider>
        <AnalyticsProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </AnalyticsProvider>
      </LanguageProvider>
    </ShareIntentProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isRTL } = useLanguage();
  const direction = isRTL ? "rtl" : "ltr";
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const { user, loading: authLoading } = useAuth();
  const isSignedIn = !!user;
  const { isReady, hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const lastShareKey = useRef<string | null>(null);

  useEffect(() => {
    const currentKey = getShareIntentKey(shareIntent);
    if (!isReady || authLoading || !hasShareIntent) return;
    if (!shouldRedirectShareIntent(currentKey, lastShareKey.current)) return;
    lastShareKey.current = currentKey;
    // Importing needs an account, so a share received while signed out is dropped.
    if (!isSignedIn) {
      resetShareIntent(true);
      return;
    }
    const url = shareIntent.webUrl ?? undefined;
    const text = shareIntent.text ?? undefined;
    const firstFile = shareIntent.files?.[0];
    const mediaUri = firstFile?.path;
    const mediaMime = firstFile?.mimeType;
    const params: Record<string, string> = {};
    if (url) params.url = url;
    if (text) params.text = text;
    if (mediaUri) params.media_uri = mediaUri;
    if (mediaMime) params.media_mime = mediaMime;
    resetShareIntent(true);
    // With the tabs open the import goes on top of them, so the same tabs are
    // there to come back to. Rebuilding them after every import left a second
    // copy stacked on the first.
    const tabsAreOpen =
      navigationRef.isReady() &&
      navigationRef.getRootState().routes.some((route) => route.name === "(tabs)");
    if (tabsAreOpen) {
      router.push({ pathname: "/import", params });
    } else {
      router.replace({ pathname: "/import", params });
    }
  }, [isReady, authLoading, isSignedIn, hasShareIntent, shareIntent, resetShareIntent, router, navigationRef]);

  return (
    <View style={{ flex: 1, direction }}>
      <LocaleDirContext.Provider value={direction}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AppNotifications />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(questionnaire)" options={{ headerShown: false }} />
            <Stack.Screen name="(paywall)" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
            {/* There is no guest mode: without an account these screens do not
                exist, so signing out (or an expired session) returns to index. */}
            <Stack.Protected guard={isSignedIn}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              {/* An import sits on top of the tabs and returns to them by itself,
                  so it cannot be swiped away half-way. */}
              <Stack.Screen name="import/index" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="import/[jobId]" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </LocaleDirContext.Provider>
    </View>
  );
}
