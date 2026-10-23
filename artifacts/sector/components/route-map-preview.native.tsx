import MapView, { Marker, Polyline } from 'react-native-maps';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function RouteMapPreview({
  route,
  destinationName,
  position,
  sectorBoundaries,
}: {
  route: RoutePreviewResponse;
  destinationName: string;
  position?: { latitude: number; longitude: number } | null;
  /** Simulation-only internal sector boundaries (S1, S2). Destination is the final sector end. */
  sectorBoundaries?: { id: number; position: { latitude: number; longitude: number } }[];
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

  return (
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
    </MapView>
  );
}
