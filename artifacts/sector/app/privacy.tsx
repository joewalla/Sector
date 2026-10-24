import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackHeader, Eyebrow, InfoPanel, ScreenShell } from '@/components/sector-ui';

export default function PrivacyScreen() {
  const colors = useColors();
  return (
    <ScreenShell bottomSafeArea>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <BackHeader title="Location & privacy" caption="YOUR DATA" />
        <View style={styles.intro}>
          <Eyebrow>BUILT FOR TRANSPARENCY</Eyebrow>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Nothing is tracking you now.
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Sector asks for location only when you request a route preview. It does not track you in the background.
          </Text>
        </View>

        <InfoPanel
          icon="map-pin"
          title="Location permission"
          body="When you tap Preview route, Sector requests foreground location once. Your coordinates are sent to the Sector server and Mapbox to calculate that route; they are not saved."
        />
        <InfoPanel
          icon="hard-drive"
          title="Saved searches"
          body="Place names you choose to save are stored on this device. They are not verified places, route data, or journey records."
        />
        <InfoPanel
          icon="sliders"
          title="Optional remembered practice settings"
          body="Remembering is off by default. Only if you choose Save and remember practice settings, Sector stores your sector count (2–5) and up to three synthetic stops’ sector numbers and durations (10, 30, 60 or 120 seconds) locally on this device. Further configuration changes are remembered while opted in. Settings are validated and restored before playback, never during a running or paused simulation. No GPS, account or backend storage is needed. Use Forget saved settings & reset practice in a route preview to delete these settings, turn remembering off and restore 3 sectors with no stops. Saved searches are separate and unaffected."
        />
        <InfoPanel
          icon="cpu"
          title="Route simulations"
          body="The London demo uses fixed example locations, not your GPS. Simulations replay Mapbox route estimates with explicitly configured synthetic stops, not live traffic or measured driving. Mapbox geometry, route steps, destinations and their coordinates, split results and replay comparison baselines are never saved by practice settings. Replay data stays in memory and does not create journey records or change your bests."
        />
        <InfoPanel
          icon="shield"
          title="Future navigation"
          body="Route previews are not active navigation. Background tracking, voice guidance, and trip timing are not enabled."
        />
        <View style={[styles.footer, { borderColor: colors.border }]}>
          <Feather name="lock" size={14} color={colors.primary} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            No account, cloud sync, or social sharing is part of the first version.
          </Text>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30, gap: 15 },
  intro: { gap: 10, paddingVertical: 8 },
  title: { fontSize: 31, lineHeight: 37, fontWeight: '700', letterSpacing: -1 },
  body: { fontSize: 13, lineHeight: 20 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  footerText: { flex: 1, fontSize: 11, lineHeight: 17 },
});
