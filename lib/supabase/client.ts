import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Check if using placeholder values
const isPlaceholder = supabaseUrl.includes("placeholder");

if (!supabaseUrl || !supabaseAnonKey || isPlaceholder) {
  console.warn(
    "⚠️  Using placeholder Supabase credentials. Authentication will not work until you:",
    "\n1. Create a Supabase project at https://supabase.com",
    "\n2. Update .env file with your actual credentials",
    "\n3. Restart the dev server"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
