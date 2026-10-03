import Feather from "@expo/vector-icons/Feather";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { ImportSheetProvider, useImportSheet } from "@/components/import/ImportSheetContext";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  TAB_BAR_BOTTOM_GAP,
  TAB_BAR_HEIGHT,
  wasfaColors,
  wasfaShadow,
} from "@/lib/theme/wasfa";

const TAB_CONFIG = {
  index: { labelKey: "tabHome", fallbackLabel: "Home", icon: "home" },
  planner: { labelKey: "tabPlanner", fallbackLabel: "Planner", icon: "calendar" },
  grocery: { labelKey: "tabGrocery", fallbackLabel: "Grocery", icon: "shopping-bag" },
  profile: { labelKey: "tabProfile", fallbackLabel: "Profile", icon: "user" },
} as const;

type TabRouteName = keyof typeof TAB_CONFIG;

const TAB_LAYOUT_TRANSITION = LinearTransition.duration(220);

type TabBarItemProps = {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

function TabBarItem({
  label,
  icon,
  isFocused,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: TabBarItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Only the active tab shows its label; the pill grows to fit it. */}
      <Animated.View
        layout={TAB_LAYOUT_TRANSITION}
        style={[styles.tab, isFocused ? styles.tabActive : styles.tabInactive]}
      >
        <Feather name={icon} size={21} color={isFocused ? "#FFFFFF" : "rgba(255,255,255,0.6)"} />
        {isFocused ? (
          <Animated.View entering={FadeIn.duration(180)}>
            <Text numberOfLines={1} style={styles.tabLabel}>
              {label}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const importSheet = useImportSheet();
  const visibleRoutes = state.routes.filter((route) => route.name in TAB_CONFIG) as Array<
    typeof state.routes[number] & { name: TabRouteName }
  >;
  const activeRouteName = state.routes[state.index]?.name as TabRouteName | undefined;
  // Keep the bar floating (absolute, zero layout height) but give the root a real
  // frame that fully contains the dock. A zero-height absoluteFill root leaves the
  // dock painted outside its ancestor bounds, which iOS 27 hit-testing rejects.
  const bottomOffset = Math.max(insets.bottom, TAB_BAR_BOTTOM_GAP);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outerFrame, { height: TAB_BAR_HEIGHT + bottomOffset }]}
    >
      {/* A plain row: the root direction mirrors the tab order and add button in Arabic. */}
      <View style={styles.row}>
        <Animated.View layout={TAB_LAYOUT_TRANSITION} style={styles.dock}>
          {visibleRoutes.map((route) => {
            const config = TAB_CONFIG[route.name];
            const descriptor = descriptors[route.key];
            const isFocused = activeRouteName === route.name;
            const label =
              typeof descriptor.options.title === "string"
                ? descriptor.options.title
                : config.fallbackLabel;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            return (
              <TabBarItem
                key={route.key}
                label={label}
                icon={config.icon}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
                testID={descriptor.options.tabBarButtonTestID}
              />
            );
          })}
        </Animated.View>

        <Animated.View layout={TAB_LAYOUT_TRANSITION}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("homeNewRecipe")}
            onPress={importSheet.open}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          >
            <Feather name="plus" size={26} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useLanguage();

  return (
    <ImportSheetProvider>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: t(TAB_CONFIG.index.labelKey) || TAB_CONFIG.index.fallbackLabel }}
        />
        <Tabs.Screen
          name="planner"
          options={{ title: t(TAB_CONFIG.planner.labelKey) || TAB_CONFIG.planner.fallbackLabel }}
        />
        <Tabs.Screen
          name="grocery"
          options={{ title: t(TAB_CONFIG.grocery.labelKey) || TAB_CONFIG.grocery.fallbackLabel }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: t(TAB_CONFIG.profile.labelKey) || TAB_CONFIG.profile.fallbackLabel }}
        />
      </Tabs>
    </ImportSheetProvider>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dock: {
    height: TAB_BAR_HEIGHT,
    padding: 6,
    borderRadius: 999,
    backgroundColor: wasfaColors.deep,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    ...wasfaShadow.floating,
  },
  tab: {
    height: 48,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabActive: {
    paddingHorizontal: 14,
    backgroundColor: wasfaColors.cta,
  },
  tabInactive: {
    width: 46,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    includeFontPadding: false,
  },
  addButton: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: wasfaColors.cta,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  addButtonPressed: {
    opacity: 0.85,
  },
});
