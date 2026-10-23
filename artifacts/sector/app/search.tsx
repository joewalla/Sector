import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useColors } from '@/hooks/useColors';
import { BackHeader, Eyebrow, InfoPanel, ScreenShell } from '@/components/sector-ui';
import { saveRecentSearch } from '@/recent-searches';

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!query.trim()) {
      setError('Enter a place name first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveRecentSearch(query);
      setSaved(true);
      Keyboard.dismiss();
    } catch {
      setError('Could not save this search. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenShell bottomSafeArea>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <BackHeader title="Destination" caption="PLACE SEARCH" />
          <View style={styles.intro}>
            <Eyebrow>PLAN A JOURNEY</Eyebrow>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Where are you{'\n'}heading?
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Live place lookup and routing are the next build stage.
            </Text>
          </View>

          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="map-pin" size={18} color={colors.primary} />
            <TextInput
              accessibilityLabel="Destination name"
              testID="destination-name"
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setSaved(false);
                setError('');
              }}
              placeholder="Enter a place or address"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              onSubmitEditing={() => void handleSave()}
              maxLength={140}
              autoCapitalize="words"
              style={[styles.input, { color: colors.foreground }]}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear destination"
                onPress={() => {
                  setQuery('');
                  setSaved(false);
                  setError('');
                }}
                hitSlop={10}
              >
                <Feather name="x-circle" size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            testID="save-search"
            onPress={() => void handleSave()}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: colors.primary },
              (pressed || saving) && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
                  Save search on this device
                </Text>
                <Feather name="arrow-right" size={17} color={colors.primaryForeground} />
              </>
            )}
          </Pressable>

          {error ? (
            <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : saved ? (
            <View style={[styles.savedNotice, { backgroundColor: colors.accent }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.savedText, { color: colors.accentForeground }]}>
                Saved locally as a search. No place lookup or route has been created.
              </Text>
            </View>
          ) : null}

          <InfoPanel
            icon="navigation"
            title="No route has been requested"
            body="This screen only saves the text you enter. Real search results, route preview, and turn-by-turn navigation will be connected after the native SDK is verified."
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/active')}
            style={({ pressed }) => [styles.previewRow, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Eyebrow>SCREEN PREVIEW</Eyebrow>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>
                Navigation, inactive state
              </Text>
            </View>
            <Feather name="arrow-up-right" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/results')}
            style={({ pressed }) => [styles.previewRow, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Eyebrow>SCREEN PREVIEW</Eyebrow>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>
                Journey results, empty state
              </Text>
            </View>
            <Feather name="arrow-up-right" size={18} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30, gap: 18 },
  intro: { gap: 10, paddingTop: 10 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.3 },
  subtitle: { fontSize: 13, lineHeight: 20 },
  inputCard: { minHeight: 58, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 14, fontSize: 14 },
  saveButton: { minHeight: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  saveText: { fontSize: 13, fontWeight: '700' },
  feedback: { fontSize: 12, lineHeight: 18 },
  savedNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 12, padding: 12 },
  savedText: { flex: 1, fontSize: 11, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 3 },
  previewRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewTitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  pressed: { opacity: 0.72 },
});
