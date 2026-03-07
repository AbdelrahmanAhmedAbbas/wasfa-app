# Quick Start Guide - Supabase Authentication

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → Sign up/Sign in
2. Click "New Project"
3. Name: `meal-planner`, choose a password and region
4. Wait ~2 minutes for initialization

### Step 2: Get Credentials
1. Go to Settings → API in your Supabase project
2. Copy:
   - **Project URL** (e.g., `https://xxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

### Step 3: Configure Google OAuth

#### 3a. Google Cloud Console
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create/select project
3. Go to APIs & Services → Credentials
4. Configure OAuth consent screen (if needed)
5. Create 3 OAuth Client IDs:

**iOS Client:**
- Type: iOS
- Bundle ID: `com.abdelrahmanahmed.mealplanner`
- Copy the Client ID

**Android Client:**
- Type: Android
- Package: `com.abdelrahmanahmed.mealplanner`
- SHA-1: Get with `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
- Copy the Client ID

**Web Client:**
- Type: Web application
- Redirect URI: `https://xxx.supabase.co/auth/v1/callback` (replace xxx with your project ID)
- Copy Client ID and Client Secret

#### 3b. Supabase Configuration
1. In Supabase: Authentication → Providers → Google
2. Enable Google
3. Enter Web Client ID and Secret
4. In "Authorized Client IDs", add iOS and Android Client IDs (comma-separated)
5. Save

### Step 4: Update Your App
1. Open `.env` file in project root
2. Replace placeholders:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Save the file

### Step 5: Test
```bash
npm start
npm run ios    # or npm run android
```

---

## ✅ What You Should See

1. **First Launch**: Auth welcome screen with 2 buttons
2. **Continue as Guest**: Goes through 5-step onboarding → Tabs (guest mode)
3. **Sign in with Google**: Opens browser → Google login → Back to app → Tabs (authenticated)
4. **Kill & Reopen**: Should stay signed in (session persists)
5. **Profile Tab**: Shows user info if signed in, or guest mode with sign-in option

---

## 📚 Full Documentation

- **Complete setup guide**: `SUPABASE_SETUP.md`
- **Implementation details**: `IMPLEMENTATION_SUMMARY.md`

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid credentials" | Check `.env` has correct Supabase URL and key |
| Google sign-in fails | Verify all 3 OAuth clients created and added to Supabase |
| "Invalid redirect URI" | Check redirect URI in Google Console matches Supabase URL |
| App crashes on launch | Run `npm install` to ensure dependencies are installed |

---

## 🔐 Security Checklist

- [x] `.env` file created with credentials
- [x] `.env` is in `.gitignore` (don't commit it!)
- [x] Using Supabase `anon` key (safe for client)
- [ ] Will add RLS policies when creating database tables

---

## 📱 Features Implemented

✅ Google Sign-In (iOS, Android, Web)
✅ Guest Mode (no account required)
✅ 5-step onboarding flow
✅ Session persistence (stays signed in)
✅ User profile with sign in/out
✅ RTL support (English & Arabic)
✅ Beautiful UI matching app design

---

## 🎯 Next Steps

1. Complete Supabase setup (above)
2. Test auth flow on your device
3. Create database tables for your app data
4. Add Row Level Security (RLS) policies
5. Implement data syncing with Supabase

---

**Need help?** Check the full guides or Supabase docs at [supabase.com/docs](https://supabase.com/docs)
