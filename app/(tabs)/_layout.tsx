import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ExpoFont from 'expo-font';
import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { brandFontFamily } from '@/lib/theme/fonts';
import { onboardingColors } from '@/lib/theme/onboarding';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t, language } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: onboardingColors.primary,
        tabBarInactiveTintColor: onboardingColors.textMuted,
        tabBarStyle: {
          backgroundColor: onboardingColors.card,
          borderTopColor: onboardingColors.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          fontFamily:
            language === "ar" && ExpoFont.isLoaded(brandFontFamily.arabic)
              ? brandFontFamily.arabic
              : language !== "ar" && ExpoFont.isLoaded(brandFontFamily.english)
                ? brandFontFamily.english
                : undefined,
        },
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHome') || "Recipes",
          tabBarIcon: ({ color }) => <TabBarIcon name="bookmark" color={color} />,
          headerShown: false, // We'll build a custom header in the screen
        }}
      />
      <Tabs.Screen
        name="grocery"
        options={{
          title: t('tabGrocery') || "Groceries",
          tabBarIcon: ({ color }) => <TabBarIcon name="shopping-bag" color={color} />,
        }}
      />

      {/* Fake Tab for Import Plus Button */}
      <Tabs.Screen
        name="import-action"
        options={{
          title: "",
          // Custom plus button in the middle
          tabBarIcon: () => (
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#ff8c00", // Orange from the image
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 5,
            }}>
              <FontAwesome name="plus" size={24} color="#fff" />
            </View>
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Prevent default action
            e.preventDefault();
            // Open modal
            navigation.navigate('modal');
          },
        })}
      />

      <Tabs.Screen
        name="planner"
        options={{
          title: t('tabPlanner') || "Planner",
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar-check-o" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile') || "Discover",
          tabBarIcon: ({ color }) => <TabBarIcon name="th-large" color={color} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          // Hide from tab bar since we are removing it/merging to index
          href: null,
        }}
      />
    </Tabs>
  );
}
