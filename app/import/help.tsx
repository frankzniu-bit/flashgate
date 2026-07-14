import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { colors, spacing } from '../../src/ui/theme';

function Step({ n, children }: { n: number; children: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{n}</Text>
      <Text style={styles.stepText}>{children}</Text>
    </View>
  );
}

export default function ImportHelp() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Exporting your cards' }} />

      <Text style={styles.sectionTitle}>From Quizlet</Text>
      <Step n={1}>Open the set you want to bring in at quizlet.com.</Step>
      <Step n={2}>Choose Export from the set’s options menu.</Step>
      <Step n={3}>
        Set “Between term and definition” and “Between rows” — Quizlet
        defaults to Tab and newline, which FlashGate detects automatically.
      </Step>
      <Step n={4}>Select all the exported text and copy it.</Step>
      <Step n={5}>Come back here, paste it into the box, and check the preview before importing.</Step>

      <Text style={styles.sectionTitle}>From Knowt</Text>
      <Step n={1}>Open the set you want to bring in at knowt.com.</Step>
      <Step n={2}>
        Use Knowt’s export option to get a CSV or Quizlet-compatible text
        export. Knowt has changed this flow before, so if these steps don’t
        match what you see, look for “Export” or “Download” in the set’s
        menu.
      </Step>
      <Step n={3}>Copy the exported text, or open the downloaded file and copy its contents.</Step>
      <Step n={4}>Paste it into the box on the Import screen and check the preview before importing.</Step>

      <Text style={styles.note}>
        FlashGate never connects to Quizlet or Knowt directly — it only reads
        text you copy and paste yourself. Nothing leaves your device during
        an import.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(6), paddingBottom: spacing(12), gap: spacing(2) },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: spacing(6), marginBottom: spacing(2) },
  step: { flexDirection: 'row', gap: spacing(3), paddingVertical: spacing(2) },
  stepNumber: { fontSize: 14, color: colors.accent, fontWeight: '700', width: spacing(5) },
  stepText: { fontSize: 15, color: colors.text, flex: 1, lineHeight: 22 },
  note: { fontSize: 13, color: colors.textMuted, marginTop: spacing(8), lineHeight: 20 },
});
