import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

export function LoadingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <AnimatedIcon />
        <ActivityIndicator size="small" color="#111827" />
        <Text style={styles.text}>Restoring your session…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE7',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  text: {
    fontSize: 15,
    color: 'rgba(17, 24, 39, 0.72)',
  },
});
