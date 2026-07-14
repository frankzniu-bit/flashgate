import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FlashGate</Text>
      <Text style={styles.body}>
        No decks yet. Add cards to start studying — and to give your gates
        something to ask you.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: '#FAFAF9',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1C1B1A',
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#57534E',
    textAlign: 'center',
    maxWidth: 320,
  },
});
