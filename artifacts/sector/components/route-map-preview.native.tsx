import MapView, { Marker, Polyline } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { clusterPracticeStops, type PracticeStopMarker } from '@/simulation/practice-stop-markers';

export default function RouteMapPreview({
  route,
  destinationName,
  position,
  sectorBoundaries,
  practiceStops,
}: {
  route: RoutePreviewResponse;
  destinationName: string;
  position?: { latitude: number; longitude: number } | null;
  /** Simulation-only internal sector ends. Destination is the final sector end. */
  sectorBoundaries?: { id: number; position: { latitude: number; longitude: number } }[];
  practiceStops?: PracticeStopMarker[];
}) {
  const colors = useColors();
  const longitudes = route.geometry.map((point) => point.longitude);
  const latitudes = route.geometry.map((point) => point.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const initialRegion = {
    longitude: (minLongitude + maxLongitude) / 2,
    latitude: (minLatitude + maxLatitude) / 2,
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.5, 0.015),
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.5, 0.015),
  };
  // Group against the initial viewport; labels remain grouped while zooming.
  // Separate square anchors always retain each exact synthetic route position.
  const stopGroups = clusterPracticeStops((practiceStops ?? []).map((stop) => ({
    ...stop,
    x: (stop.position.longitude - initialRegion.longitude) / initialRegion.longitudeDelta * 360,
    y: (stop.position.latitude - initialRegion.latitude) / initialRegion.latitudeDelta * 250,
  })));

  return (
    <View>
    <MapView
      key={`${destinationName}-${route.durationSeconds}`}
      style={{ height: 250, borderRadius: 16, overflow: 'hidden' }}
      initialRegion={initialRegion}
      accessibilityLabel="Map showing the real route preview"
    >
      <Polyline
        coordinates={route.geometry.map(({ latitude, longitude }) => ({ latitude, longitude }))}
        strokeColor={colors.primary}
        strokeWidth={5}
      />
      <Marker coordinate={route.geometry[0]} title="Your starting point" pinColor="#7FC8FF" />
      <Marker coordinate={route.geometry[route.geometry.length - 1]} title={destinationName} pinColor="#C9F36A" />
      {sectorBoundaries?.map((b) => (
        <Marker
          key={`sector-${b.id}`}
          coordinate={{ latitude: b.position.latitude, longitude: b.position.longitude }}
          title={`S${b.id} boundary`}
          description="Simulated sector boundary"
          pinColor={colors.signalBlue}
          tracksViewChanges={false}
        />
      ))}
      {position ? (
        <Marker
          coordinate={{ latitude: position.latitude, longitude: position.longitude }}
          title="Simulated position"
          pinColor={colors.foreground}
          tracksViewChanges={false}
        />
      ) : null}
      {(practiceStops ?? []).map((stop) => (
        <Marker
          key={`synthetic-anchor-${stop.number}`}
          coordinate={stop.position}
          title={`Synthetic practice stop ${stop.number}`}
          description="Simulation only. Not a real roadside stop or GPS location."
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={2}
        >
          <View style={[styles.stopAnchor, { backgroundColor: colors.card, borderColor: colors.foreground }]} />
        </Marker>
      ))}
      {stopGroups.map((group) => (
        <Marker
          key={`synthetic-label-${group.key}`}
          coordinate={group.position}
          title={`Synthetic practice ${group.members.length === 1 ? 'stop' : 'stops'} ${group.members.map((stop) => stop.number).join(', ')}`}
          description={group.description}
          anchor={{ x: 0.5, y: 1.6 }}
          zIndex={3}
        >
          <View style={[styles.stopBadge, { backgroundColor: colors.card, borderColor: colors.foreground }]}>
            <Text style={[styles.stopLabel, { color: colors.foreground }]}>{group.label}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
    {stopGroups.length ? (
      <Text style={[styles.stopNote, { color: colors.foreground }]}>
        Dashed SIM badges = synthetic practice stops. Nearby labels grouped; squares show positions. Not roadside stops or GPS tracking.
      </Text>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stopAnchor: { width: 10, height: 10, borderWidth: 2 },
  stopBadge: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 3, paddingHorizontal: 8, paddingVertical: 4 },
  stopLabel: { fontSize: 11, fontWeight: '700' },
  stopNote: { fontSize: 11, lineHeight: 16, paddingHorizontal: 14, paddingTop: 10 },
});
