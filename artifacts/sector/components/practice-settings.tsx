import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import {
  createPracticeSettingsStorage, defaultPracticeSettings, type PracticeSettings,
} from '@/practice-settings-storage';

const storage = createPracticeSettingsStorage(AsyncStorage);
type SettingsContext = {
  settings: PracticeSettings;
  ready: boolean;
  busy: boolean;
  remembered: boolean;
  message: string;
  update: (next: PracticeSettings) => void;
  remember: () => void;
  forget: (onReset: () => void) => void;
};
const Context = createContext<SettingsContext | null>(null);

export function PracticeSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PracticeSettings>(defaultPracticeSettings);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [message, setMessage] = useState('Not saved. Remembering is optional.');
  const pending = useRef(true);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    storage.load().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setSettings(saved);
        setRemembered(true);
        setMessage('Saved settings restored. Changes will be remembered on this device.');
      }
    }).catch(() => {
      if (!cancelled) setMessage('Saved settings could not be read or were invalid. Using defaults; nothing new will be saved unless you opt in. You can retry saving or forget them.');
    }).finally(() => {
      if (!cancelled) {
        pending.current = false;
        setReady(true);
      }
    });
    return () => { cancelled = true; mounted.current = false; };
  }, []);

  async function save(next: PracticeSettings) {
    pending.current = true;
    setBusy(true);
    try {
      await storage.save(next);
      if (mounted.current) {
        setRemembered(true);
        setMessage('Practice settings saved on this device. Future changes will be remembered.');
      }
    } catch {
      if (mounted.current) setMessage('Could not save these settings. They work for this preview, but an older saved version may remain. Retry saving or forget them.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const value: SettingsContext = {
    settings, ready, busy, remembered, message,
    update(next) {
      if (pending.current) return;
      setSettings(next);
      if (remembered) void save(next);
    },
    remember() {
      if (!pending.current) void save(settings);
    },
    forget(onReset) {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      void storage.forget().then(() => {
        if (!mounted.current) return;
        setRemembered(false);
        setSettings(defaultPracticeSettings());
        setMessage('Forgot saved practice settings. Reset to 3 sectors and no stops; remembering is off.');
        onReset();
      }).catch(() => {
        if (mounted.current) setMessage('Could not forget saved settings. Nothing was reset. Please try again.');
      }).finally(() => {
        pending.current = false;
        if (mounted.current) setBusy(false);
      });
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePracticeSettings() {
  const value = useContext(Context);
  if (!value) throw new Error('Practice settings provider is missing.');
  return value;
}

export function PracticeSettingsControl({ locked, onReset }: { locked: boolean; onReset: () => void }) {
  const colors = useColors();
  const { ready, busy, remembered, message, remember, forget } = usePracticeSettings();
  const disabled = locked || !ready || busy;
  return (
    <View testID="practice-settings" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Remember practice settings · optional</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Save only the sector count and up to three stops’ sector numbers and durations on this device.
        No destinations, coordinates, routes, results or replay comparisons are saved.
      </Text>
      <Text testID="practice-settings-status" accessibilityLiveRegion="polite" style={[styles.body, { color: colors.foreground }]}>
        {busy ? 'Updating saved settings…' : message}
      </Text>
      <Pressable
        testID="practice-settings-remember"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={remember}
        style={[styles.button, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.foreground }]}>{remembered ? 'Save practice settings again' : 'Save and remember practice settings'}</Text>
      </Pressable>
      <Pressable
        testID="practice-settings-forget"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => forget(onReset)}
        style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.foreground }]}>Forget saved settings & reset practice</Text>
      </Pressable>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {locked ? 'End playback before saving or resetting settings.' : 'Reset clears this preview’s practice comparison and restores 3 sectors with no stops. Saved searches are unaffected.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12, lineHeight: 18 },
  button: { minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 10 },
  buttonText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
