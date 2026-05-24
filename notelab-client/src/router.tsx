import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router"

import DashboardPage from "@/pages/dsahboard"
import LoginPage from "@/pages/login"
import OnboardingPage from "@/pages/onboarding"
import OtpPage from "@/pages/otp"
import SignupPage from "@/pages/signup"
import { sessionQueryOptions } from "@/features/auth/queries"
import { organizationsQueryOptions } from "@/features/organizations/queries"
import { queryClient } from "@/lib/query-client"

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const session = await getFreshSession()

    if (!session.user) {
      throw redirect({ to: "/login" })
    }

    const organizations = await getOrganizations()

    throw redirect({ to: organizations.length > 0 ? "/dashboard" : "/onboarding" })
  },
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: async () => {
    const session = await getFreshSession()

    if (session.user) {
      const organizations = await getOrganizations()

      throw redirect({ to: organizations.length > 0 ? "/dashboard" : "/onboarding" })
    }
  },
  component: LoginPage,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  beforeLoad: async () => {
    const session = await getFreshSession()

    if (session.user) {
      const organizations = await getOrganizations()

      throw redirect({ to: organizations.length > 0 ? "/dashboard" : "/onboarding" })
    }
  },
  component: SignupPage,
})

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  beforeLoad: async () => {
    const session = await getFreshSession()

    if (!session.user) {
      throw redirect({ to: "/login" })
    }

    const organizations = await getOrganizations()

    if (organizations.length > 0) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: OnboardingPage,
})

const otpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/otp",
  component: OtpPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: async () => {
    const session = await getFreshSession()

    if (!session.user) {
      throw redirect({ to: "/login" })
    }

    const organizations = await getOrganizations()

    if (organizations.length === 0) {
      throw redirect({ to: "/onboarding" })
    }
  },
  component: DashboardPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  onboardingRoute,
  otpRoute,
  dashboardRoute,
])

export const router = createRouter({ routeTree })

function getFreshSession() {
  return queryClient.fetchQuery({
    ...sessionQueryOptions,
    staleTime: 0,
  })
}

function getOrganizations() {
  return queryClient.fetchQuery({
    ...organizationsQueryOptions,
    staleTime: 0,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
