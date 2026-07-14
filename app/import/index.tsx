import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  detectDelimiter,
  detectPasteDelimiters,
  importDelimited,
  parsePastedSet,
} from '@flashgate/domain';
import { createDeck } from '../../src/storage/decks';
import { createCards } from '../../src/storage/cards';
import { colors, spacing } from '../../src/ui/theme';

export default function Import() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [quotedCsvMode, setQuotedCsvMode] = useState(false);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [termDelimiter, setTermDelimiter] = useState('\t');
  const [rowDelimiter, setRowDelimiter] = useState('\n');
  const [csvDelimiter, setCsvDelimiter] = useState(',');
  const [deckName, setDeckName] = useState('');
  const [delimitersTouched, setDelimitersTouched] = useState(false);

  const result = useMemo(() => {
    if (!text.trim()) return { cards: [], skipped: [] };
    if (quotedCsvMode) {
      return importDelimited(text, { delimiter: csvDelimiter, hasHeaderRow });
    }
    return parsePastedSet(text, { termDelimiter, rowDelimiter });
  }, [text, quotedCsvMode, hasHeaderRow, termDelimiter, rowDelimiter, csvDelimiter]);

  function onChangeText(value: string) {
    setText(value);
    if (!delimitersTouched && value.trim()) {
      const csv = detectDelimiter(value);
      const paste = detectPasteDelimiters(value);
      setCsvDelimiter(csv);
      setTermDelimiter(paste.termDelimiter);
      setRowDelimiter(paste.rowDelimiter);
    }
  }

  function markDelimitersTouched() {
    setDelimitersTouched(true);
  }

  function commit() {
    const name = deckName.trim();
    if (!name || result.cards.length === 0) return;
    const deck = createDeck(name, 10, quotedCsvMode ? 'csv' : 'quizlet');
    createCards(deck.id, result.cards);
    router.replace(`/deck/${deck.id}`);
  }

  const canCommit = deckName.trim().length > 0 && result.cards.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Import' }} />

      <Text style={styles.label}>Paste exported text</Text>
      <TextInput
        style={styles.pasteBox}
        value={text}
        onChangeText={onChangeText}
        placeholder={'mitochondria\tthe powerhouse of the cell\nphotosynthesis\t...'}
        placeholderTextColor={colors.textMuted}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.row}>
        <Text style={styles.switchLabel}>This is a CSV file with quoted fields</Text>
        <Switch value={quotedCsvMode} onValueChange={setQuotedCsvMode} />
      </View>

      {quotedCsvMode ? (
        <>
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>Column delimiter</Text>
            <TextInput
              style={styles.delimiterInput}
              value={csvDelimiter}
              onChangeText={(v) => { setCsvDelimiter(v); markDelimitersTouched(); }}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.switchLabel}>First row is a header</Text>
            <Switch value={hasHeaderRow} onValueChange={setHasHeaderRow} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>Between term and definition</Text>
            <TextInput
              style={styles.delimiterInput}
              value={termDelimiter}
              onChangeText={(v) => { setTermDelimiter(v); markDelimitersTouched(); }}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>Between rows</Text>
            <TextInput
              style={styles.delimiterInput}
              value={rowDelimiter === '\n' ? '\\n' : rowDelimiter}
              onChangeText={(v) => { setRowDelimiter(v === '\\n' ? '\n' : v); markDelimitersTouched(); }}
            />
          </View>
        </>
      )}

      <Text style={styles.previewSummary}>
        {result.cards.length} card{result.cards.length === 1 ? '' : 's'} ready
        {result.skipped.length > 0 ? `, ${result.skipped.length} row${result.skipped.length === 1 ? '' : 's'} skipped` : ''}
      </Text>

      {result.cards.slice(0, 5).map((card, i) => (
        <View key={i} style={styles.previewRow}>
          <Text style={styles.previewFront} numberOfLines={1}>{card.front}</Text>
          <Text style={styles.previewBack} numberOfLines={1}>{card.back}</Text>
        </View>
      ))}
      {result.cards.length > 5 && (
        <Text style={styles.previewMore}>+{result.cards.length - 5} more</Text>
      )}

      <Text style={styles.label}>Deck name</Text>
      <TextInput
        style={styles.input}
        value={deckName}
        onChangeText={setDeckName}
        placeholder="Imported deck"
        placeholderTextColor={colors.textMuted}
      />

      <Pressable style={[styles.button, !canCommit && styles.buttonDisabled]} onPress={commit} disabled={!canCommit}>
        <Text style={styles.buttonText}>Import {result.cards.length} card{result.cards.length === 1 ? '' : 's'}</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/import/help')}>
        <Text style={styles.helpLink}>How do I export from Quizlet or Knowt?</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(6), paddingBottom: spacing(16), gap: spacing(2) },
  label: { fontSize: 14, color: colors.textMuted, marginTop: spacing(6) },
  fieldLabel: { fontSize: 14, color: colors.textMuted, flex: 1 },
  pasteBox: {
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing(3),
    minHeight: spacing(30),
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing(3) },
  delimiterInput: {
    fontSize: 14,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(2),
    minWidth: spacing(12),
    textAlign: 'center',
  },
  switchLabel: { fontSize: 14, color: colors.text, flex: 1 },
  previewSummary: { fontSize: 13, color: colors.textMuted, marginTop: spacing(6), fontVariant: ['tabular-nums'] },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(3),
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  previewFront: { fontSize: 14, color: colors.text, flex: 1 },
  previewBack: { fontSize: 14, color: colors.textMuted, flex: 1, textAlign: 'right' },
  previewMore: { fontSize: 13, color: colors.textMuted, marginTop: spacing(1) },
  input: {
    fontSize: 18,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing(2),
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(3),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing(6),
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
  helpLink: { color: colors.accent, fontSize: 14, textAlign: 'center', marginTop: spacing(6) },
});
