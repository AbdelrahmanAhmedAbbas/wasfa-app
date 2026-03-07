# Supabase Authentication Setup Guide

This guide will help you set up Supabase authentication with Google Sign-In for the Meal Planner app.

## Prerequisites
- A Google account
- A Supabase account (free tier works)

---

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/sign in
2. Click **"New Project"**
3. Fill in the project details:
   - **Name**: `meal-planner` (or any name you prefer)
   - **Database Password**: Choose a strong password (save it somewhere safe)
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Free tier is sufficient for development
4. Click **"Create new project"**
5. Wait for the project to initialize (~2 minutes)

---

## Step 2: Get Supabase API Credentials

1. In your Supabase project dashboard, go to **Settings** (gear icon in sidebar) → **API**
2. You'll see two important values:
   - **Project URL**: Something like `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: A long string starting with `eyJ...`
3. Copy both values - you'll need them soon

---

## Step 3: Configure Google OAuth

### 3.1 Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. In the sidebar, go to **APIs & Services** → **Credentials**
4. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
5. If prompted, configure the OAuth consent screen first:
   - Choose **"External"** user type
   - Fill in app name: `Meal Planner`
   - Add your email as the developer contact
   - Save and continue through the remaining steps

### 3.2 Create OAuth Client IDs

You need to create separate OAuth clients for iOS and Android:

#### For iOS:
1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. Application type: **iOS**
3. Name: `Meal Planner iOS`
4. Bundle ID: `com.abdelrahmanahmed.mealplanner`
5. Click **"Create"**
6. Copy the **Client ID** (it will look like `xxx.apps.googleusercontent.com`)

#### For Android:
1. First, get your app's SHA-1 fingerprint:
   ```bash
   # For development, use the debug keystore
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
   Copy the SHA-1 fingerprint from the output

2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Application type: **Android**
4. Name: `Meal Planner Android`
5. Package name: `com.abdelrahmanahmed.mealplanner`
6. SHA-1 certificate fingerprint: Paste the SHA-1 you copied
7. Click **"Create"**
8. Copy the **Client ID**

#### For Web (required by Supabase):
1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. Application type: **Web application**
3. Name: `Meal Planner Web`
4. Add authorized redirect URI: `https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback`
   - Replace `xxxxxxxxxxxxx` with your actual Supabase project ID from Step 2
5. Click **"Create"**
6. Copy both the **Client ID** and **Client Secret**

### 3.3 Configure Google Provider in Supabase

1. Go back to your Supabase project dashboard
2. In the sidebar, go to **Authentication** → **Providers**
3. Find **Google** in the list and click to expand it
4. Toggle **"Enable Sign in with Google"** to ON
5. Enter the credentials from the **Web** OAuth client you created:
   - **Client ID (for OAuth)**: Paste the Web Client ID
   - **Client Secret (for OAuth)**: Paste the Web Client Secret
6. In the **"Authorized Client IDs"** field, add BOTH the iOS and Android Client IDs (comma-separated):
   ```
   xxx-ios.apps.googleusercontent.com,xxx-android.apps.googleusercontent.com
   ```
7. Click **"Save"**

---

## Step 4: Update Your App Configuration

1. Open the `.env` file in the root of your project
2. Replace the placeholder values with your actual Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your-actual-key
   ```
3. Save the file

---

## Step 5: Test the Integration

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Run on your device/simulator:
   - For iOS: `npm run ios`
   - For Android: `npm run android`

4. Test the authentication flow:
   - You should see the welcome screen with two options
   - Try "Sign in with Google" - it should open a browser window for OAuth
   - After signing in with Google, you should be redirected back to the app
   - Kill and reopen the app - you should stay signed in (session persists)
   - Try signing out from the Profile tab
   - Try "Continue as Guest" to test the onboarding flow

---

## Troubleshooting

### Google Sign-In not working on Android
- Make sure you added the correct SHA-1 fingerprint
- For production builds, you'll need to add the production SHA-1 as well

### Google Sign-In not working on iOS
- Make sure the Bundle ID matches exactly: `com.abdelrahmanahmed.mealplanner`
- Check that you added the iOS Client ID to Supabase's "Authorized Client IDs"

### Session not persisting
- Make sure AsyncStorage is properly linked (it should be with Expo)
- Check that the Supabase credentials in `.env` are correct

### "Invalid redirect URI" error
- Verify the redirect URI in Google Console matches your Supabase project URL
- Format should be: `https://your-project.supabase.co/auth/v1/callback`

