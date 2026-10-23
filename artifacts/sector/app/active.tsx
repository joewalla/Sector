import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  BackHeader,
  Eyebrow,
  InfoPanel,
  ScreenShell,
  SectionHeading,
} from '@/components/sector-ui';

export default function ActiveNavigationScreen() {
  const colors = useColors();
  const router = useRouter();
  return (
    <ScreenShell bottomSafeArea>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <BackHeader title="Navigation" caption="INACTIVE SCREEN PREVIEW" />
        <View style={[styles.previewBadge, { backgroundColor: colors.accent }]}>
          <View style={[styles.badgeDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.badgeText, { color: colors.accentForeground }]}>
            PREVIEW ONLY · GPS OFF
          </Text>
        </View>

        <View style={[styles.mapPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.mapIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="map" size={22} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.mapTitle, { color: colors.foreground }]}>
            Live map not connected
          </Text>
          <Text style={[styles.mapBody, { color: colors.mutedForeground }]}>
            No route line or current position is shown in this build.
          </Text>
          <View style={[styles.mapRule, { backgroundColor: colors.border }]} />
          <View style={styles.mapFoot}>
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[styles.mapFootText, { color: colors.mutedForeground }]}>
              No location tracking is active
            </Text>
          </View>
        </View>

        <View style={styles.guidanceSection}>
          <SectionHeading title="NEXT TURN" />
          <View style={[styles.guidanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.guidanceIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="corner-up-right" size={22} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.guidanceTitle, { color: colors.foreground }]}>
                Guidance will appear here
              </Text>
              <Text style={[styles.guidanceBody, { color: colors.mutedForeground }]}>
                Turn instruction and distance require an active route.
              </Text>
            </View>
            <Text style={[styles.distance, { color: colors.mutedForeground }]}>—</Text>
          </View>
        </View>

        <View style={styles.timingSection}>
          <View style={styles.timerHeader}>
            <SectionHeading title="JOURNEY TIMER" />
            <Text style={[styles.currentSector, { color: colors.mutedForeground }]}>
              NO ACTIVE SECTOR
            </Text>
          </View>
          <View style={[styles.timerPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.timer, { color: colors.foreground }]}>—:—:—</Text>
            <Text style={[styles.timerCaption, { color: colors.mutedForeground }]}>
              TIMER STARTS WITH NAVIGATION
            </Text>
            <View style={styles.sectorRow}>
              {['01', '02', '03'].map((sector) => (
                <View key={sector} style={[styles.sectorChip, { borderColor: colors.border }]}>
                  <Text style={[styles.sectorLabel, { color: colors.mutedForeground }]}>
                    SEC {sector}
                  </Text>
                  <Text style={[styles.sectorTime, { color: colors.mutedForeground }]}>—:—</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <InfoPanel
          icon="info"
          title="No driving guidance is active"
          body="This screen is an interface preview only. It has no map, GPS, route, voice guidance, ETA, or timing session."
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
            Back to destination
          </Text>
          <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30, gap: 18 },
  previewBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 100, paddingVertical: 8, paddingHorizontal: 11 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  mapPanel: { minHeight: 218, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 20, padding: 22, gap: 10 },
  mapIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 17, marginBottom: 3 },
  mapTitle: { fontSize: 16, fontWeight: '700' },
  mapBody: { maxWidth: 250, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  mapRule: { height: StyleSheet.hairlineWidth, width: '100%', marginVertical: 7 },
  mapFoot: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mapFootText: { fontSize: 10, fontWeight: '600' },
  guidanceSection: { gap: 10 },
  guidanceCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 13 },
  guidanceIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  guidanceTitle: { fontSize: 12, fontWeight: '700' },
  guidanceBody: { fontSize: 10, lineHeight: 16 },
  distance: { fontSize: 12, fontWeight: '700' },
  timingSection: { gap: 10 },
  timerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentSector: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  timerPanel: { borderWidth: 1, borderRadius: 18, alignItems: 'center', padding: 17, gap: 6 },
  timer: { fontSize: 40, fontVariant: ['tabular-nums'], fontWeight: '600', letterSpacing: -1.5 },
  timerCaption: { fontSize: 8, fontWeight: '700', letterSpacing: 1.2 },
  sectorRow: { flexDirection: 'row', width: '100%', gap: 8, marginTop: 13 },
  sectorChip: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 7 },
  sectorLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.7 },
  sectorTime: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  action: { minHeight: 50, borderRadius: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
