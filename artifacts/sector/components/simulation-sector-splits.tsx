import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type SplitStatus = 'pending' | 'active' | 'complete';
export type SectorSplitView = {
  id: number;
  startMeters: number;
  endMeters: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  status: SplitStatus;
  splitSeconds: number;
  cumulativeSeconds: number | null;
};

const miles = (m: number) => `${(Math.max(0, m) / 1609.344).toFixed(m < 1609 ? 2 : 1)} mi`;
export function splitClock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
function delta(seconds: number) {
  const r = Math.round(seconds);
  if (r === 0) return 'match';
  return `${r > 0 ? '+' : '-'}${splitClock(Math.abs(r))}`;
}

export default function SimulationSectorSplits({
  splits,
  baseline,
  mode,
}: {
  splits: SectorSplitView[];
  /** Completed split seconds from the previous fully completed replay, in sector order. */
  baseline?: number[] | null;
  mode: 'idle' | 'active' | 'done';
}) {
  const colors = useColors();
  const hasBaseline = !!baseline && baseline.length === splits.length;
  return (
    <View testID="simulation-sector-splits" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.tag, { color: colors.primary }]}>SIMULATED SECTOR SPLITS</Text>
        <Text style={[styles.tag, { color: colors.mutedForeground }]}>{splits.length} EQUAL-DISTANCE</Text>
      </View>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {mode === 'idle'
          ? 'Sector times are Mapbox estimates on this frozen route. Replaying it gives the same splits at any playback speed.'
          : 'Practice only. Times are Mapbox estimates, separate from real journeys and personal bests.'}
      </Text>
      {splits.map((s) => {
        const pct = s.status === 'complete' ? 1 : s.status === 'active' && s.durationSeconds > 0
          ? Math.min(1, s.splitSeconds / s.durationSeconds) : 0;
        const tone = s.status === 'complete' ? colors.primary : s.status === 'active' ? colors.signalBlue : colors.mutedForeground;
        const base = hasBaseline ? baseline![s.id - 1] : null;
        const stateLabel = mode === 'idle' ? 'ESTIMATE' : s.status === 'complete' ? 'COMPLETE' : s.status === 'active' ? (mode === 'done' ? 'PARTIAL' : 'CURRENT') : 'NOT REACHED';
        return (
          <View
            key={s.id}
            testID={`sector-split-${s.id}`}
            accessibilityLabel={`Sector ${s.id}, ${stateLabel.toLowerCase()}, split ${splitClock(s.splitSeconds)}, estimate ${splitClock(s.durationSeconds)}`}
            style={[styles.row, { borderColor: s.status === 'active' && mode !== 'idle' ? colors.signalBlue : colors.border }]}
          >
            <View style={styles.rowBetween}>
              <Text style={[styles.sector, { color: colors.foreground }]}>S{s.id}</Text>
              <Text style={[styles.tag, { color: mode === 'idle' ? colors.mutedForeground : tone }]}>{stateLabel}</Text>
            </View>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {miles(s.startMeters)} to {miles(s.endMeters)} · est. {splitClock(s.durationSeconds)}
            </Text>
            {mode !== 'idle' ? (
              <>
                <View style={[styles.track, { backgroundColor: colors.secondary }]}>
                  <View style={[styles.fill, { backgroundColor: tone, transform: [{ scaleX: pct }] }]} />
                </View>
                <View style={styles.rowBetween}>
                  <Text style={[styles.value, { color: s.status === 'pending' ? colors.mutedForeground : colors.foreground }]}>
                    {s.status === 'pending' ? '--:--' : splitClock(s.splitSeconds)}
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}> split</Text>
                  </Text>
                  <Text style={[styles.value, { color: colors.mutedForeground }]}>
                    {s.cumulativeSeconds == null ? '--:--' : splitClock(s.cumulativeSeconds)}
                    <Text style={styles.meta}> total</Text>
                  </Text>
                </View>
                {base != null ? (
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    Previous replay {splitClock(base)}
                    {s.status === 'complete' ? ` · ${delta(s.splitSeconds - base)}` : ''}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}
      <Text style={[styles.meta, { color: colors.mutedForeground }]}>
        {hasBaseline
          ? 'Comparing with your previous completed replay. Kept in memory only; cleared when this route is replaced, the screen is closed, or the app reloads.'
          : 'Complete a replay to compare the next one. Memory only; cleared when this route is replaced, the screen is closed, or the app reloads.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tag: { fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  body: { fontSize: 12, lineHeight: 18 },
  row: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 6 },
  sector: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  meta: { fontSize: 10, fontVariant: ['tabular-nums'] },
  value: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, width: '100%', transformOrigin: 'left' },
});