---

## Production Deployment

Before deploying to production:

1. **Generate production Android keystore** and add its SHA-1 to Google Console
2. **Configure iOS Bundle ID** in Xcode to match
3. **Update Google OAuth consent screen** to verified status (if needed for public release)
4. **Enable Row Level Security (RLS)** on any Supabase tables you create
5. **Review Supabase Auth settings** under Authentication → Settings

---

## Authentication Flow Overview

```
App Start
  ↓
Check Auth State
  ↓
  ├─ Not Authenticated → Show Auth Welcome Screen
  │   ↓
  │   User chooses:
  │   ├─ "Continue as Guest" → Onboarding Flow (5 steps)
  │   │   ↓
  │   │   Complete onboarding → Navigate to Tabs (Guest Mode)
  │   │
  │   └─ "Sign in with Google" → Google OAuth
  │       ↓
  │       Session stored → Skip onboarding → Navigate to Tabs
  │
  └─ Authenticated → Navigate to Tabs
      ↓
      User can:
      ├─ Guest user → Sign in from Profile tab
      └─ Authenticated user → Sign out from Profile tab
```

---

## Files Created/Modified

### New Files:
- `.env` - Environment variables
- `lib/supabase/client.ts` - Supabase client configuration
- `lib/auth/types.ts` - TypeScript types for auth
- `lib/auth/AuthProvider.tsx` - Auth context and provider
- `app/(auth)/_layout.tsx` - Auth screens layout
- `app/(auth)/welcome.tsx` - Welcome screen with guest/sign-in options
- `app/(onboarding)/value.tsx` - Onboarding step 2
- `app/(onboarding)/source.tsx` - Onboarding step 3
- `app/(onboarding)/goals.tsx` - Onboarding step 4
- `app/(onboarding)/trial.tsx` - Onboarding step 5 (final)

### Modified Files:
- `app/_layout.tsx` - Added AuthProvider and routing logic
- `app/index.tsx` - Updated with auth-aware routing
- `app/(tabs)/profile.tsx` - Added user info and sign in/out
- `lib/i18n/translations.ts` - Added auth-related translations
- `.gitignore` - Added .env to prevent committing secrets
- `package.json` - Added Supabase and OAuth dependencies

---

## Security Notes

- ✅ The Supabase `anon` key is safe to expose in client code
- ✅ Row Level Security (RLS) on Supabase protects your data
- ✅ Session tokens are stored securely in AsyncStorage
- ✅ OAuth is handled through secure browser sessions
- ⚠️ Never commit your `.env` file to version control (it's in .gitignore)
- ⚠️ Keep your Supabase service role key secret (not used in client)

---

## Next Steps

After authentication is working:

1. **Create database tables** in Supabase for:
   - User profiles
   - Recipes
   - Meal plans
   - Grocery lists

2. **Set up Row Level Security (RLS)** policies so users can only access their own data

3. **Implement data syncing** between the app and Supabase

4. **Add user profile settings** to the Profile screen

---

## Support

If you encounter issues:
- Check Supabase logs: Dashboard → Logs
- Check Google Cloud Console for OAuth errors
- Verify all credentials are correct in `.env`
- Make sure all Client IDs are added to Supabase

For Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs)
For Google OAuth documentation: [https://developers.google.com/identity](https://developers.google.com/identity)
