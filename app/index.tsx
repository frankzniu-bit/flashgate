import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { countDueCards, listDecks } from '../src/storage/decks';
import type { Deck } from '../src/storage/types';
import { colors, spacing } from '../src/ui/theme';

interface DeckRow {
  deck: Deck;
  dueCount: number;
}

export default function Home() {
  const router = useRouter();
  const [rows, setRows] = useState<DeckRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      const decks = listDecks();
      setRows(decks.map((deck) => ({ deck, dueCount: countDueCards(deck.id) })));
    }, []),
  );

  return (
    <View style={styles.container}>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.title}>FlashGate</Text>
          <Text style={styles.body}>
            No decks yet. Add cards to start studying — and to give your
            gates something to ask you.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/deck/new')}>
            <Text style={styles.primaryButtonText}>New deck</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/import')}>
            <Text style={styles.headerAction}>Import from Quizlet, Knowt, or CSV</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/mock-guard')}>
            <Text style={styles.headerAction}>MockGuard</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.deck.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>FlashGate</Text>
              <View style={styles.headerActions}>
                <Pressable onPress={() => router.push('/mock-guard')}>
                  <Text style={styles.headerAction}>MockGuard</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/import')}>
                  <Text style={styles.headerAction}>Import</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/deck/new')}>
                  <Text style={styles.headerAction}>New deck</Text>
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.deckRow}
              onPress={() => router.push(`/deck/${item.deck.id}`)}
            >
              <Text style={styles.deckName}>{item.deck.name}</Text>
              <Text style={styles.deckDue}>
                {item.dueCount === 0 ? 'nothing due' : `${item.dueCount} due`}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(8),
    gap: spacing(3),
  },
  list: { paddingHorizontal: spacing(6), paddingTop: spacing(14), paddingBottom: spacing(8) },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing(6),
  },
  headerActions: { flexDirection: 'row', gap: spacing(4) },
  title: { fontSize: 28, fontWeight: '600', color: colors.text, letterSpacing: -0.5 },
  headerAction: { fontSize: 16, color: colors.accent, fontWeight: '500' },
  body: { fontSize: 16, lineHeight: 24, color: colors.textMuted, textAlign: 'center', maxWidth: 320 },
  deckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  deckName: { fontSize: 17, color: colors.text, fontWeight: '500' },
  deckDue: { fontSize: 15, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(6),
    borderRadius: 8,
    marginTop: spacing(2),
  },
  primaryButtonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
});
