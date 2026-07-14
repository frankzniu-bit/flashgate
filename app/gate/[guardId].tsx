import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  answerGateCard,
  buildMultipleChoiceQuestion,
  currentGateCardId,
  isGateSessionComplete,
  matchesTypedAnswer,
  MIN_DISPLAY_MS,
  planGateSession,
  resolveTollSource,
  scheduleReview,
  startGateSession,
  tollSizeForUnlock,
  type GateSessionState,
  type MultipleChoiceQuestion,
} from '@flashgate/domain';
import { anyCardsExistAnywhere, deckHasCards, getDeck } from '../../src/storage/decks';
import { listAllCards, listCardsInDeck, updateCardSchedule } from '../../src/storage/cards';
import { recordReview } from '../../src/storage/reviewLogs';
import { countUnlocksToday, createGrant } from '../../src/storage/grants';
import { getGuard, setGuardDeck, setGuardPaused } from '../../src/storage/guards';
import { mockGuard } from '../../src/guard/mockGuardInstance';
import type { DeckCard } from '../../src/storage/types';
import { colors, spacing } from '../../src/ui/theme';

type Phase =
  | { kind: 'paused' }
  | { kind: 'shield' }
  | { kind: 'session' }
  | { kind: 'unlocked'; expiresAt: number }
  | { kind: 'expired' };

const DEFAULT_NEW_CARDS_PER_DAY_CAP = 10;

