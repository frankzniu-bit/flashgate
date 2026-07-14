import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as native from '../../modules/flashgate-guard';
import { getGuardByAppRef } from '../../src/storage/guards';
import type { GuardableApp } from '../../src/guard/AppGuard';
import type { Guard } from '../../src/storage/types';
import { colors, spacing } from '../../src/ui/theme';

interface AppRow {
  app: GuardableApp;
  guard: Guard | null;
}

export default function AndroidGuardHome() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AppRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      if (!native.hasUsageAccess()) {
        setReady(false);
        return;
      }
      setReady(true);
      const apps = native.listInstalledApps();
      setRows(apps.map((app) => ({ app, guard: getGuardByAppRef(app.id) })));
    }, []),
  );

  if (Platform.OS !== 'android') {
    return (
      <View style={styles.container}>
        <Text style={styles.body}>AndroidGuard only runs on Android.</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.container}>
        <Text style={styles.body}>FlashGate needs usage access before it can guard apps.</Text>
        <Pressable style={styles.button} onPress={() => router.push('/android-guard/permissions')}>
          <Text style={styles.buttonText}>Set up permissions</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(row) => row.app.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => router.push(`/android-guard/setup/${item.app.id}`)}
        >
          <Text style={styles.appName}>{item.app.displayName}</Text>
          <Text style={styles.status}>
            {item.guard ? `${item.guard.dailyLimitMin} min/day` : 'Not guarded'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(6), gap: spacing(3) },
  list: { paddingBottom: spacing(8) },
  body: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  button: { backgroundColor: colors.accent, paddingVertical: spacing(3), borderRadius: 8, alignItems: 'center' },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  appName: { fontSize: 15, color: colors.text },
  status: { fontSize: 13, color: colors.textMuted },
});
