import Feather from "@expo/vector-icons/Feather";
import * as ExpoFont from "expo-font";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { getTabBarVisualIndex, getTabBarVisualRouteNames } from "@/lib/home/home-screen";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { brandFontFamily } from "@/lib/theme/fonts";
import { onboardingColors } from "@/lib/theme/onboarding";

const TAB_CONFIG = {
  index: { labelKey: "tabHome", fallbackLabel: "Home", icon: "home" },
  planner: { labelKey: "tabPlanner", fallbackLabel: "Planner", icon: "calendar" },
  grocery: { labelKey: "tabGrocery", fallbackLabel: "Grocery", icon: "shopping-cart" },
  profile: { labelKey: "tabProfile", fallbackLabel: "Profile", icon: "user" },
} as const;

type TabRouteName = keyof typeof TAB_CONFIG;

const ACTIVE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const DOCK_HEIGHT = 74;

type TabBarItemProps = {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
  tabLabelFontFamily?: string;
};

function TabBarItem({
  label,
  icon,
  isFocused,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
  tabLabelFontFamily,
}: TabBarItemProps) {
  const reduceMotionEnabled = useReducedMotion();
  const selectedProgress = useSharedValue(isFocused ? 1 : 0);
  const pressedScale = useSharedValue(1);

  useEffect(() => {
    selectedProgress.value = withTiming(isFocused ? 1 : 0, {
      duration: reduceMotionEnabled ? 0 : 220,
      easing: ACTIVE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [isFocused, reduceMotionEnabled, selectedProgress]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressedScale.value * (1 + selectedProgress.value * 0.02) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + selectedProgress.value * 0.28,
    transform: [{ translateY: selectedProgress.value * -1 }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.8 + selectedProgress.value * 0.2,
  }));

  const handlePressIn = () => {
    pressedScale.value = withTiming(reduceMotionEnabled ? 1 : 0.96, {
      duration: reduceMotionEnabled ? 0 : 90,
      reduceMotion: ReduceMotion.System,
    });
  };

  const handlePressOut = () => {
    pressedScale.value = withTiming(1, {
      duration: reduceMotionEnabled ? 0 : 140,
      easing: ACTIVE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View style={[styles.tabButton, contentStyle]}>
        <Animated.View style={iconStyle}>
          <Feather name={icon} size={18} color={isFocused ? "#FFFFFF" : "#9A938C"} />
        </Animated.View>
        <Animated.Text
          style={[
            styles.tabLabel,
            isFocused && styles.tabLabelActive,
            tabLabelFontFamily ? { fontFamily: tabLabelFontFamily } : undefined,
            labelStyle,
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({
  state,
  descriptors,
  navigation,
  tabLabelFontFamily,
}: BottomTabBarProps & { tabLabelFontFamily?: string }) {
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReducedMotion();
  const visibleRoutes = state.routes.filter((route) => route.name in TAB_CONFIG) as Array<
    typeof state.routes[number] & { name: TabRouteName }
  >;
  const visibleRouteNames = useMemo(
    () => visibleRoutes.map((route) => route.name),
    [visibleRoutes]
  );
  const visualRoutes = useMemo(
    () => getTabBarVisualRouteNames(visibleRoutes, isRTL),
    [isRTL, visibleRoutes]
  );
  const activeIndex = useSharedValue(state.index);
  const rowWidth = useSharedValue(0);
  const activeRouteName = state.routes[state.index]?.name as TabRouteName | undefined;
  // Keep the bar floating (absolute, zero layout height) but give the root a real
  // frame that fully contains the dock. A zero-height absoluteFill root leaves the
  // dock painted outside its ancestor bounds, which iOS 27 hit-testing rejects.
  const bottomOffset = Math.max(insets.bottom - 4, 8);
  const tabBarTouchHeight = DOCK_HEIGHT + bottomOffset;

  useEffect(() => {
    const visualIndex =
      activeRouteName == null
        ? 0
        : Math.max(getTabBarVisualIndex(activeRouteName, visibleRouteNames, isRTL), 0);

    activeIndex.value = withTiming(visualIndex, {
      duration: reduceMotionEnabled ? 0 : 260,
      easing: ACTIVE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [activeIndex, activeRouteName, isRTL, reduceMotionEnabled, visibleRouteNames]);

  const activePillStyle = useAnimatedStyle(() => {
    const slotWidth = visibleRoutes.length > 0 ? rowWidth.value / visibleRoutes.length : 0;
    const pillWidth = Math.max(slotWidth - 18, 82);

    return {
      opacity: slotWidth > 0 ? 1 : 0,
      width: pillWidth,
      transform: [
        {
          translateX: slotWidth > 0 ? activeIndex.value * slotWidth + (slotWidth - pillWidth) / 2 : 0,
        },
      ],
    };
  });

  return (
    <View pointerEvents="box-none" style={[styles.outerFrame, { height: tabBarTouchHeight }]}>
      <View style={styles.dock}>
        <View
          style={styles.dockRow}
          onLayout={(event) => {
            rowWidth.value = event.nativeEvent.layout.width;
          }}
        >
          <Animated.View pointerEvents="none" style={[styles.activePill, activePillStyle]} />
          {visualRoutes.map((route) => {
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
                tabLabelFontFamily={tabLabelFontFamily}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { t, language } = useLanguage();
  const tabLabelFontFamily =
    language === "ar" && ExpoFont.isLoaded(brandFontFamily.arabic)
      ? brandFontFamily.arabic
      : language !== "ar" && ExpoFont.isLoaded(brandFontFamily.english)
        ? brandFontFamily.english
        : undefined;

  return (
    <Tabs
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          tabLabelFontFamily={tabLabelFontFamily}
        />
      )}
      screenOptions={{
        headerShown: useClientOnlyValue(false, true),
        animation: "fade",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t(TAB_CONFIG.index.labelKey) || TAB_CONFIG.index.fallbackLabel,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: t(TAB_CONFIG.planner.labelKey) || TAB_CONFIG.planner.fallbackLabel,
        }}
      />
      <Tabs.Screen
        name="grocery"
        options={{
          title: t(TAB_CONFIG.grocery.labelKey) || TAB_CONFIG.grocery.fallbackLabel,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t(TAB_CONFIG.profile.labelKey) || TAB_CONFIG.profile.fallbackLabel,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  dock: {
    marginHorizontal: 14,
    direction: "ltr",
    height: DOCK_HEIGHT,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D7E3F5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#87A7D2",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
  },
  dockRow: {
    flex: 1,
    flexDirection: "row",
    direction: "ltr",
    alignItems: "center",
    position: "relative",
  },
  pressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabButton: {
    minWidth: 68,
    height: 56,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  activePill: {
    position: "absolute",
    left: 0,
    height: 56,
    borderRadius: 12,
    backgroundColor: onboardingColors.primary,
    shadowColor: onboardingColors.primaryDark,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "600",
    color: "#9A938C",
    textAlign: "center",
    includeFontPadding: false,
  },
  tabLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
