import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import RouteMapPreview from '@/components/route-map-preview';
import { BackHeader, ScreenShell } from '@/components/sector-ui';

const points = [
  { latitude: 51.5, longitude: -0.12 },
  { latitude: 51.51, longitude: -0.1 },
  { latitude: 51.52, longitude: -0.08 },
];

type Phase = 'valid' | 'malformed' | 'recovered';

export default function MapRecoveryCheckScreen() {
  const colors = useColors();
  const [phase, setPhase] = useState<Phase>('valid');

  if (!__DEV__) return null;

  const geometry = phase === 'malformed'
    ? [points[0], { latitude: 95, longitude: -0.1 }, points[2]]
    : points;
  const route: RoutePreviewResponse = {
    geometry,
    durationSeconds: 180,
    distanceMeters: 900,
    steps: [],
    attribution: 'Synthetic development fixture; not a real route or GPS data',
  };

  const status = phase === 'malformed'
    ? 'Malformed geometry is active. The unavailable message should replace the native map.'
    : phase === 'recovered'
      ? 'Valid geometry is restored. Check that the map and all fixture markers returned without an app or native exception.'
      : 'Valid synthetic geometry is mounted. Trigger the malformed state, then restore it.';

  return (
    <ScreenShell bottomSafeArea>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackHeader title="Native map recovery" caption="DEVELOPMENT CHECK" />
        <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.noticeTitle, { color: colors.secondaryForeground }]}>
            SYNTHETIC FIXTURE ONLY
          </Text>
          <Text style={[styles.noticeBody, { color: colors.secondaryForeground }]}>
            Fixed test coordinates, not a real route. This check makes no routing or GPS requests and saves no data.
          </Text>
        </View>

        {Platform.OS === 'web' ? (
          <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              Open this development-only screen on an iOS or Android native app to test the map SDK.
            </Text>
          </View>
        ) : (
          <>
            <View
              accessibilityLiveRegion="polite"
              style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.statusText, { color: colors.foreground }]}>{status}</Text>
            </View>

            <RouteMapPreview
              route={route}
              destinationName="Synthetic endpoint"
              position={points[1]}
              sectorBoundaries={[{ id: 1, position: points[1] }]}
              practiceStops={[
                { number: 1, position: points[1] },
                { number: 2, position: points[1] },
              ]}
            />
          </>
        )}

        <Pressable
          accessibilityRole="button"
          testID="trigger-malformed-map-geometry"
          onPress={() => setPhase('malformed')}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            Show malformed geometry
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          testID="restore-valid-map-geometry"
          onPress={() => setPhase('recovered')}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.primary, borderColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
            Restore valid geometry
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  noticeTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  noticeBody: { fontSize: 12, lineHeight: 18 },
  statusCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  statusText: { fontSize: 13, lineHeight: 19 },
  action: { minHeight: 48, borderWidth: 1, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 16 },
  actionText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
