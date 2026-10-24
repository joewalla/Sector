import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText, G } from 'react-native-svg';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { clusterPracticeStops, type PracticeStopMarker } from '@/simulation/practice-stop-markers';

const WIDTH = 360;
const HEIGHT = 220;
const PADDING = 28;

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
  if (!Array.isArray(route.geometry) || route.geometry.length < 2
    || route.geometry.some((point) => !point || !Number.isFinite(point.latitude)
      || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180)) {
    return (
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Route shape unavailable. No replacement geometry has been generated.
      </Text>
    );
  }
  const longitudes = route.geometry.map((point) => point.longitude);
  const latitudes = route.geometry.map((point) => point.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeSpan = maxLongitude - minLongitude || 0.0001;
  const latitudeSpan = maxLatitude - minLatitude || 0.0001;
  const points = route.geometry.map((point) => {
    const x = PADDING + ((point.longitude - minLongitude) / longitudeSpan) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((point.latitude - minLatitude) / latitudeSpan) * (HEIGHT - PADDING * 2);
    return `${x},${y}`;
  }).join(' ');
  const start = points.split(' ')[0].split(',').map(Number);
  const marker = position
    ? {
        x: PADDING + ((position.longitude - minLongitude) / longitudeSpan) * (WIDTH - PADDING * 2),
        y: HEIGHT - PADDING - ((position.latitude - minLatitude) / latitudeSpan) * (HEIGHT - PADDING * 2),
      }
    : null;
  const end = points.split(' ').at(-1)!.split(',').map(Number);
  const stopGroups = clusterPracticeStops((practiceStops ?? []).map((stop) => ({
    ...stop,
    x: PADDING + ((stop.position.longitude - minLongitude) / longitudeSpan) * (WIDTH - PADDING * 2),
    y: HEIGHT - PADDING - ((stop.position.latitude - minLatitude) / latitudeSpan) * (HEIGHT - PADDING * 2),
  })));

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} accessibilityLabel="Route shape preview, not a basemap">
        <Polyline points={points} fill="none" stroke={colors.primary} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={start[0]} cy={start[1]} r={8} fill="#7FC8FF" stroke="#080B09" strokeWidth={3} />
        <Circle cx={end[0]} cy={end[1]} r={8} fill="#C9F36A" stroke="#080B09" strokeWidth={3} />
        {sectorBoundaries?.map((b) => {
          const bx = PADDING + ((b.position.longitude - minLongitude) / longitudeSpan) * (WIDTH - PADDING * 2);
          const by = HEIGHT - PADDING - ((b.position.latitude - minLatitude) / latitudeSpan) * (HEIGHT - PADDING * 2);
          return (
            <G key={b.id}>
              <Circle cx={bx} cy={by} r={6} fill={colors.background} stroke={colors.signalBlue} strokeWidth={2.5} />
              <SvgText x={bx + 9} y={by - 7} fill={colors.signalBlue} fontSize={10} fontWeight="700">{`S${b.id}`}</SvgText>
            </G>
          );
        })}
        {marker ? (
          <>
            <Circle cx={marker.x} cy={marker.y} r={14} fill={colors.primary} opacity={0.22} />
            <Circle cx={marker.x} cy={marker.y} r={7} fill={colors.foreground} stroke={colors.background} strokeWidth={3} />
          </>
        ) : null}
        {stopGroups.map((group) => {
          const width = 24 + group.label.length * 6;
          const x = Math.max(width / 2 + 4, Math.min(WIDTH - width / 2 - 4, group.x));
          const y = Math.min(HEIGHT - 14, group.y + 28);
          return (
            <G key={group.key} accessibilityLabel={group.description}>
              {group.members.map((stop) => (
                <G key={stop.number}>
                  <Line x1={stop.x} y1={stop.y} x2={x} y2={y} stroke={colors.foreground} strokeDasharray="3 3" />
                  <Rect x={stop.x - 4} y={stop.y - 4} width={8} height={8} fill={colors.card} stroke={colors.foreground} strokeWidth={2} />
                </G>
              ))}
              <Rect x={x - width / 2} y={y - 11} width={width} height={22} rx={3} fill={colors.card} stroke={colors.foreground} strokeDasharray="4 3" />
              <SvgText x={x} y={y + 4} textAnchor="middle" fill={colors.foreground} fontSize={11} fontWeight="700">{group.label}</SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>START</Text>
        <Text numberOfLines={1} style={[styles.label, styles.destination, { color: colors.foreground }]}>{destinationName}</Text>
      </View>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>Actual Mapbox route shape · {position ? 'simulated position · ' : ''}diagram only, not a map</Text>
      {stopGroups.length ? (
        <Text style={[styles.stopNote, { color: colors.foreground }]}>
          Dashed SIM badges = synthetic practice stops. Nearby labels grouped; squares show positions. Not roadside stops or GPS tracking.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 290, borderWidth: 1, borderRadius: 16, overflow: 'hidden', paddingTop: 14, paddingBottom: 14 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, gap: 12 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  destination: { flex: 1, textAlign: 'right' },
  note: { fontSize: 9, textAlign: 'center', paddingTop: 11 },
  stopNote: { fontSize: 11, lineHeight: 16, paddingHorizontal: 14, paddingTop: 10 },
});
