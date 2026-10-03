import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { BottomDrawer } from "@/components/ui/BottomDrawer";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { Glyph } from "@/components/wasfa/Glyph";
import {
  EMPTY_RECIPE_FILTERS,
  MAIN_INGREDIENTS,
  TIME_FILTER_OPTIONS,
  countActiveFilters,
  type MainIngredient,
  type RecipeFilterOptions,
  type RecipeFilters,
} from "@/lib/home/recipe-filters";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { wasfaColors, wasfaRadius } from "@/lib/theme/wasfa";

export const MAIN_INGREDIENT_LABELS: Record<MainIngredient, TranslationKey> = {
  chicken: "homeIngredientChicken",
  meat: "homeIngredientMeat",
  seafood: "homeIngredientSeafood",
  rice: "homeIngredientRice",
  pasta: "homeIngredientPasta",
  eggs: "homeIngredientEggs",
  vegetarian: "homeIngredientVegetarian",
};

export const TIME_FILTER_LABELS: Record<(typeof TIME_FILTER_OPTIONS)[number], TranslationKey> = {
  30: "homeFilterUnder30",
  60: "homeFilterUnder60",
};

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

type RecipeFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  filters: RecipeFilters;
  onChange: (filters: RecipeFilters) => void;
  options: RecipeFilterOptions;
  /** How many recipes the current search and filters leave. */
  resultCount: number;
};

/** Filters for the recipe library. Choices apply as they are tapped. */
export function RecipeFilterSheet({
  visible,
  onClose,
  filters,
  onChange,
  options,
  resultCount,
}: RecipeFilterSheetProps) {
  const { t, language } = useLanguage();
  const { height: windowHeight } = useWindowDimensions();
  const hasFilters = countActiveFilters(filters) > 0;
  const hasOptions =
    options.hasTimes ||
    options.mealTypes.length > 0 ||
    options.cuisines.length > 0 ||
    options.ingredients.length > 0;
  const showLabel = t("homeFilterShow").replace("{count}", String(resultCount));

  return (
    <BottomDrawer visible={visible} onClose={onClose} title={t("homeFilters")} showCloseButton>
      <ScrollView
        style={{ maxHeight: windowHeight * 0.58 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!hasOptions ? <Text style={styles.emptyText}>{t("homeFilterEmpty")}</Text> : null}

        {options.hasTimes ? (
          <Section label={t("homeFilterTime")}>
            <FilterChip
              label={t("homeFilterAnyTime")}
              active={filters.maxMinutes === null}
              onPress={() => onChange({ ...filters, maxMinutes: null })}
            />
            {TIME_FILTER_OPTIONS.map((minutes) => (
              <FilterChip
                key={minutes}
                label={t(TIME_FILTER_LABELS[minutes])}
                active={filters.maxMinutes === minutes}
                onPress={() =>
                  onChange({ ...filters, maxMinutes: filters.maxMinutes === minutes ? null : minutes })
                }
              />
            ))}
          </Section>
        ) : null}

        {options.mealTypes.length > 0 ? (
          <Section label={t("homeFilterMealType")}>
            {options.mealTypes.map((option) => (
              <FilterChip
                key={option.key}
                label={option.label}
                active={filters.mealTypes.includes(option.key)}
                onPress={() => onChange({ ...filters, mealTypes: toggle(filters.mealTypes, option.key) })}
              />
            ))}
          </Section>
        ) : null}

        {options.cuisines.length > 0 ? (
          <Section label={t("homeFilterCuisine")}>
            {options.cuisines.map((option) => (
              <FilterChip
                key={option.key}
                label={option.label}
                active={filters.cuisines.includes(option.key)}
                onPress={() => onChange({ ...filters, cuisines: toggle(filters.cuisines, option.key) })}
              />
            ))}
          </Section>
        ) : null}

        {options.ingredients.length > 0 ? (
          <Section label={t("homeFilterMainIngredient")}>
            {MAIN_INGREDIENTS.filter((entry) => options.ingredients.includes(entry.id)).map((entry) => (
              <FilterChip
                key={entry.id}
                label={t(MAIN_INGREDIENT_LABELS[entry.id])}
                leading={<Glyph name={entry.glyph} size={18} />}
                active={filters.ingredients.includes(entry.id)}
                onPress={() => onChange({ ...filters, ingredients: toggle(filters.ingredients, entry.id) })}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasFilters }}
          disabled={!hasFilters}
          hitSlop={8}
          style={styles.clearButton}
          onPress={() => onChange(EMPTY_RECIPE_FILTERS)}
        >
          <Text style={[styles.clearText, !hasFilters && styles.clearTextDisabled]}>
            {t("homeFilterClear")}
          </Text>
        </Pressable>
        <CtaButton
          label={language === "ar" ? toArabicIndicDigits(showLabel) : showLabel}
          onPress={onClose}
          style={styles.showButton}
        />
      </View>
    </BottomDrawer>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  leading,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  leading?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      {leading}
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: wasfaColors.muted,
    textAlign: "left",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    height: 40,
    maxWidth: "100%",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipActive: {
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.ctaSoft,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  footer: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  clearButton: {
    paddingHorizontal: 6,
  },
  clearText: {
    fontSize: 15,
    fontWeight: "700",
    color: wasfaColors.primaryDark,
  },
  clearTextDisabled: {
    color: wasfaColors.disabledText,
  },
  showButton: {
    flex: 1,
  },
});
