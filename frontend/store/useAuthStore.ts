import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession } from '@/types';

interface AuthState {
  session: AuthSession | null;
  hydrated: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
      setHydrated: (hydrated) => set({ hydrated })
    }),
    {
      name: 'virtualcare-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      }
    }
  )
);
