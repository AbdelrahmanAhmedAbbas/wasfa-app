export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  hasCompletedOnboarding: boolean;
}

export interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}
