import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createDeck } from '../../src/storage/decks';
import { colors, spacing } from '../../src/ui/theme';

export default function NewDeck() {
  const router = useRouter();
  const [name, setName] = useState('');

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const deck = createDeck(trimmed);
    router.replace(`/deck/${deck.id}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Deck name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Spanish vocab"
        placeholderTextColor={colors.textMuted}
        autoFocus
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <Pressable
        style={[styles.button, !name.trim() && styles.buttonDisabled]}
        onPress={submit}
        disabled={!name.trim()}
      >
        <Text style={styles.buttonText}>Create deck</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(6), gap: spacing(3) },
  label: { fontSize: 14, color: colors.textMuted, marginTop: spacing(10) },
  input: {
    fontSize: 20,
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
    marginTop: spacing(4),
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
});
