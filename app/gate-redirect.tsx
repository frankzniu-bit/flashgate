import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getGuardByAppRef } from '../src/storage/guards';
import { colors } from '../src/ui/theme';

/**
 * Landing point for AndroidGuard's BlockingActivity deep link
 * (`flashgate://gate-redirect?pkg=...`, §6.5) — resolves the Android
 * package name to a guard id and hands off to the same gate screen
 * MockGuard uses (app/gate/[guardId].tsx). Mirrors the handoff pattern
 * §6.6 describes for iOS's Darwin-notification approach.
 */
export default function GateRedirect() {
  const { pkg } = useLocalSearchParams<{ pkg?: string }>();
  const router = useRouter();

  useEffect(() => {
    // The deep link is an OS-level entry point any app can fire; accept
    // only something shaped like an Android package name before touching
    // storage with it.
    if (!pkg || pkg.length > 256 || !/^[a-zA-Z0-9._]+$/.test(pkg)) {
      router.replace('/');
      return;
    }
    const guard = getGuardByAppRef(pkg);
    if (guard) {
      router.replace(`/gate/${guard.id}`);
    } else {
      router.replace('/');
    }
  }, [pkg, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Opening FlashGate…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { fontSize: 15, color: colors.textMuted },
});
