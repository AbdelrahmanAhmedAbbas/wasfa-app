# Share target (iOS & Android)

The app appears in the system share sheet so users can share **Instagram reels**, TikTok links, text, and media (video/image) into Wasfa.

## How it works

- **expo-share-intent** is used for both platforms:
  - **iOS**: Adds a Share Extension so the app appears in the share sheet when sharing URLs, text, images, or videos (e.g. from Instagram).
  - **Android**: Registers intent filters for `text/*`, `video/*`, and `image/*` so the app receives SEND/SEND_MULTIPLE intents.

When the user shares content into the app, they are taken to `/import` with the shared URL, text, or media. The import screen already handles reel URLs and “paste link” flows.

## Configuration

- **app.json**: The `expo-share-intent` plugin is configured with:
  - `iosActivationRules`: URL, text, image, and movie (video) support.
  - `androidIntentFilters`: `text/*`, `video/*`, `image/*`.
  - `androidMultiIntentFilters`: `video/*`, `image/*` for multiple items.
- **Scheme**: The app scheme `mealplanner` is used so the share extension can open the main app with the shared data.
- **Patch**: The `patches/xcode+3.0.1.patch` (for the `xcode` package) is required for the iOS share extension prebuild; `postinstall` runs `patch-package` to apply it.

## Build & run

Share intent does **not** work in Expo Go. Use a dev client:

```bash
cd /Users/abdelrahmanahmed/Desktop/work/meal-planner
npx expo prebuild --no-install --clean
npx expo run:ios
# or
npx expo run:android
```

After installing on a device, share a reel or link from Instagram (or any app that supports sharing URLs/video) and choose “Wasfa” from the share sheet.

## Optional: manual iOS Share Extension (without plugin)

If you ever need to configure the iOS Share Extension manually (e.g. without expo-share-intent):

1. Open `ios/mealplanner.xcworkspace` in Xcode.
2. **File** → **New** → **Target...** → **Share Extension** (iOS App Extension).
3. Name it e.g. `MealPlannerShareExtension`, Language: Swift.
4. In the extension **Info.plist**, set `NSExtensionActivationRule` to support URL, text, and movie (e.g. `NSExtensionActivationSupportsWebURLWithMaxCount = 1`, `NSExtensionActivationSupportsText = true`, `NSExtensionActivationSupportsMovieWithMaxCount = 1`).
5. In the Share Extension’s view controller, read the first `NSExtensionItem`/attachments, build a deep link `mealplanner://import?url=...&text=...`, and open it via `openURL:` then `extensionContext?.completeRequest(...)`.
6. Ensure the main app’s **Info.plist** has URL scheme `mealplanner` (this project sets it in `app.json`).

The current setup uses the plugin, so the above is only for reference or custom setups.
