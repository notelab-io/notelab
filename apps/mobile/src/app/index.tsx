import { useSession, useSignOut } from '@notelab/features/auth';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { TopBarInset } from '@/components/top-bar';
import { Button } from '@/components/ui/button';
import { Text as UiText } from '@/components/ui/text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  const session = useSession();
  const signOut = useSignOut();
  const user = session.data?.user;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome back
          </ThemedText>
          <ThemedText type="smallBold" style={styles.name}>
            {user?.name ?? 'Notelab member'}
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          {user?.email ?? 'signed-in session'}
        </ThemedText>

        <Button
          className="w-full max-w-sm"
          disabled={signOut.isPending}
          onPress={() => {
            signOut.mutate();
          }}>
          <UiText>{signOut.isPending ? 'Signing out...' : 'Sign out'}</UiText>
        </Button>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <ThemedText type="subtitle">Your mobile auth flow is live.</ThemedText>
          <ThemedText>
            This screen is gated by the shared features package and Better Auth Expo session cookie.
          </ThemedText>
          <ThemedText>
            The current login screen supports email OTP sign-in and email verification after sign-up.
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: TopBarInset + Spacing.two,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  name: {
    textAlign: 'center',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