export default function Gate() {
  const { guardId } = useLocalSearchParams<{ guardId: string }>();
  const router = useRouter();

  const guard = useState(() => (guardId ? getGuard(guardId) : null))[0];

  const [phase, setPhase] = useState<Phase>(() => {
    if (!guard) return { kind: 'paused' };
    const hasDeckCards = guard.deckId ? deckHasCards(guard.deckId) : false;
    const anyCards = anyCardsExistAnywhere();
    const source = resolveTollSource(guard.deckId, hasDeckCards, anyCards);
    return source.kind === 'no-cards' ? { kind: 'paused' } : { kind: 'shield' };
  });

  // Persisting the §3.5 fallback (pause the guard, or fall back to "all
  // decks") is a side effect, so it belongs in an effect, not the state
  // initializer above, which React expects to stay pure.
  useEffect(() => {
    if (!guard) return;
    const hasDeckCards = guard.deckId ? deckHasCards(guard.deckId) : false;
    const anyCards = anyCardsExistAnywhere();
    const source = resolveTollSource(guard.deckId, hasDeckCards, anyCards);
    if (source.kind === 'no-cards') {
      setGuardPaused(guard.id, true);
    } else if (source.kind === 'all-decks' && guard.deckId !== null) {
      setGuardDeck(guard.id, null);
    }
  }, [guard]);

  const [cardsById, setCardsById] = useState<Map<string, DeckCard>>(new Map());
  const [gateState, setGateState] = useState<GateSessionState | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Keyed by turn, not card id: the same card can reappear immediately
  // after a miss (requeued), and the 2s minimum display time (§4.4) must
  // reset on every presentation, not just the first time a given id shows.
  const [turn, setTurn] = useState(0);
  const [answerableTurn, setAnswerableTurn] = useState<number | null>(null);
  const [typedInput, setTypedInput] = useState('');
  const shownAt = useRef(new Date().getTime());

  const currentCardId = gateState ? currentGateCardId(gateState) : null;
  const currentCard = currentCardId ? cardsById.get(currentCardId) ?? null : null;
  const canAnswer = answerableTurn === turn;

  const question: MultipleChoiceQuestion | null = useMemo(() => {
    if (!currentCard) return null;
    const deckPool = Array.from(cardsById.values()).map((c) => c.back);
    const fromDeck = buildMultipleChoiceQuestion(currentCard.back, deckPool);
    if (fromDeck) return fromDeck;
    const allPool = listAllCards().map((c) => c.back);
    return buildMultipleChoiceQuestion(currentCard.back, allPool);
  }, [currentCard, cardsById]);

  useEffect(() => {
    if (phase.kind !== 'unlocked') return;
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      if (current.getTime() >= phase.expiresAt) {
        setPhase({ kind: 'expired' });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase.kind !== 'session') return;
    const timer = setTimeout(() => setAnswerableTurn(turn), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [phase, turn]);

  function startSession() {
    if (!guard) return;
    const source = guard.deckId ? listCardsInDeck(guard.deckId) : listAllCards();
    const map = new Map(source.map((c) => [c.id, c]));
    setCardsById(map);

    const unlockNumberToday = countUnlocksToday(guard.id, new Date()) + 1;
    const tollSize = tollSizeForUnlock(guard.tollCards, unlockNumberToday, guard.escalationOn);
    const deck = guard.deckId ? getDeck(guard.deckId) : null;
    const selectable = source.map((c) => ({ id: c.id, schedule: c.schedule }));
    const plan = planGateSession(selectable, tollSize, {
      now: new Date(),
      newCardsIntroducedToday: 0,
      newCardsPerDayCap: deck?.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY_CAP,
    });

    setGateState(startGateSession(plan));
    setTypedInput('');
    setTurn(0);
    setAnswerableTurn(null);
    shownAt.current = new Date().getTime();
    setPhase({ kind: 'session' });
  }

  function submitAnswer(correct: string | boolean) {
    if (!guard || !gateState || !currentCard) return;
    const isCorrect = typeof correct === 'boolean' ? correct : correct === currentCard.back;

    const reviewedAt = new Date();
    const elapsedMs = reviewedAt.getTime() - shownAt.current;
    const result = answerGateCard(gateState, isCorrect);
    const { schedule } = scheduleReview(currentCard.schedule, result.rating, reviewedAt);
    updateCardSchedule(currentCard.id, schedule);
    recordReview(currentCard.id, result.rating, 'gate', elapsedMs, schedule, reviewedAt.getTime());
    setCardsById((prev) => new Map(prev).set(currentCard.id, { ...currentCard, schedule }));

    setGateState(result.state);
    setTypedInput('');
    setTurn((t) => t + 1);
    shownAt.current = new Date().getTime();

    if (isGateSessionComplete(result.state)) {
      const grantedAt = new Date();
      const expiresAt = grantedAt.getTime() + guard.grantMinutes * 60_000;
      createGrant(guard.id, grantedAt.getTime(), expiresAt);
      void mockGuard.grantWindow(guard.appRef, guard.grantMinutes);
      setPhase({ kind: 'unlocked', expiresAt });
    }
  }

  const secondsLeft =
    phase.kind === 'unlocked' ? Math.max(0, Math.ceil((phase.expiresAt - now.getTime()) / 1000)) : 0;

  if (!guard) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: guard.appRef, headerBackVisible: phase.kind !== 'session' }} />

      {phase.kind === 'paused' && (
        <View style={styles.centered}>
          <Text style={styles.title}>Unguarded for now</Text>
          <Text style={styles.body}>
            FlashGate has no cards to show, so this app is unguarded until you add some.
          </Text>
          <Pressable style={styles.button} onPress={() => router.push('/deck/new')}>
            <Text style={styles.buttonText}>Add a deck</Text>
          </Pressable>
        </View>
      )}

      {phase.kind === 'shield' && (
        <View style={styles.centered}>
          <Text style={styles.title}>{guard.appRef}</Text>
          <Text style={styles.body}>You’ve reached today’s limit for this app.</Text>
          <Pressable style={styles.button} onPress={startSession}>
            <Text style={styles.buttonText}>Review to unlock</Text>
          </Pressable>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.quietLink}>Not now</Text>
          </Pressable>
        </View>
      )}

      {phase.kind === 'session' && gateState && currentCard && (
        <View style={styles.sessionContainer}>
          <Text style={styles.progress}>
            {gateState.correctCount} of {gateState.tollSize} — earns {guard.grantMinutes} more minutes
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardText}>{currentCard.front}</Text>
          </View>

          {question ? (
            <View style={styles.optionsColumn}>
              {question.options.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.optionButton, !canAnswer && styles.optionButtonDisabled]}
                  disabled={!canAnswer}
                  onPress={() => submitAnswer(option === currentCard.back)}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.typedRow}>
              <TextInput
                style={styles.typedInput}
                value={typedInput}
                onChangeText={setTypedInput}
                placeholder="Type your answer"
                placeholderTextColor={colors.textMuted}
                editable={canAnswer}
                autoCapitalize="none"
              />
              <Pressable
                style={[styles.button, !canAnswer && styles.optionButtonDisabled]}
                disabled={!canAnswer}
                onPress={() => submitAnswer(matchesTypedAnswer(typedInput, currentCard.back))}
              >
                <Text style={styles.buttonText}>Submit</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {phase.kind === 'unlocked' && (
        <View style={styles.centered}>
          <Text style={styles.title}>Unlocked</Text>
          <Text style={styles.body}>
            That’s {guard.grantMinutes} minutes — the shield returns after.
          </Text>
          <Text style={styles.countdown}>{secondsLeft}s</Text>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Back to MockGuard</Text>
          </Pressable>
        </View>
      )}

      {phase.kind === 'expired' && (
        <View style={styles.centered}>
          <Text style={styles.title}>Time’s up</Text>
          <Text style={styles.body}>Want back in?</Text>
          <Pressable style={styles.button} onPress={() => setPhase({ kind: 'shield' })}>
            <Text style={styles.buttonText}>Review to unlock</Text>
          </Pressable>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.quietLink}>Not now</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(8), gap: spacing(3) },
  title: { fontSize: 24, fontWeight: '600', color: colors.text, textAlign: 'center' },
  body: { fontSize: 16, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  countdown: { fontSize: 32, color: colors.accent, fontVariant: ['tabular-nums'], fontWeight: '600' },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(8),
    borderRadius: 8,
    marginTop: spacing(3),
  },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
  quietLink: { color: colors.textMuted, fontSize: 14 },
  sessionContainer: { flex: 1, padding: spacing(6), gap: spacing(4) },
  progress: { fontSize: 13, color: colors.textMuted, textAlign: 'center', fontVariant: ['tabular-nums'] },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardText: { fontSize: 24, color: colors.text, textAlign: 'center', lineHeight: 32 },
  optionsColumn: { gap: spacing(2), marginBottom: spacing(6) },
  optionButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing(3), alignItems: 'center' },
  optionButtonDisabled: { opacity: 0.4 },
  optionText: { fontSize: 15, color: colors.text },
  typedRow: { gap: spacing(3), marginBottom: spacing(6) },
  typedInput: { fontSize: 16, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing(2) },
});
