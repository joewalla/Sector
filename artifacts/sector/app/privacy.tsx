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
            This foundation build does not ask for location permission or run location tracking.
          </Text>
        </View>

        <InfoPanel
          icon="map-pin"
          title="Location permission"
          body="No location permission is requested in this build. Before navigation is enabled, Sector will explain what location access is needed and when it is active."
        />
        <InfoPanel
          icon="hard-drive"
          title="Saved searches"
          body="Place names you choose to save are stored on this device. They are not verified places, route data, or journey records."
        />
        <InfoPanel
          icon="shield"
          title="Future navigation"
          body="The navigation stage will require its own permission and SDK review. Background tracking will not be enabled without clear disclosure and appropriate iOS configuration."
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
