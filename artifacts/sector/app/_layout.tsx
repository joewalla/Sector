import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl } from '@workspace/api-client-react';

const forcedColorsCss = `
@media (forced-colors: active) {
  [data-testid^="practice-sector-count-"][aria-checked="true"],
  [data-testid^="simulated-stop-duration-"][aria-checked="true"],
  [data-testid^="simulated-stop-sector-"][aria-checked="true"],
  [data-testid^="simulation-speed-"][aria-checked="true"] {
    background-color: Highlight !important;
    border-color: Highlight !important;
    border-style: solid !important;
    border-width: 2px !important;
    color: HighlightText !important;
  }

  [data-testid^="practice-sector-count-"][aria-checked="true"] *,
  [data-testid^="simulated-stop-duration-"][aria-checked="true"] *,
  [data-testid^="simulated-stop-sector-"][aria-checked="true"] *,
  [data-testid^="simulation-speed-"][aria-checked="true"] * {
    color: HighlightText !important;
  }

  [data-testid^="practice-sector-count-"][aria-checked="false"],
  [data-testid^="simulated-stop-duration-"][aria-checked="false"],
  [data-testid^="simulated-stop-sector-"][aria-checked="false"],
  [data-testid^="simulation-speed-"][aria-checked="false"] {
    background-color: ButtonFace !important;
    border-color: ButtonText !important;
    color: ButtonText !important;
  }

  [data-testid^="practice-sector-count-"][aria-checked="false"] *,
  [data-testid^="simulated-stop-duration-"][aria-checked="false"] *,
  [data-testid^="simulated-stop-sector-"][aria-checked="false"] *,
  [data-testid^="simulation-speed-"][aria-checked="false"] * {
    color: ButtonText !important;
  }

  [data-testid^="practice-sector-count-"][aria-checked="false"]:disabled,
  [data-testid^="practice-sector-count-"][aria-checked="false"][aria-disabled="true"],
  [data-testid^="simulated-stop-duration-"][aria-checked="false"]:disabled,
  [data-testid^="simulated-stop-duration-"][aria-checked="false"][aria-disabled="true"],
  [data-testid^="simulated-stop-sector-"][aria-checked="false"]:disabled,
  [data-testid^="simulated-stop-sector-"][aria-checked="false"][aria-disabled="true"],
  [data-testid^="simulation-speed-"][aria-checked="false"]:disabled,
  [data-testid^="simulation-speed-"][aria-checked="false"][aria-disabled="true"] {
    border-color: GrayText !important;
    color: GrayText !important;
  }

  [data-testid^="practice-sector-count-"][aria-checked="false"]:disabled *,
  [data-testid^="practice-sector-count-"][aria-checked="false"][aria-disabled="true"] *,
  [data-testid^="simulated-stop-duration-"][aria-checked="false"]:disabled *,
  [data-testid^="simulated-stop-duration-"][aria-checked="false"][aria-disabled="true"] *,
  [data-testid^="simulated-stop-sector-"][aria-checked="false"]:disabled *,
  [data-testid^="simulated-stop-sector-"][aria-checked="false"][aria-disabled="true"] *,
  [data-testid^="simulation-speed-"][aria-checked="false"]:disabled *,
  [data-testid^="simulation-speed-"][aria-checked="false"][aria-disabled="true"] * {
    color: GrayText !important;
  }

  [data-testid^="practice-sector-count-"]:focus-visible,
  [data-testid^="simulated-stop-duration-"]:focus-visible,
  [data-testid^="simulated-stop-sector-"]:focus-visible,
  [data-testid^="simulation-speed-"]:focus-visible {
    outline: 3px solid Highlight !important;
    outline-offset: 2px !important;
  }
}`;

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
setBaseUrl(process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : null);

const queryClient = new QueryClient();

function RootLayoutNav() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.dataset.sectorForcedColors = 'true';
    style.textContent = forcedColorsCss;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ gestureEnabled: false }} />
      <Stack.Screen name="active" />
      <Stack.Screen name="results" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
