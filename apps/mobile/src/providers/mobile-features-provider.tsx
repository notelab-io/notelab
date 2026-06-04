import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  NotelabFeaturesProvider,
  type NotelabAuthClient,
} from '@notelab/features';
import type {
  SessionResponse,
  SignInWithOtpInput,
  SignUpInput,
  VerifyEmailOtpInput,
} from '@notelab/features/auth';
import type {
  Organization,
  OrganizationInvitation,
  OrganizationRole,
} from '@notelab/features/organizations';
import * as React from 'react';

import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

const mobileAuthClient: NotelabAuthClient = {
  getSession: () => apiFetch<SessionResponse>('/session'),
  requestSignInOtp: (email) =>
    authClient.$fetch('/email-otp/send-verification-otp', {
      method: 'POST',
      body: {
        email,
        type: 'sign-in',
      },
    }) as Promise<{ success: boolean }>,
  signInWithOtp: (input: SignInWithOtpInput) =>
    authClient.$fetch('/sign-in/email-otp', {
      method: 'POST',
      body: input,
    }) as Promise<{ token: string; user: unknown }>,
  signUp: (input: SignUpInput) =>
    authClient.$fetch('/sign-up/email', {
      method: 'POST',
      body: {
        ...input,
        callbackURL: '/',
      },
    }) as Promise<{ user: unknown }>,
  requestEmailVerificationOtp: (email) =>
    authClient.$fetch('/email-otp/send-verification-otp', {
      method: 'POST',
      body: {
        email,
        type: 'email-verification',
      },
    }) as Promise<{ success: boolean }>,
  verifyEmailOtp: (input: VerifyEmailOtpInput) =>
    authClient.$fetch('/email-otp/verify-email', {
      method: 'POST',
      body: input,
    }) as Promise<{ user: unknown }>,
  signOut: () =>
    authClient.$fetch('/sign-out', {
      method: 'POST',
    }),
  createOrganization: <TOrganization,>(input: { name: string; slug: string }) =>
    authClient.$fetch('/organization/create', {
      method: 'POST',
      body: input,
    }) as Promise<TOrganization>,
  setActiveOrganization: (organizationId: string) =>
    authClient.$fetch('/organization/set-active', {
      method: 'POST',
      body: { organizationId },
    }),
  inviteOrganizationMember: (input: {
    email: string;
    organizationId: string;
    role: string;
  }) =>
    authClient.$fetch('/organization/invite-member', {
      method: 'POST',
      body: {
        ...input,
        role: input.role as OrganizationRole,
      },
    }),
  acceptOrganizationInvitation: <TResponse,>(input: { invitationId: string }) =>
    authClient.$fetch('/organization/accept-invitation', {
      method: 'POST',
      body: input,
    }) as Promise<TResponse>,
  listOrganizations: <TOrganization,>() =>
    apiFetch<Organization[]>('/api/auth/organization/list', {
      method: 'GET',
    }) as Promise<TOrganization[]>,
  listOrganizationInvitations: <TInvitation,>(organizationId: string) =>
    apiFetch<OrganizationInvitation[]>(
      `/api/auth/organization/list-invitations?organizationId=${encodeURIComponent(organizationId)}`,
      {
        method: 'GET',
      }
    ) as Promise<TInvitation[]>,
};

type ProviderProps = React.PropsWithChildren;

export function MobileFeaturesProvider({ children }: ProviderProps) {
  const [queryClient] = React.useState<QueryClient>(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NotelabFeaturesProvider
        value={{
          apiFetch,
          auth: mobileAuthClient,
          queryClient,
        }}>
        {children}
      </NotelabFeaturesProvider>
    </QueryClientProvider>
  );
}
