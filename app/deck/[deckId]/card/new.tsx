import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createCard } from '../../../../src/storage/cards';
import { colors, spacing } from '../../../../src/ui/theme';

export default function NewCard() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  function submit() {
    if (!deckId || !front.trim() || !back.trim()) return;
    createCard(deckId, front.trim(), back.trim());
    setFront('');
    setBack('');
    router.back();
  }

  const canSubmit = front.trim().length > 0 && back.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Front</Text>
      <TextInput
        style={styles.input}
        value={front}
        onChangeText={setFront}
        placeholder="Question or term"
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus
      />
      <Text style={styles.label}>Back</Text>
      <TextInput
        style={styles.input}
        value={back}
        onChangeText={setBack}
        placeholder="Answer or definition"
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <Pressable style={[styles.button, !canSubmit && styles.buttonDisabled]} onPress={submit} disabled={!canSubmit}>
        <Text style={styles.buttonText}>Add card</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(6), gap: spacing(2) },
  label: { fontSize: 14, color: colors.textMuted, marginTop: spacing(6) },
  input: {
    fontSize: 18,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing(2),
    minHeight: spacing(12),
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
});
