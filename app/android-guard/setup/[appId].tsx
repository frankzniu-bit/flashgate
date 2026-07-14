import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { listDecks } from '../../../src/storage/decks';
import { createGuard, getGuardByAppRef, updateGuardConfig } from '../../../src/storage/guards';
import { syncAndroidGuards } from '../../../src/guard/syncAndroidGuards';
import { colors, spacing } from '../../../src/ui/theme';

export default function AndroidGuardSetup() {
  const { appId } = useLocalSearchParams<{ appId: string }>();
  const router = useRouter();
  const decks = useState(() => listDecks())[0];
  const existing = useState(() => (appId ? getGuardByAppRef(appId) : null))[0];

  const [dailyLimitMin, setDailyLimitMin] = useState(String(existing?.dailyLimitMin ?? 30));
  const [deckId, setDeckId] = useState<string | null>(existing?.deckId ?? decks[0]?.id ?? null);
  const [tollCards, setTollCards] = useState(String(existing?.tollCards ?? 5));
  const [grantMinutes, setGrantMinutes] = useState(String(existing?.grantMinutes ?? 10));
  const [escalationOn, setEscalationOn] = useState(existing?.escalationOn ?? true);

  function submit() {
    if (!appId) return;
    const options = {
      dailyLimitMin: Math.max(1, parseInt(dailyLimitMin, 10) || 30),
      deckId,
      tollCards: Math.max(1, parseInt(tollCards, 10) || 5),
      grantMinutes: Math.max(1, parseInt(grantMinutes, 10) || 10),
      escalationOn,
    };
    if (existing) {
      updateGuardConfig(existing.id, options);
    } else {
      createGuard(appId, { ...options, platform: 'android' });
    }
    void syncAndroidGuards();
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `Guard: ${appId}` }} />

      <Text style={styles.label}>Daily limit (minutes)</Text>
      <TextInput
        style={styles.input}
        value={dailyLimitMin}
        onChangeText={setDailyLimitMin}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Deck (toll source)</Text>
      {decks.length === 0 ? (
        <Text style={styles.warning}>No decks yet — add one first, or the guard will pause itself.</Text>
      ) : (
        <View style={styles.deckList}>
          <Pressable
            style={[styles.deckOption, deckId === null && styles.deckOptionSelected]}
            onPress={() => setDeckId(null)}
          >
            <Text style={styles.deckOptionText}>All decks</Text>
          </Pressable>
          {decks.map((deck) => (
            <Pressable
              key={deck.id}
              style={[styles.deckOption, deckId === deck.id && styles.deckOptionSelected]}
              onPress={() => setDeckId(deck.id)}
            >
              <Text style={styles.deckOptionText}>{deck.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Toll (cards to unlock)</Text>
      <TextInput style={styles.input} value={tollCards} onChangeText={setTollCards} keyboardType="number-pad" />

      <Text style={styles.label}>Grant length (minutes)</Text>
      <TextInput style={styles.input} value={grantMinutes} onChangeText={setGrantMinutes} keyboardType="number-pad" />

      <View style={styles.row}>
        <Text style={styles.switchLabel}>Escalate toll on repeated unlocks</Text>
        <Switch value={escalationOn} onValueChange={setEscalationOn} />
      </View>

      <Pressable style={styles.button} onPress={submit}>
        <Text style={styles.buttonText}>{existing ? 'Save' : 'Create guard'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(6), paddingBottom: spacing(12), gap: spacing(2) },
  label: { fontSize: 14, color: colors.textMuted, marginTop: spacing(6) },
  warning: { fontSize: 13, color: colors.danger },
  input: {
    fontSize: 18,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing(2),
  },
  deckList: { gap: spacing(2) },
  deckOption: { paddingVertical: spacing(2), paddingHorizontal: spacing(3), borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  deckOptionSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
  deckOptionText: { fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing(6) },
  switchLabel: { fontSize: 14, color: colors.text, flex: 1 },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(3),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing(8),
  },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
});
