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
import { WorkspaceItemViewer } from '@/components/workspace-item-viewer';
import { WorkspaceAuthScreen } from '@/components/workspace-auth-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NAV_THEME } from '@/lib/theme';
import { MobileFeaturesProvider } from '@/providers/mobile-features-provider';
import { MobileViewerProvider, useMobileViewer } from '@/providers/mobile-viewer-provider';
import { useSession } from '@notelab/features/auth';
import * as React from 'react';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? NAV_THEME.dark : NAV_THEME.light}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AnimatedSplashOverlay />
        <MobileFeaturesProvider>
          <MobileViewerProvider>
            <AuthenticatedApp />
          </MobileViewerProvider>
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

  const user = session.data?.user;

  if (!user) {
    return <AuthScreen />;
  }

  return <WorkspaceResolvedApp key={user.id} />;
}

function WorkspaceResolvedApp() {
  const session = useSession();
  const { closeItem, selectedItem } = useMobileViewer();
  const [isWorkspaceReady, setIsWorkspaceReady] = React.useState(false);
  const user = session.data?.user;

  if (!user) {
    return <LoadingScreen />;
  }

  if (!isWorkspaceReady) {
    return <WorkspaceAuthScreen onComplete={() => setIsWorkspaceReady(true)} />;
  }

  if (selectedItem) {
    return (
      <View style={{ flex: 1 }}>
        <WorkspaceItemViewer item={selectedItem} />
        <TopBar authBack={{ visible: true, onPress: closeItem }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
      <TopBar user={user} />
    </View>
  );
}
