import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Eyebrow, ScreenShell } from '@/components/sector-ui';

export default function RecordsScreen() {
  const colors = useColors();
  const router = useRouter();
  return (
    <ScreenShell>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Eyebrow>PERSONAL RECORDS</Eyebrow>
        <Text style={[styles.title, { color: colors.foreground }]}>Best runs</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Comparisons appear only when journeys share a sufficiently similar route.
        </Text>

        <View style={[styles.recordPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.trackIcon, { backgroundColor: colors.accent }]}>
            <Feather name="award" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.dash, { color: colors.foreground }]}>—</Text>
          <Text style={[styles.recordLabel, { color: colors.mutedForeground }]}>NO VALID RECORDS YET</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.explanation, { color: colors.mutedForeground }]}>
            Sector will not compare different routes as if they were the same. Your bests need completed, comparable journeys first.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/active')}
            style={({ pressed }) => [
              styles.linkButton,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.linkText, { color: colors.foreground }]}>
              View navigation preview
            </Text>
            <Feather name="arrow-up-right" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 34, gap: 10 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1.1 },
  subtitle: { fontSize: 13, lineHeight: 20, maxWidth: 310 },
  recordPanel: { marginTop: 24, alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: 22, gap: 12 },
  trackIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dash: { fontSize: 52, lineHeight: 62, fontWeight: '300' },
  recordLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.45 },
  divider: { width: '100%', height: StyleSheet.hairlineWidth, marginVertical: 4 },
  explanation: { fontSize: 12, lineHeight: 19, textAlign: 'center' },
  linkButton: { width: '100%', minHeight: 46, borderWidth: 1, borderRadius: 14, marginTop: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkText: { fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});
