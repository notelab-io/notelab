import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthScreen } from '@/components/auth-screen';
import AppTabs from '@/components/app-tabs';
import { LoadingScreen } from '@/components/loading-screen';
import { TopBar } from '@/components/top-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NAV_THEME } from '@/lib/theme';
import { MobileFeaturesProvider } from '@/providers/mobile-features-provider';
import { useSession } from '@notelab/features/auth';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? NAV_THEME.dark : NAV_THEME.light}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AnimatedSplashOverlay />
        <MobileFeaturesProvider>
          <AuthenticatedApp />
        </MobileFeaturesProvider>
        <PortalHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AuthenticatedApp() {
  const session = useSession();

  if (session.isPending) {
    return <LoadingScreen />;
  }

  if (!session.data?.user) {
    return <AuthScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
      <TopBar user={session.data.user} />
    </View>
  );
}
