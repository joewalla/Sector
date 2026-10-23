import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import {
  useGetRoutePreview,
  useSearchPlaces,
  type PlaceSearchResponse,
  type RoutePreviewResponse,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { BackHeader, Eyebrow, InfoPanel, ScreenShell } from '@/components/sector-ui';
import RouteMapPreview from './route-map-preview';
import { saveRecentSearch } from '@/recent-searches';

type Coordinate = { longitude: number; latitude: number };
type Destination = PlaceSearchResponse['results'][number];

async function getCurrentPosition(): Promise<Coordinate> {
  if (Platform.OS === 'web') {
    const geolocation = globalThis.navigator?.geolocation;
    if (!geolocation) throw new Error('LOCATION_UNAVAILABLE');
    return new Promise((resolve, reject) => {
      geolocation.getCurrentPosition(
        ({ coords }) => resolve({ longitude: coords.longitude, latitude: coords.latitude }),
        (error) => reject(new Error(error.code === 1 ? 'LOCATION_DENIED' : 'LOCATION_UNAVAILABLE')),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    });
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error(permission.canAskAgain ? 'LOCATION_DENIED' : 'LOCATION_SETTINGS');
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { longitude: position.coords.longitude, latitude: position.coords.latitude };
}

export default function LiveDestinationSearch() {
  const colors = useColors();
  const params = useLocalSearchParams<{ query?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [results, setResults] = useState<PlaceSearchResponse['results']>([]);
  const [searchAttribution, setSearchAttribution] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [route, setRoute] = useState<RoutePreviewResponse | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [needsSettings, setNeedsSettings] = useState(false);
  const searchMutation = useSearchPlaces();
  const routeMutation = useGetRoutePreview();

  async function searchPlaces() {
    const cleaned = query.trim();
    if (cleaned.length < 3) {
      setError('Enter at least 3 characters to search.');
      return;
    }
    Keyboard.dismiss();
    setError('');
    setDestination(null);
    setRoute(null);
    setSaved(false);
    try {
      const response = await searchMutation.mutateAsync({ data: { query: cleaned } });
      setResults(response.results);
      setSearchAttribution(response.attribution);
      if (response.results.length === 0) setError('No places matched that search. Try adding a town or postcode.');
    } catch {
      setResults([]);
      setError('Place search is unavailable right now. Check your connection and try again.');
    }
  }

  async function previewRoute() {
    if (!destination) return;
    setError('');
    setNeedsSettings(false);
    try {
      const origin = await getCurrentPosition();
      const response = await routeMutation.mutateAsync({
        data: {
          origin,
          destination: { longitude: destination.longitude, latitude: destination.latitude },
        },
      });
      setRoute(response);
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : '';
      if (reason === 'LOCATION_DENIED' || reason === 'LOCATION_SETTINGS') {
        setNeedsSettings(reason === 'LOCATION_SETTINGS');
        setError('Location access is needed once to calculate a route from your current position.');
      } else if (reason === 'LOCATION_UNAVAILABLE') {
        setError('Could not get your location. Check browser or device location settings and try again.');
      } else {
        setError('Route preview is unavailable right now. No journey has been started or recorded.');
      }
    }
  }

  async function saveSearch() {
    try {
      await saveRecentSearch(query);
      setSaved(true);
      setError('');
    } catch {
      setError('Could not save this search on the device.');
    }
  }

  const placeType = (value: string) => value.replaceAll('_', ' ');

  return (
    <ScreenShell bottomSafeArea>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <BackHeader title="Destination" caption="PLACE SEARCH" />
          <View style={styles.intro}>
            <Eyebrow>PLAN A JOURNEY</Eyebrow>
            <Text style={[styles.title, { color: colors.foreground }]}>Where are you{'\n'}heading?</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Search real places and addresses, then preview a traffic-aware driving route.
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
                setResults([]);
                setSearchAttribution('');
                setDestination(null);
                setRoute(null);
                setError('');
                setSaved(false);
              }}
              placeholder="Enter a place or address"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              onSubmitEditing={() => void searchPlaces()}
              maxLength={256}
              autoCapitalize="words"
              style={[styles.input, { color: colors.foreground }]}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear destination"
                onPress={() => {
                  setQuery('');
                  setResults([]);
                  setSearchAttribution('');
                  setDestination(null);
                  setRoute(null);
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
            accessibilityState={{ disabled: searchMutation.isPending || query.trim().length < 3 }}
            onPress={() => void searchPlaces()}
            disabled={searchMutation.isPending || query.trim().length < 3}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              (pressed || searchMutation.isPending) && styles.pressed,
            ]}
          >
            {searchMutation.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Search places</Text>
                <Feather name="search" size={17} color={colors.primaryForeground} />
              </>
            )}
          </Pressable>

          {error ? <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.destructive }]}>{error}</Text> : null}

          {results.length > 0 ? (
            <View style={styles.resultSection}>
              <Eyebrow>MAPBOX SEARCH RESULTS</Eyebrow>
              {results.map((place) => {
                const selected = destination?.id === place.id;
                return (
                  <Pressable
                    key={place.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setDestination(place);
                      setRoute(null);
                      routeMutation.reset();
                      setError('');
                    }}
                    style={[
                      styles.resultRow,
                      { backgroundColor: selected ? colors.accent : colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Feather name={place.featureType === 'poi' ? 'map-pin' : 'map'} size={17} color={colors.primary} />
                    <View style={styles.resultCopy}>
                      <Text style={[styles.resultName, { color: colors.foreground }]}>{place.name}</Text>
                      <Text style={[styles.resultAddress, { color: colors.mutedForeground }]}>{place.fullAddress}</Text>
                    </View>
                    <Text style={[styles.resultType, { color: colors.mutedForeground }]}>{placeType(place.featureType)}</Text>
                  </Pressable>
                );
              })}
              <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
                {searchAttribution}
              </Text>
            </View>
          ) : null}

          {destination ? (
            <>
              <InfoPanel
                icon="map-pin"
                title="One-time location use"
                body="When you request a preview, Sector asks for your current location once and sends it to Mapbox through the Sector server. It is not saved or tracked in the background."
              />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: routeMutation.isPending }}
                onPress={() => void previewRoute()}
                disabled={routeMutation.isPending}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  (pressed || routeMutation.isPending) && styles.pressed,
                ]}
              >
                {routeMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Preview route</Text>
                    <Feather name="navigation" size={17} color={colors.primaryForeground} />
                  </>
                )}
              </Pressable>
              {needsSettings ? (
                <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.settingsButton}>
                  <Text style={[styles.settingsText, { color: colors.primary }]}>Open device settings</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {route && destination ? (
            <View style={styles.routeSection}>
              <Eyebrow>ROUTE PREVIEW · NOT ACTIVE NAVIGATION</Eyebrow>
              <View style={[styles.routeSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.foreground }]}>{Math.round(route.durationSeconds / 60)} min</Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>traffic-aware estimate</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.foreground }]}>{(route.distanceMeters / 1609.344).toFixed(1)} mi</Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>route distance</Text>
                </View>
              </View>
              <RouteMapPreview route={route} destinationName={destination.name} />
              <Text style={[styles.attribution, { color: colors.mutedForeground }]}>{route.attribution} · Map data © Mapbox</Text>
              <View style={styles.stepsSection}>
                <Eyebrow>PREVIEW INSTRUCTIONS</Eyebrow>
                {route.steps.slice(0, 6).map((step, index) => (
                  <View key={`${index}-${step.instruction}`} style={[styles.stepRow, { borderColor: colors.border }]}>
                    <View style={[styles.stepNumber, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.stepNumberText, { color: colors.primary }]}>{index + 1}</Text>
                    </View>
                    <View style={styles.stepCopy}>
                      <Text style={[styles.stepText, { color: colors.foreground }]}>{step.instruction}</Text>
                      {step.roadName ? <Text style={[styles.stepRoad, { color: colors.mutedForeground }]}>{step.roadName}</Text> : null}
                    </View>
                  </View>
                ))}
                {route.steps.length > 6 ? (
                  <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
                    {route.steps.length - 6} more steps are available in the route.
                  </Text>
                ) : null}
              </View>
              <InfoPanel
                icon="info"
                title="Preview only"
                body="This is a route estimate, not turn-by-turn navigation. No trip timer starts and no journey is recorded."
              />
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => void saveSearch()}
            style={({ pressed }) => [styles.saveLink, pressed && styles.pressed]}
          >
            <Feather name={saved ? 'check' : 'bookmark'} size={15} color={colors.primary} />
            <Text style={[styles.saveLinkText, { color: colors.primary }]}>
              {saved ? 'Search saved on this device' : 'Save this search on this device'}
            </Text>
          </Pressable>

          <InfoPanel
            icon="shield"
            title="No journey has started"
            body="Search and route preview are real Mapbox results. Live guidance, background tracking and trip timing are not enabled."
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 34, gap: 16 },
  intro: { gap: 10, paddingTop: 8 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.3 },
  subtitle: { fontSize: 13, lineHeight: 20 },
  inputCard: { minHeight: 58, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 14, fontSize: 14 },
  primaryButton: { minHeight: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  primaryButtonText: { fontSize: 13, fontWeight: '700' },
  feedback: { fontSize: 12, lineHeight: 18 },
  resultSection: { gap: 9 },
  resultRow: { minHeight: 68, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  resultCopy: { flex: 1, gap: 4 },
  resultName: { fontSize: 13, fontWeight: '700' },
  resultAddress: { fontSize: 11, lineHeight: 16 },
  resultType: { fontSize: 9, textTransform: 'capitalize' },
  attribution: { fontSize: 10, lineHeight: 15 },
  settingsButton: { alignSelf: 'flex-start', paddingVertical: 7 },
  settingsText: { fontSize: 12, fontWeight: '700' },
  routeSection: { gap: 12 },
  routeSummary: { borderWidth: 1, borderRadius: 15, minHeight: 82, padding: 14, flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, gap: 4 },
  metricValue: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  metricLabel: { fontSize: 10 },
  metricDivider: { width: 1, height: 38, marginHorizontal: 12 },
  stepsSection: { gap: 4 },
  stepRow: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  stepNumber: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { fontSize: 12, fontWeight: '700' },
  stepCopy: { flex: 1, gap: 3 },
  stepText: { fontSize: 12, lineHeight: 17 },
  stepRoad: { fontSize: 10 },
  saveLink: { minHeight: 40, flexDirection: 'row', gap: 8, alignItems: 'center' },
  saveLinkText: { fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});
