import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const API_BASE_URL = resolveApiBaseUrl();
export const WEB_APP_BASE_URL = resolveWebAppBaseUrl();

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  return resolveBaseUrl(3000);
}

function resolveWebAppBaseUrl() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  return resolveBaseUrl(1420);
}

function resolveBaseUrl(port: number) {
  const loopbackHost = port === 3000 ? '127.0.0.1' : 'localhost';

  if (Platform.OS === 'ios' && !Device.isDevice) {
    return `http://${loopbackHost}:${port}`;
  }

  if (Platform.OS === 'android' && !Device.isDevice) {
    return `http://10.0.2.2:${port}`;
  }

  const hostname = readExpoHostname();

  if (hostname) {
    return `http://${hostname}:${port}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${port}`;
  }

  return `http://localhost:${port}`;
}

function readExpoHostname() {
  for (const candidate of getExpoHostCandidates()) {
    const hostname = parseHostname(candidate);

    if (hostname) {
      return hostname;
    }
  }

  return null;
}

function getExpoHostCandidates() {
  const constants = Constants as typeof Constants & {
    expoGoConfig?: { debuggerHost?: string | null };
    manifest2?: {
      extra?: {
        expoClient?: { hostUri?: string | null };
        expoGo?: { debuggerHost?: string | null };
      };
    };
  };

  return [
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
    constants.expoGoConfig?.debuggerHost,
    constants.manifest2?.extra?.expoClient?.hostUri,
    constants.manifest2?.extra?.expoGo?.debuggerHost,
  ];
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
