import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL } from '@/lib/api-base-url';

export const authClient = createAuthClient({
  baseURL: `${API_BASE_URL}/api/auth`,
  plugins: [
    expoClient({
      scheme: 'mobile',
      storage: SecureStore,
      storagePrefix: 'notelab-mobile',
    }),
  ],
});
