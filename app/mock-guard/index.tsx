import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getActiveGrant } from '../../src/storage/grants';
import { getGuardByAppRef } from '../../src/storage/guards';
import { mockGuard } from '../../src/guard/mockGuardInstance';
import type { GuardableApp } from '../../src/guard/AppGuard';
import type { Guard } from '../../src/storage/types';
import { colors, spacing } from '../../src/ui/theme';

interface AppRow {
  app: GuardableApp;
  guard: Guard | null;
  activeGrantMinutesLeft: number | null;
}

function minutesLeft(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000));
}

export default function MockGuardDebug() {
  const router = useRouter();
  const [rows, setRows] = useState<AppRow[]>([]);

  const reload = useCallback(() => {
    let cancelled = false;
    mockGuard.listInstalledApps().then((apps) => {
      if (cancelled) return;
      const now = new Date();
      setRows(
        apps.map((app) => {
          const guard = getGuardByAppRef(app.id);
          const activeGrant = guard ? getActiveGrant(guard.id, now.getTime()) : null;
          return {
            app,
            guard,
            activeGrantMinutesLeft: activeGrant ? minutesLeft(activeGrant.expiresAt, now) : null,
          };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  function simulateOpen(row: AppRow) {
    if (!row.guard) return;
    if (row.guard.paused) {
      Alert.alert(
        'Guard paused',
        `FlashGate has no cards to show, so ${row.app.displayName} is unguarded until you add some.`,
      );
      return;
    }
    if (row.activeGrantMinutesLeft !== null) {
      Alert.alert('Already unlocked', `${row.activeGrantMinutesLeft} minute(s) left on this grant.`);
      return;
    }
    router.push(`/gate/${row.guard.id}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        MockGuard simulates the OS-level blocker entirely inside the app — this is the default
        way to develop and test the gate loop without a physical device (§6.4).
      </Text>

      {rows.map((row) => (
        <View key={row.app.id} style={styles.card}>
          <Text style={styles.appName}>{row.app.displayName}</Text>

          {row.guard ? (
            <>
              <Text style={styles.detail}>
                {row.guard.dailyLimitMin} min/day · toll {row.guard.tollCards} cards · grant{' '}
                {row.guard.grantMinutes} min
                {row.guard.escalationOn ? ' · escalation on' : ''}
              </Text>
              {row.guard.paused ? (
                <Text style={styles.status}>Paused — no cards to show</Text>
              ) : row.activeGrantMinutesLeft !== null ? (
                <Text style={styles.status}>Unlocked — {row.activeGrantMinutesLeft} min left</Text>
              ) : (
                <Text style={styles.status}>Blocked</Text>
              )}
              <Pressable style={styles.primaryButton} onPress={() => simulateOpen(row)}>
                <Text style={styles.primaryButtonText}>Simulate: open app now</Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/mock-guard/setup/${row.app.id}`)}>
                <Text style={styles.editLink}>Edit guard</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push(`/mock-guard/setup/${row.app.id}`)}
            >
              <Text style={styles.secondaryButtonText}>Set up guard</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(6), gap: spacing(4) },
  intro: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing(4),
    gap: spacing(2),
  },
  appName: { fontSize: 17, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
  status: { fontSize: 13, color: colors.text, fontWeight: '500' },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(2.5),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing(1),
  },
  primaryButtonText: { color: colors.accentText, fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    paddingVertical: spacing(2.5),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  editLink: { color: colors.accent, fontSize: 13, textAlign: 'center' },
});
