import test from "node:test";
import assert from "node:assert/strict";

import {
  getHomeRecipeListParams,
  getHomeScreenCopy,
  getHomeScreenLayout,
  getHomeRecipeCards,
  getTabBarVisualIndex,
  getTabBarVisualRouteNames,
  getHomeScrollContentStyle,
  getHomeScrollProps,
  matchesRecipeSearch,
} from "./home-screen.ts";

test("applies RTL-specific alignment and directional affordances on the home screen", () => {
  const layout = getHomeScreenLayout(true);

  assert.deepEqual(layout, {
    headerArrow: "arrow-left",
    textAlign: "left",
    writingDirection: "rtl",
    recipeMenuPosition: {
      left: 10,
      right: "auto",
    },
  });
});

test("builds Arabic home screen copy for the imported recipes view", () => {
  const copy = getHomeScreenCopy({
    displayName: "عبدالرحمن",
    folderCount: 1,
    importedRecipeCount: 2,
    recipeCount: 2,
    selectedFolderName: null,
    translate: (key) =>
      ({
        homeGreeting: "مرحبًا،",
        homeCookingLine: "هيا نبدأ\nالطبخ!",
        homeNewRecipe: "وصفة جديدة",
        homeMenuSubtitle: "ماذا سنطبخ اليوم؟",
        homeSearchPlaceholder: "ابحث في مكتبتك...",
        homeFilterTime: "الوقت",
        homeFilterMainIngredient: "المكوّن الرئيسي",
        homeSomethingWentWrong: "حدث خطأ ما",
        homeTapToTryAgain: "اضغط للمحاولة مرة أخرى.",
        homeImportedRecipes: "الوصفات المستوردة",
        homeView: "عرض",
        homeViewAll: "عرض الكل",
        homeNewFolder: "مجلد جديد",
        foldersTitle: "المجلدات",
        homeRecipeCount: "{count} وصفات",
        homeItemCount: "{count} عناصر",
      })[key],
  });

  assert.equal(copy.heroTitle, "مرحبًا،\nعبدالرحمن!\nهيا نبدأ\nالطبخ!");
  assert.equal(copy.menuSubtitle, "ماذا سنطبخ اليوم؟");
  assert.equal(copy.sectionTitle, "المجلدات");
  assert.equal(copy.sectionAction, "عرض الكل");
  assert.equal(copy.importedFolderMeta, "2 وصفات");
  assert.equal(copy.recipeSectionTitle, "الوصفات المستوردة");
  assert.equal(copy.recipeSectionMeta, "(2 وصفات)");
});

test("does not create fake recipe cards when there are no saved recipes", () => {
  const cards = getHomeRecipeCards({
    recipes: [],
    minuteLabel: "د",
    fallbackImage: "fallback-image",
  });

  assert.deepEqual(cards, []);
});

test("builds recipe list params for the selected folder", () => {
  assert.equal(getHomeRecipeListParams(null), undefined);
  assert.deepEqual(getHomeRecipeListParams("folder-1"), { folderId: "folder-1" });
});

test("keeps the home scroll view pull-refreshable when content is short", () => {
  assert.deepEqual(getHomeScrollProps(), {
    alwaysBounceVertical: true,
    bounces: true,
  });
  assert.deepEqual(getHomeScrollContentStyle(180), {
    flexGrow: 1,
    paddingBottom: 180,
  });
});

test("builds interactive folder recipe cards for saved recipes", () => {
  const cards = getHomeRecipeCards({
    recipes: [
      {
        id: "recipe-1",
        title: "كبسة دجاج",
        prep_minutes: 15,
        cook_minutes: 45,
        source_thumbnail_url: "https://example.com/kabsa.jpg",
      },
      {
        id: "recipe-2",
        title: "سلطة",
        prep_minutes: null,
        cook_minutes: null,
        source_thumbnail_url: null,
      },
    ],
    minuteLabel: "د",
    fallbackImage: "fallback-image",
  });

  assert.deepEqual(cards, [
    {
      id: "recipe-1",
      recipeId: "recipe-1",
      interactive: true,
      title: "كبسة دجاج",
      minutes: "60 د",
      image: { uri: "https://example.com/kabsa.jpg" },
    },
    {
      id: "recipe-2",
      recipeId: "recipe-2",
      interactive: true,
      title: "سلطة",
      minutes: "25 د",
      image: "fallback-image",
    },
  ]);
});

test("builds recipe cards from the active localized recipe text", () => {
  const cards = getHomeRecipeCards({
    recipes: [
      {
        id: "recipe-1",
        title: "Chicken Kabsa",
        prep_minutes: 10,
        cook_minutes: 20,
        source_thumbnail_url: null,
        localized: {
          ar: { title: "كبسة دجاج", ingredients: [], steps: [] },
        },
      },
    ],
    language: "ar",
    minuteLabel: "د",
    fallbackImage: "fallback-image",
  });

  assert.equal(cards[0].title, "كبسة دجاج");
});

test("matches recipe search across localized and top-level titles", () => {
  const recipe = {
    id: "recipe-1",
    title: "Chicken Kabsa",
    prep_minutes: null,
    cook_minutes: null,
    source_thumbnail_url: null,
    localized: {
      ar: { title: "كبسة دجاج", ingredients: [], steps: [] },
      en: { title: "Chicken Kabsa", ingredients: [], steps: [] },
    },
  };

  assert.equal(matchesRecipeSearch(recipe, "كبسة"), true);
  assert.equal(matchesRecipeSearch(recipe, "kabsa"), true);
  assert.equal(matchesRecipeSearch(recipe, "pasta"), false);
});

test("reverses tab order visually in RTL and maps the active route to the mirrored slot", () => {
  const routes = ["index", "planner", "grocery", "profile"];

  assert.deepEqual(getTabBarVisualRouteNames(routes, true), ["profile", "grocery", "planner", "index"]);
  assert.equal(getTabBarVisualIndex("index", routes, true), 3);
  assert.equal(getTabBarVisualIndex("profile", routes, true), 0);
});

test("filters recipes by home mood tiles", async () => {
  const { matchesHomeMood } = await import("./home-screen.ts");
  const kabsa = {
    id: "1",
    title: "كبسة دجاج",
    prep_minutes: 15,
    cook_minutes: 60,
    source_thumbnail_url: null,
    localized: { en: { title: "Chicken Kabsa", ingredients: [{ name: "basmati rice" }, { name: "chicken" }], steps: [] } },
  };
  const pasta = {
    id: "2",
    title: "Garlicky Kale Pasta",
    prep_minutes: 5,
    cook_minutes: 15,
    source_thumbnail_url: null,
    localized: { en: { title: "Garlicky Kale Pasta", ingredients: [{ name: "spaghetti" }, { name: "kale" }], steps: [] } },
  };
  const untimed = { id: "3", title: "Mystery dish", prep_minutes: null, cook_minutes: null, source_thumbnail_url: null };

  assert.equal(matchesHomeMood(kabsa, "quick"), false);
  assert.equal(matchesHomeMood(pasta, "quick"), true);
  assert.equal(matchesHomeMood(untimed, "quick"), false);
  assert.equal(matchesHomeMood(kabsa, "chicken"), true);
  assert.equal(matchesHomeMood(pasta, "chicken"), false);
  assert.equal(matchesHomeMood(kabsa, "rice"), true);
  assert.equal(matchesHomeMood(kabsa, "veggie"), false);
  assert.equal(matchesHomeMood(pasta, "veggie"), true);
  assert.equal(matchesHomeMood(untimed, "veggie"), false);
});
