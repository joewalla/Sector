import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackHeader, Eyebrow, InfoPanel, ScreenShell } from '@/components/sector-ui';

export default function ResultsScreen() {
  const colors = useColors();
  const router = useRouter();
  return (
    <ScreenShell bottomSafeArea>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <BackHeader title="Journey results" caption="RESULT SCREEN PREVIEW" />
        <View style={[styles.status, { backgroundColor: colors.secondary }]}>
          <Feather name="clock" size={15} color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.secondaryForeground }]}>
            NO JOURNEY TO REVIEW
          </Text>
        </View>

        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Eyebrow>TOTAL JOURNEY TIME</Eyebrow>
          <Text style={[styles.timer, { color: colors.foreground }]}>—:—:—</Text>
          <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
            A result is created only after a real navigation session is completed.
          </Text>
        </View>

        <View style={[styles.splitPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.splitHeader}>
            <Text style={[styles.splitTitle, { color: colors.foreground }]}>SECTOR SPLITS</Text>
            <Text style={[styles.splitMeta, { color: colors.mutedForeground }]}>DISTANCE BASED</Text>
          </View>
          {['01', '02', '03'].map((sector, index) => (
            <View
              key={sector}
              style={[
                styles.splitRow,
                index < 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.splitNumber, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.splitNumberText, { color: colors.mutedForeground }]}>{sector}</Text>
              </View>
              <Text style={[styles.splitName, { color: colors.foreground }]}>Sector {sector}</Text>
              <Text style={[styles.splitTime, { color: colors.mutedForeground }]}>—:—</Text>
            </View>
          ))}
        </View>

        <InfoPanel
          icon="activity"
          title="No personal-best comparison"
          body="A comparison will be shown only for a sufficiently similar route. This build has no completed journeys to compare."
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/search')}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
            Return to destination
          </Text>
          <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30, gap: 17 },
  status: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 100, paddingHorizontal: 11, paddingVertical: 8 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  summary: { borderWidth: 1, borderRadius: 19, padding: 18, gap: 9 },
  timer: { fontSize: 43, fontWeight: '600', letterSpacing: -1.8, fontVariant: ['tabular-nums'] },
  summaryText: { fontSize: 11, lineHeight: 18 },
  splitPanel: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingTop: 16 },
  splitHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12 },
  splitTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  splitMeta: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  splitRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitNumber: { width: 29, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  splitNumberText: { fontSize: 9, fontWeight: '800' },
  splitName: { flex: 1, fontSize: 12, fontWeight: '600' },
  splitTime: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  action: { minHeight: 50, borderRadius: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
