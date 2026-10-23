import MapView, { Marker, Polyline } from 'react-native-maps';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function RouteMapPreview({
  route,
  destinationName,
}: {
  route: RoutePreviewResponse;
  destinationName: string;
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
    </MapView>
  );
}
