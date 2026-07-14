import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { checkClockAndExpireGrantsIfJumped } from '../src/storage/clock';

export default function RootLayout() {
  // §3.5: a backwards clock jump larger than the grant window expires all
  // grants. Launch is the natural checkpoint — a user who set the clock
  // back to stretch a grant has to relaunch to reach the guarded app.
  useEffect(() => {
    checkClockAndExpireGrantsIfJumped();
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FAFAF9' },
        }}
      />
      <StatusBar style="dark" />
    </>
  );
}
