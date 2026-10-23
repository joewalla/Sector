import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  BrandMark,
  Eyebrow,
  ScreenShell,
  SectionHeading,
} from '@/components/sector-ui';
import { getRecentSearches, type RecentSearch } from '@/recent-searches';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);

  const refreshSearches = useCallback(async () => {
    setLoading(true);
    try {
      setRecentSearches(await getRecentSearches());
      setStorageError(false);
    } catch {
      setStorageError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSearches();
    }, [refreshSearches]),
  );

  return (
    <ScreenShell>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topline}>
          <View style={styles.brand}>
            <BrandMark size={34} />
            <View>
              <Text style={[styles.wordmark, { color: colors.foreground }]}>
                SECTOR
              </Text>
              <Text style={[styles.brandCaption, { color: colors.mutedForeground }]}>
                JOURNEY SYSTEM
              </Text>
            </View>
          </View>
          <View style={[styles.buildBadge, { borderColor: colors.border }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.buildBadgeText, { color: colors.mutedForeground }]}>
              FOUNDATION
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Eyebrow>YOUR NEXT DRIVE, CLEARLY READ</Eyebrow>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Every journey.{'\n'}
            <Text style={{ color: colors.primary }}>Measured.</Text>
          </Text>
          <Text style={[styles.heroCopy, { color: colors.mutedForeground }]}>
            Navigation first. Your journey data, when the drive is done.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enter a destination"
          testID="destination-search"
          onPress={() => router.push('/search')}
          style={({ pressed }) => [
            styles.searchCard,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.searchIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="search" size={19} color={colors.primary} />
          </View>
          <View style={styles.searchCopy}>
            <Text style={[styles.searchTitle, { color: colors.foreground }]}>
              Where to?
            </Text>
            <Text style={[styles.searchSubtitle, { color: colors.mutedForeground }]}>
              Destination search is being connected
            </Text>
          </View>
          <Feather name="arrow-up-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.secondaryForeground }]}>
            This foundation build does not request location or start navigation.
          </Text>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="RECENT SEARCHES"
            action="Add one"
            onAction={() => router.push('/search')}
          />
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                Loading saved searches
              </Text>
            </View>
          ) : storageError ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void refreshSearches()}
              style={[styles.emptyCard, { borderColor: colors.border }]}
            >
              <Feather name="alert-circle" size={18} color={colors.destructive} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>
                Saved searches could not be loaded. Tap to retry.
              </Text>
            </Pressable>
          ) : recentSearches.length === 0 ? (
            <View style={[styles.emptyCard, { borderColor: colors.border }]}>
              <Feather name="map-pin" size={18} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Searches you save on this device will appear here.
              </Text>
            </View>
          ) : (
            <View style={[styles.recentList, { borderColor: colors.border }]}>
              {recentSearches.slice(0, 3).map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/search', params: { query: item.query } })
                  }
                  style={[
                    styles.recentRow,
                    index < Math.min(recentSearches.length, 3) - 1 && {
                      borderBottomColor: colors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Feather name="clock" size={16} color={colors.mutedForeground} />
                  <Text
                    numberOfLines={1}
                    style={[styles.recentText, { color: colors.foreground }]}
                  >
                    {item.query}
                  </Text>
                  <Feather name="arrow-up-left" size={15} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeading title="IN THIS BUILD" />
          <View style={[styles.stageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stageHeader}>
              <View style={[styles.stageNumber, { backgroundColor: colors.accent }]}>
                <Text style={[styles.stageNumberText, { color: colors.primary }]}>01</Text>
              </View>
              <View style={styles.stageHeadingCopy}>
                <Text style={[styles.stageTitle, { color: colors.foreground }]}>
                  Foundation
                </Text>
                <Text style={[styles.stageSubtitle, { color: colors.mutedForeground }]}>
                  Screen flow, local search history, and safety-first states
                </Text>
              </View>
              <Feather name="check" size={18} color={colors.primary} />
            </View>
            <View style={[styles.stageDivider, { backgroundColor: colors.border }]} />
            <View style={styles.nextStepRow}>
              <View style={[styles.stageNumber, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.stageNumberText, { color: colors.mutedForeground }]}>02</Text>
              </View>
              <View style={styles.stageHeadingCopy}>
                <Text style={[styles.stageTitle, { color: colors.foreground }]}>
                  Live navigation proof
                </Text>
                <Text style={[styles.stageSubtitle, { color: colors.mutedForeground }]}>
                  Verify the native SDK on a physical iPhone
                </Text>
              </View>
              <Feather name="arrow-right" size={17} color={colors.mutedForeground} />
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/active')}
          style={({ pressed }) => [
            styles.previewLink,
            { borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <View>
            <Eyebrow>SCREEN PREVIEW</Eyebrow>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>
              Navigation screen
            </Text>
          </View>
          <Feather name="arrow-up-right" size={19} color={colors.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/privacy')}
          style={styles.privacyLink}
        >
          <Feather name="shield" size={14} color={colors.mutedForeground} />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Location & privacy
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 22,
  },
  topline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontSize: 17, fontWeight: '800', letterSpacing: 2.7 },
  brandCaption: { fontSize: 8, fontWeight: '600', letterSpacing: 1.55, marginTop: 2 },
  buildBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  buildBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  hero: { gap: 10, paddingTop: 12, paddingBottom: 2 },
  heroTitle: { fontSize: 42, lineHeight: 48, fontWeight: '700', letterSpacing: -1.8 },
  heroCopy: { fontSize: 14, lineHeight: 21, maxWidth: 300 },
  searchCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  searchIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  searchCopy: { flex: 1, gap: 4 },
  searchTitle: { fontSize: 15, fontWeight: '700' },
  searchSubtitle: { fontSize: 11 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 13 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  section: { gap: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  helper: { fontSize: 12 },
  emptyCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 15,
    padding: 16,
  },
  emptyText: { flex: 1, fontSize: 12, lineHeight: 18 },
  recentList: { borderWidth: 1, borderRadius: 15, overflow: 'hidden' },
  recentRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
  },
  recentText: { flex: 1, fontSize: 13, fontWeight: '500' },
  stageCard: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 14 },
  stageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextStepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stageNumber: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stageNumberText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  stageHeadingCopy: { flex: 1, gap: 4 },
  stageTitle: { fontSize: 13, fontWeight: '700' },
  stageSubtitle: { fontSize: 11, lineHeight: 16 },
  stageDivider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
  previewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  previewTitle: { fontSize: 14, fontWeight: '600', marginTop: 5 },
  privacyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 3 },
  privacyText: { fontSize: 11, fontWeight: '500' },
  pressed: { opacity: 0.72 },
});
