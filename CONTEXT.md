# Wasfa

Wasfa turns a cooking video saved on social media into a structured, bilingual recipe that can be planned and shopped for.

## Language

### Importing

**Source Platform**:
The social network a recipe was imported from: Instagram, TikTok or YouTube.
_Avoid_: Source, provider, network

**Short**:
A YouTube video published in YouTube's short-form format, at most three minutes long. It is the only kind of YouTube video Wasfa imports.
_Avoid_: YouTube video, clip, YouTube reel

### Onboarding and sign-in

**Onboarding**:
The run of screens a new person walks through before using the app: language, intro, chat questions, kitchen card, demo, sign-up, offer, setup. It is started from the **Login screen**, never shown by itself on first launch.
_Avoid_: Questionnaire (that is only the chat questions), signup flow

**Sign-up screen**:
The onboarding step with the reviews and the sign-in buttons, shown after the demo. It is only ever reached by walking on from the demo, never opened on its own.
_Avoid_: Reviews screen, login screen, auth screen

**Login screen**:
The standalone sign-in screen, and the first screen of the app without an account: a fresh install, after signing out or deleting the account, or an expired session. Only a device partway through **Onboarding** opens elsewhere. A **Returning account** logs in here; "Create an account", or signing in with a **New account**, starts **Onboarding** from here.
_Avoid_: Sign-in screen, sign-up screen

**New account**:
A signed-in account with no saved profile. It goes through the whole **Onboarding**, wherever it signed in; only the **Sign-up screen** is skipped when it is already signed in.
_Avoid_: New user, first-time user

**Returning account**:
A signed-in account that already has a saved profile. It goes straight into the app and keeps that profile, wherever it signed in.
_Avoid_: Existing user, old user

### Recipes

**Step**:
One action of the method a home cook follows, in the order they would do it: "Dice the onions", then "Fry the onions until soft, about 5 minutes". Preparation (washing, cutting, soaking, marinating, preheating) comes first, each as its own step, and no step uses an ingredient in a state an earlier step did not produce. Steps are worked out from the whole video, not cut from its transcript.
_Avoid_: Instruction, scene, transcript segment

**Scaling**:
Changing a recipe's servings. Amounts are worked out from the amounts as imported and rounded the way a cook measures: half an onion rather than 0.35, whole eggs and cloves, quarter teaspoons, grams to the nearest 5 or 25, and a small amount moves to the spoon that measures it (0.1 cup is 1½ tbsp). Going back to the imported servings gives the imported amounts exactly.
_Avoid_: Resizing, recalculating

### Grocery list

**Grocery line**:
One ingredient of a planned recipe as it goes on the list: its amount, unit and name, and nothing else. The ingredient's notes, preparation and any description or cooking step stay on the recipe.
_Avoid_: Shopping item, grocery item, ingredient

**Grocery row**:
What the list shows: every **Grocery line** for the same ingredient, from any recipe, added up into one name and one amount. Sizes and cuts ("large", "chopped") do not make a different ingredient; minced meat does. Amounts that convert (g and kg, ml and l) are added into one; amounts that do not ("2 cups" and "500 g" of rice) stand side by side. A recipe planned on two days of this week, or on a day and in "Any day", counts twice. A row does not name its recipes; the recipe chips above the list filter by recipe.
_Avoid_: Merged item, group
