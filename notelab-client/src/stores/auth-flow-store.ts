import { create } from "zustand"
import { persist } from "zustand/middleware"

export type AuthFlowPurpose = "email-verification" | "sign-in"

type AuthFlowState = {
  email: string | null
  purpose: AuthFlowPurpose | null
  setAuthFlow: (flow: { email: string; purpose: AuthFlowPurpose }) => void
  clearAuthFlow: () => void
}

export const useAuthFlowStore = create<AuthFlowState>()(
  persist(
    (set) => ({
      email: null,
      purpose: null,
      setAuthFlow: (flow) => set(flow),
      clearAuthFlow: () => set({ email: null, purpose: null }),
    }),
    {
      name: "notelab-auth-flow",
      partialize: ({ email, purpose }) => ({ email, purpose }),
    },
  ),
)
