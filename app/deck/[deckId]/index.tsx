import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { countDueCards, deleteDeck, getDeck } from '../../../src/storage/decks';
import { deleteCard, listCardsInDeck } from '../../../src/storage/cards';
import type { Deck, DeckCard } from '../../../src/storage/types';
import { colors, spacing } from '../../../src/ui/theme';

export default function DeckDetail() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [dueCount, setDueCount] = useState(0);

  const reload = useCallback(() => {
    if (!deckId) return;
    setDeck(getDeck(deckId));
    setCards(listCardsInDeck(deckId));
    setDueCount(countDueCards(deckId));
  }, [deckId]);

  useFocusEffect(reload);

  if (!deck) return null;

  function confirmDeleteDeck() {
    Alert.alert('Delete deck?', `"${deck!.name}" and all its cards will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteDeck(deck!.id);
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: deck.name }} />
      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryButton, cards.length === 0 && styles.buttonDisabled]}
          disabled={cards.length === 0}
          onPress={() => router.push(`/study/${deck.id}`)}
        >
          <Text style={styles.primaryButtonText}>
            {dueCount === 0 ? 'Study (nothing due)' : `Study — ${dueCount} due`}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/deck/${deck.id}/card/new`)}>
          <Text style={styles.secondaryButtonText}>Add card</Text>
        </Pressable>
      </View>

      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No cards yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cardRow}
            onPress={() => router.push(`/deck/${deck.id}/card/${item.id}`)}
            onLongPress={() => {
              Alert.alert('Delete card?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { deleteCard(item.id); reload(); } },
              ]);
            }}
          >
            <Text style={styles.cardFront} numberOfLines={1}>{item.front}</Text>
            <Text style={styles.cardState}>{item.schedule.state}</Text>
          </Pressable>
        )}
      />

      <Pressable onPress={confirmDeleteDeck}>
        <Text style={styles.deleteText}>Delete deck</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(6) },
  actions: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(4), marginBottom: spacing(4) },
  primaryButton: { flex: 1, backgroundColor: colors.accent, paddingVertical: spacing(3), borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: colors.accentText, fontSize: 15, fontWeight: '600' },
  secondaryButton: { paddingVertical: spacing(3), paddingHorizontal: spacing(4), borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  buttonDisabled: { opacity: 0.4 },
  list: { paddingBottom: spacing(4) },
  empty: { color: colors.textMuted, fontSize: 15, marginTop: spacing(6) },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardFront: { fontSize: 15, color: colors.text, flex: 1, marginRight: spacing(3) },
  cardState: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase' },
  deleteText: { color: colors.danger, fontSize: 14, textAlign: 'center', paddingVertical: spacing(4) },
});
