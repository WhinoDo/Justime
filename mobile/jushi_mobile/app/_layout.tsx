import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/context/AuthContext';

// Monkey patch global.fetch to bypass Localtunnel's warning page
const originalFetch = global.fetch;
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.includes('loca.lt')) {
    init = init || {};
    init.headers = {
      ...init.headers,
      'Bypass-Tunnel-Reminder': 'true',
    };
  }
  return originalFetch(input, init);
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: '详情' }} />
            <Stack.Screen name="settings/model-config" options={{ headerShown: false }} />
            <Stack.Screen name="settings/knowledge" options={{ headerShown: false }} />
            <Stack.Screen name="settings/document" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="dark" translucent={false} />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
