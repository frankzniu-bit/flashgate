import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import * as native from '../../modules/flashgate-guard';
import { colors, spacing } from '../../src/ui/theme';

/**
 * Plain-language explanation before each OS prompt (§3.1: "App requests the
 * platform permissions it needs with a plain-language explanation screen
 * *before* each OS prompt"). Usage access is special access granted via
 * Settings, not a runtime dialog, so this screen re-checks on focus rather
 * than getting a direct callback.
 */
export default function AndroidGuardPermissions() {
  const router = useRouter();
  const [usageGranted, setUsageGranted] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      setUsageGranted(native.hasUsageAccess());
      setNotifGranted(native.hasNotificationPermission());
    }, []),
  );

  if (Platform.OS !== 'android') {
    return (
      <View style={styles.container}>
        <Text style={styles.body}>AndroidGuard only runs on Android.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Permissions' }} />

      {!usageGranted ? (
        <View style={styles.step}>
          <Text style={styles.title}>Usage access</Text>
          <Text style={styles.body}>
            FlashGate needs to see which app is in the foreground and for how long, so it can
            tell when a guarded app has reached its daily limit. This is a special Android
            permission granted from Settings, not an in-app prompt.
          </Text>
          <Pressable style={styles.button} onPress={() => native.openUsageAccessSettings()}>
            <Text style={styles.buttonText}>Continue to Settings</Text>
          </Pressable>
        </View>
      ) : !notifGranted ? (
        <View style={styles.step}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.body}>
            The guard runs as a foreground service, which Android requires to show a persistent,
            low-priority notification while it’s active. FlashGate doesn’t send any other
            notifications unless you turn them on in settings.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              void native.requestNotificationPermission().finally(() => {
                setNotifGranted(native.hasNotificationPermission());
              });
            }}
          >
            <Text style={styles.buttonText}>Allow</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.step}>
          <Text style={styles.title}>All set</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/android-guard')}>
            <Text style={styles.buttonText}>Choose apps to guard</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(6), justifyContent: 'center' },
  step: { gap: spacing(3) },
  title: { fontSize: 20, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  button: { backgroundColor: colors.accent, paddingVertical: spacing(3), borderRadius: 8, alignItems: 'center', marginTop: spacing(2) },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
});
