import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Eyebrow, InfoPanel } from '@/components/sector-ui';
import RouteMapPreview from './route-map-preview';
import { buildSimulationRoute, sampleSimulation } from '@/simulation/route-simulation';
import { buildSimulationSectors, sampleSectorSplits, type PracticeSectorCount } from '@/simulation/sector-timing';
import SimulationSectorSplits from './simulation-sector-splits';
import PracticeSectorConfig from './practice-sector-config';

type Status = 'idle' | 'running' | 'paused' | 'finished' | 'ended';
const SPEEDS = [1, 20, 60, 120] as const;
type Speed = (typeof SPEEDS)[number];
const TICK_MS = 250;

const miles = (m: number) => `${(Math.max(0, m) / 1609.344).toFixed(m < 1609 ? 2 : 1)} mi`;
function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(r).padStart(2, '0')}`;
}
function tap() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
}

export default function RouteSimulation({
  route,
  destinationName,
}: {
  route: RoutePreviewResponse;
  destinationName: string;
}) {
  const colors = useColors();
  const built = useMemo(() => {
    try {
      return { model: buildSimulationRoute(route), failed: false };
    } catch {
      return { model: null, failed: true };
    }
  }, [route]);
  const model = built.model;
  const [sectorCount, setSectorCount] = useState<PracticeSectorCount>(3);
  const sectors = useMemo(() => model ? buildSimulationSectors(model, sectorCount) : null, [model, sectorCount]);
  // Memory-only practice comparison. Cleared on unmount (parent keys this component by route).
  const [lastCompleted, setLastCompleted] = useState<number[] | null>(null);
  const [baseline, setBaseline] = useState<number[] | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [speed, setSpeed] = useState<Speed>(20);
  const [elapsed, setElapsed] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const elapsedRef = useRef(0);
  const speedRef = useRef<Speed>(20);
  const statusRef = useRef<Status>('idle');
  speedRef.current = speed;

  const go = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  // Monotonic playback clock; changing the device's date must not affect practice splits.
  useEffect(() => {
    if (status !== 'running' || !model) return;
    let last = performance.now();
    const id = setInterval(() => {
      // Synchronous guard: autoPause flips the ref before React re-renders and clears this interval.
      if (statusRef.current !== 'running') return;
      const now = performance.now();
      const delta = ((now - last) / 1000) * speedRef.current;
      last = now;
      const next = Math.min(model.durationSeconds, elapsedRef.current + delta);
      elapsedRef.current = next;
      setElapsed(next);
      if (sampleSimulation(model, next).finished) {
        go('finished');
        if (sectors) {
          // Analytical boundary times from elapsed, independent of tick timing and playback rate.
          const final = sampleSectorSplits(sectors, model.durationSeconds);
          if (final.every((x) => x.status === 'complete')) setLastCompleted(final.map((x) => x.splitSeconds));
        }
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status, model, sectors, go]);

  const autoPause = useCallback(() => {
    if (statusRef.current === 'running') {
      go('paused');
      setAutoPaused(true);
    }
  }, [go]);

  // Pause when the screen loses focus.
  useFocusEffect(useCallback(() => () => autoPause(), [autoPause]));

  // Pause when the app backgrounds or the browser tab is hidden.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') autoPause();
    });
    const doc = Platform.OS === 'web' ? (globalThis as { document?: Document }).document : undefined;
    const onVisibility = () => {
      if (doc?.visibilityState === 'hidden') autoPause();
    };
    doc?.addEventListener('visibilitychange', onVisibility);
    return () => {
      sub.remove();
      doc?.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoPause]);

  const sample = useMemo(() => (model ? sampleSimulation(model, elapsed) : null), [model, elapsed]);
  const splits = useMemo(() => (sectors ? sampleSectorSplits(sectors, elapsed) : null), [sectors, elapsed]);
  const boundaries = useMemo(
    () => sectors?.slice(0, -1).map((x) => ({ id: x.id, position: x.endPosition })) ?? undefined,
    [sectors],
  );
  const active = status === 'running' || status === 'paused';
  const done = status === 'finished' || status === 'ended';

  if (built.failed || !model || !sample) {
    return (
      <View style={styles.section} testID="route-simulation">
        <Eyebrow>ROUTE SIMULATION · NOT REAL DRIVING</Eyebrow>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
          <Text accessibilityRole="alert" style={[styles.heading, { color: colors.foreground }]}>Simulation unavailable</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            This Mapbox route has no usable geometry or distance, so it cannot be replayed. The route preview above is unaffected.
          </Text>
        </View>
      </View>
    );
  }

  const start = () => {
    tap();
    // Only a fully completed replay becomes the baseline; partial runs never overwrite it.
    if (lastCompleted) setBaseline(lastCompleted);
    elapsedRef.current = 0;
    setElapsed(0);
    setAutoPaused(false);
    go('running');
  };
  const togglePause = () => {
    tap();
    setAutoPaused(false);
    go(statusRef.current === 'running' ? 'paused' : 'running');
  };
  const endEarly = () => {
    tap();
    setAutoPaused(false);
    go('ended');
  };
  const changeSectorCount = (next: PracticeSectorCount) => {
    if (statusRef.current === 'running' || statusRef.current === 'paused' || next === sectorCount) return;
    tap();
    setSectorCount(next);
    setLastCompleted(null);
    setBaseline(null);
    elapsedRef.current = 0;
    setElapsed(0);
    setAutoPaused(false);
    go('idle');
  };

  const pct = Math.min(100, Math.max(0, sample.progress * 100));

  return (
    <View style={styles.section} testID="route-simulation">
      <Eyebrow>ROUTE SIMULATION · NOT REAL DRIVING</Eyebrow>
      {sectors ? (
        <PracticeSectorConfig count={sectorCount} sectors={sectors} locked={active} onChange={changeSectorCount} />
      ) : null}

      {status === 'idle' ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Rehearse this route</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Plays back the real Mapbox geometry and {model.stepCount} steps at Mapbox estimated speeds. No GPS is used and nothing is saved.
          </Text>
          <SpeedPicker speed={speed} onChange={setSpeed} />
          <Pressable
            accessibilityRole="button"
            testID="simulation-start"
            onPress={start}
            style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Start simulation</Text>
            <Feather name="play" size={17} color={colors.primaryForeground} />
          </Pressable>
          {splits ? <SimulationSectorSplits splits={splits} baseline={lastCompleted} mode="idle" /> : null}
        </View>
      ) : null}

      {active ? (
        <>
          <View style={[styles.instructionCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.tag, { color: colors.accentForeground }]}>
                CURRENT ·{' '}
                STEP {Math.min(sample.stepIndex + 1, model.stepCount)} OF {model.stepCount}
              </Text>
              <Text style={[styles.tag, { color: status === 'paused' ? colors.signalBlue : colors.primary }]}>
                {status === 'paused' ? (autoPaused ? 'PAUSED · SCREEN LEFT' : 'PAUSED') : `SIMULATING ${speed}x`}
              </Text>
            </View>
            <Text accessibilityLiveRegion="polite" style={[styles.instruction, { color: colors.foreground }]}>
              {sample.instruction}
            </Text>
            <Text style={[styles.distance, { color: colors.primary }]}>
              {sample.nextInstruction ? `Next instruction in ${miles(sample.distanceToNextMeters)}` : `Arrival in ${miles(sample.distanceToNextMeters)}`}
            </Text>
            {sample.nextInstruction ? (
              <View style={[styles.next, { borderColor: colors.border }]}>
                <Feather name="corner-down-right" size={14} color={colors.mutedForeground} />
                <Text numberOfLines={2} style={[styles.nextText, { color: colors.mutedForeground }]}>
                  Next: {sample.nextInstruction}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.metrics}>
              <Metric value={miles(sample.remainingMeters)} label="remaining (simulated)" />
              <Metric value={clock(sample.remainingSeconds)} label="Mapbox estimate left" />
              <Metric value={`${pct.toFixed(1)}%`} label="progress" />
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
              style={[styles.track, { backgroundColor: colors.secondary }]}
            >
              <View style={[styles.fill, { backgroundColor: colors.primary, transform: [{ scaleX: pct / 100 }] }]} />
            </View>
          </View>

          <RouteMapPreview route={route} destinationName={destinationName} position={sample.position} sectorBoundaries={boundaries} />
          <SpeedPicker speed={speed} onChange={setSpeed} />
          <View style={styles.controls}>
            <Control icon={status === 'running' ? 'pause' : 'play'} label={status === 'running' ? 'Pause' : 'Resume'} onPress={togglePause} primary testID="simulation-toggle" />
            <Control icon="rotate-ccw" label="Restart" onPress={start} testID="simulation-restart" />
            <Control icon="square" label="End early" onPress={endEarly} danger testID="simulation-end" />
          </View>
          {splits ? <SimulationSectorSplits splits={splits} baseline={baseline} mode="active" /> : null}
        </>
      ) : null}

      {done ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.tag, { color: status === 'finished' ? colors.primary : colors.signalBlue }]}>
            {status === 'finished' ? 'SIMULATION COMPLETE' : 'SIMULATION ENDED EARLY'}
          </Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            {status === 'finished' ? `Reached ${destinationName}` : `Stopped before ${destinationName}`}
          </Text>
          <View style={styles.metrics}>
            <Metric value={miles(sample.traveledMeters)} label="simulated distance" />
            <Metric value={clock(elapsed)} label="simulated route time" />
            <Metric value={`${pct.toFixed(1)}%`} label="of route covered" />
          </View>
          {splits ? <SimulationSectorSplits splits={splits} baseline={baseline} mode="done" /> : null}
          {status === 'ended' ? (
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              {miles(sample.remainingMeters)} and about {clock(sample.remainingSeconds)} of the Mapbox estimate were not simulated.
            </Text>
          ) : null}
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Times come from Mapbox estimates, not your driving. This is not a journey record and no bests were changed.
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="simulation-again"
            onPress={start}
            style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Simulate again</Text>
            <Feather name="rotate-ccw" size={17} color={colors.primaryForeground} />
          </Pressable>
        </View>
      ) : null}

      <InfoPanel
        icon="cpu"
        title="Simulation only"
        body="No GPS, no background tracking and no persistence. Position is interpolated along the Mapbox route at estimated speeds."
      />
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function SpeedPicker({ speed, onChange }: { speed: Speed; onChange: (s: Speed) => void }) {
  const colors = useColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Playback speed" style={[styles.speeds, { backgroundColor: colors.secondary }]}>
      {SPEEDS.map((s) => {
        const selected = s === speed;
        return (
          <Pressable
            key={s}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            testID={`simulation-speed-${s}`}
            onPress={() => {
              tap();
              onChange(s);
            }}
            style={({ pressed }) => [styles.speed, selected && { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={[styles.speedText, { color: selected ? colors.primaryForeground : colors.secondaryForeground }]}>{s}x</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Control({
  icon,
  label,
  onPress,
  primary,
  danger,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  testID: string;
}) {
  const colors = useColors();
  const fg = primary ? colors.primaryForeground : danger ? colors.destructive : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        { backgroundColor: primary ? colors.primary : colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={16} color={fg} />
      <Text style={[styles.controlText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4 },
  body: { fontSize: 12, lineHeight: 18 },
  primary: { minHeight: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  primaryText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  instructionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tag: { fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  instruction: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.6 },
  distance: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  next: { flexDirection: 'row', gap: 8, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  nextText: { flex: 1, fontSize: 12, lineHeight: 17 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, gap: 3 },
  metricValue: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 9 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, width: '100%', transformOrigin: 'left' },
  speeds: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  speed: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  speedText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', gap: 8 },
  control: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  controlText: { fontSize: 12, fontWeight: '700' },
});
