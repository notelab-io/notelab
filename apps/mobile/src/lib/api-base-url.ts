import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const API_BASE_URL = resolveApiBaseUrl();

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (Platform.OS === 'ios' && !Device.isDevice) {
    return 'http://127.0.0.1:3000';
  }

  if (Platform.OS === 'android' && !Device.isDevice) {
    return 'http://10.0.2.2:3000';
  }

  const hostname = readExpoHostname();

  if (hostname) {
    return `http://${hostname}:3000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

function readExpoHostname() {
  const hostUri = Constants.expoConfig?.hostUri;
  const hostFromExpoConfig = parseHostname(hostUri);

  if (hostFromExpoConfig) {
    return hostFromExpoConfig;
  }

  const hostFromLinkingUri = parseHostname(Constants.linkingUri);

  if (hostFromLinkingUri) {
    return hostFromLinkingUri;
  }

  return null;
}

function parseHostname(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    if (value.includes('://')) {
      return new URL(value).hostname;
    }

    return new URL(`http://${value}`).hostname;
  } catch {
    return null;
  }
}
