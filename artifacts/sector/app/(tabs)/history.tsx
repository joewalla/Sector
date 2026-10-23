import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Eyebrow, ScreenShell, SectionHeading } from '@/components/sector-ui';

export default function HistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  return (
    <ScreenShell>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: 18 }]}
      >
        <Eyebrow>YOUR DRIVE LOG</Eyebrow>
        <Text style={[styles.title, { color: colors.foreground }]}>Journeys</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Completed trips and their sector splits, kept on this device.
        </Text>

        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="navigation" size={20} color={colors.primary} />
          </View>
          <SectionHeading title="NO COMPLETED JOURNEYS" />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Your first journey will start here.
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            History will only show trips recorded from a real route and live location session. Nothing has been recorded in this foundation build.
          </Text>
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
              Add a destination
            </Text>
            <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 34, gap: 10 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1.1 },
  subtitle: { fontSize: 13, lineHeight: 20, maxWidth: 300 },
  emptyCard: { marginTop: 24, borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  emptyBody: { fontSize: 12, lineHeight: 19 },
  action: { minHeight: 48, borderRadius: 14, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  actionText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
