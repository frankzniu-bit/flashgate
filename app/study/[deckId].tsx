import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { rolloverDayStartMs, selectStudyQueue, scheduleReview, type ReviewRating } from '@flashgate/domain';
import { getDeck } from '../../src/storage/decks';
import { countNewCardsIntroducedToday, listStudyCards, updateCardSchedule } from '../../src/storage/cards';
import { recordReview } from '../../src/storage/reviewLogs';
import type { DeckCard } from '../../src/storage/types';
import { colors, spacing } from '../../src/ui/theme';

const RATINGS: { rating: ReviewRating; label: string }[] = [
  { rating: 'Again', label: 'Again' },
  { rating: 'Hard', label: 'Hard' },
  { rating: 'Good', label: 'Good' },
  { rating: 'Easy', label: 'Easy' },
];

export default function StudySession() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();

  const [cardsById] = useState(() => {
    const map = new Map<string, DeckCard>();
    if (deckId) for (const c of listStudyCards(deckId)) map.set(c.id, c);
    return map;
  });

  const [queue] = useState<string[]>(() => {
    if (!deckId) return [];
    const deck = getDeck(deckId);
    const now = new Date();
    const selectable = Array.from(cardsById.values()).map((c) => ({ id: c.id, schedule: c.schedule }));
    const ordered = selectStudyQueue(selectable, {
      now,
      // Same 4am rollover boundary as the toll engine (§3.4) — not midnight.
      newCardsIntroducedToday: countNewCardsIntroducedToday(deckId, rolloverDayStartMs(now)),
      newCardsPerDayCap: deck?.newCardsPerDay ?? 10,
    });
    return ordered.map((c) => c.id);
  });

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const shownAt = useRef(new Date().getTime());

  const currentId = queue[index];
  const current = currentId ? cardsById.get(currentId) : undefined;

  function rate(rating: ReviewRating) {
    if (!current) return;
    const now = new Date();
    const elapsedMs = now.getTime() - shownAt.current;
    const { schedule } = scheduleReview(current.schedule, rating, now);
    updateCardSchedule(current.id, schedule);
    recordReview(current.id, rating, 'study', elapsedMs, schedule, now.getTime());

    setFlipped(false);
    shownAt.current = now.getTime();
    setIndex((i) => i + 1);
  }

  const progress = useMemo(() => `${Math.min(index + 1, queue.length)} of ${queue.length}`, [index, queue.length]);

  if (queue.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Study' }} />
        <Text style={styles.doneTitle}>Nothing due</Text>
        <Text style={styles.doneBody}>This deck has no cards due for review right now.</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to deck</Text>
        </Pressable>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Study' }} />
        <Text style={styles.doneTitle}>Session complete</Text>
        <Text style={styles.doneBody}>You reviewed {queue.length} card{queue.length === 1 ? '' : 's'}.</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to deck</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Study' }} />
      <Text style={styles.progress}>{progress}</Text>

      <Pressable style={styles.card} onPress={() => setFlipped((f) => !f)}>
        <Text style={styles.cardText}>{flipped ? current.back : current.front}</Text>
        {!flipped && <Text style={styles.tapHint}>Tap to flip</Text>}
      </Pressable>

      {flipped && (
        <View style={styles.ratingRow}>
          {RATINGS.map(({ rating, label }) => (
            <Pressable key={rating} style={styles.ratingButton} onPress={() => rate(rating)}>
              <Text style={styles.ratingButtonText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(6) },
  progress: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing(4), fontVariant: ['tabular-nums'] },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(4),
  },
  cardText: { fontSize: 26, color: colors.text, textAlign: 'center', lineHeight: 34, paddingHorizontal: spacing(4) },
  tapHint: { fontSize: 13, color: colors.textMuted },
  ratingRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(6) },
  ratingButton: {
    flex: 1,
    paddingVertical: spacing(3),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  ratingButtonText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  doneTitle: { fontSize: 22, color: colors.text, fontWeight: '600', textAlign: 'center', marginTop: spacing(20) },
  doneBody: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: spacing(2) },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(3),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing(8),
    marginHorizontal: spacing(6),
  },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
});
