import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Eyebrow, InfoPanel } from '@/components/sector-ui';
import RouteMapPreview from './route-map-preview';
import { advancePlaybackClock, buildSimulationRoute, sampleSimulation } from '@/simulation/route-simulation';
import { buildSimulationSectors, sampleSectorSplits, type PracticeSectorCount } from '@/simulation/sector-timing';
import { configureSimulatedStop, sampleSimulatedStop, type SimulatedStopConfig } from '@/simulation/simulated-stop';
import SimulationSectorSplits from './simulation-sector-splits';
import PracticeSectorConfig from './practice-sector-config';
import SimulationStopConfig from './simulation-stop-config';
import SimulationTimeSlider from './simulation-time-slider';

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
  const reference = built.model;
  const [sectorCount, setSectorCount] = useState<PracticeSectorCount>(3);
  const [stopConfig, setStopConfig] = useState<SimulatedStopConfig>({ sectorId: 1, durationSeconds: 0 });
  const configured = useMemo(() => reference ? configureSimulatedStop(reference, sectorCount, stopConfig) : null,
    [reference, sectorCount, stopConfig]);
  const model = configured?.model ?? null;
  const stop = configured?.stop ?? null;
  const referenceSectors = useMemo(() => reference ? buildSimulationSectors(reference, sectorCount) : null, [reference, sectorCount]);
  const sectors = useMemo(() => model ? buildSimulationSectors(model, sectorCount) : null, [model, sectorCount]);
  // Memory-only practice comparison. Cleared on unmount (parent keys this component by route).
  const [lastCompleted, setLastCompleted] = useState<number[] | null>(null);
  const [baseline, setBaseline] = useState<number[] | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [speed, setSpeed] = useState<Speed>(20);
  const [elapsed, setElapsed] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const [inspectionOnly, setInspectionOnly] = useState(false);
  // Synchronous guard prevents an already queued clock tick from promoting a scrubbed run.
  const inspectionRef = useRef(false);
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
      const delta = (now - last) / 1000;
      last = now;
      const next = advancePlaybackClock({
        elapsedSeconds: elapsedRef.current,
        deltaSeconds: delta,
        rate: speedRef.current,
        durationSeconds: model.durationSeconds,
        running: statusRef.current === 'running',
      });
      elapsedRef.current = next;
      setElapsed(next);
      if (sampleSimulation(model, next).finished) {
        go('finished');
        if (sectors && !inspectionRef.current) {
          // Analytical boundary times from elapsed, independent of tick timing and playback rate.
          const final = sampleSectorSplits(sectors, model.durationSeconds);
          if (final.every((x) => x.status === 'complete')) setLastCompleted(final.map((x) => x.splitSeconds));
        }
        if (!inspectionRef.current && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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
    const browserWindow = Platform.OS === 'web' ? globalThis.window : undefined;
    const onVisibility = () => {
      if (doc?.visibilityState === 'hidden') autoPause();
    };
    doc?.addEventListener('visibilitychange', onVisibility);
    browserWindow?.addEventListener('blur', autoPause);
    return () => {
      sub.remove();
      doc?.removeEventListener('visibilitychange', onVisibility);
      browserWindow?.removeEventListener('blur', autoPause);
    };
  }, [autoPause]);

  const sample = useMemo(() => (model ? sampleSimulation(model, elapsed) : null), [model, elapsed]);
  const splits = useMemo(() => sectors ? sampleSectorSplits(sectors, elapsed).map((split, index) => ({
    ...split,
    mapboxDurationSeconds: referenceSectors![index].durationSeconds,
    syntheticStopSeconds: stop?.sectorId === split.id ? stop.durationSeconds : 0,
  })) : null, [sectors, elapsed, referenceSectors, stop]);
  const stopSample = useMemo(() => sampleSimulatedStop(stop, elapsed), [stop, elapsed]);
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
    inspectionRef.current = false;
    setInspectionOnly(false);
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
  const resetConfiguration = () => {
    inspectionRef.current = false;
    setInspectionOnly(false);
    setLastCompleted(null);
    setBaseline(null);
    elapsedRef.current = 0;
    setElapsed(0);
    setAutoPaused(false);
    go('idle');
  };
  const seek = (seconds: number) => {
    if (!Number.isFinite(seconds)) return;
    // Inspection always pauses, including at the endpoint. Only Restart starts a clean replay.
    inspectionRef.current = true;
    setInspectionOnly(true);
    go('paused');
    setAutoPaused(false);
    const next = Math.max(0, Math.min(model.durationSeconds, seconds));
    elapsedRef.current = next;
    setElapsed(next);
  };
  const changeSectorCount = (next: PracticeSectorCount) => {
    if (statusRef.current === 'running' || statusRef.current === 'paused' || next === sectorCount) return;
    tap();
    setSectorCount(next);
    setStopConfig((previous) => ({ ...previous, sectorId: Math.min(previous.sectorId, next) }));
    resetConfiguration();
  };
  const changeStopConfig = (next: SimulatedStopConfig) => {
    if (statusRef.current === 'running' || statusRef.current === 'paused'
      || (next.sectorId === stopConfig.sectorId && next.durationSeconds === stopConfig.durationSeconds)) return;
    tap();
    setStopConfig(next);
    resetConfiguration();
  };

  const pct = Math.min(100, Math.max(0, sample.progress * 100));

  return (
    <View style={styles.section} testID="route-simulation">
      <Eyebrow>ROUTE SIMULATION · NOT REAL DRIVING</Eyebrow>
      {sectors ? (
        <PracticeSectorConfig count={sectorCount} sectors={sectors} locked={active} onChange={changeSectorCount} />
      ) : null}
      <SimulationStopConfig value={stopConfig} sectorCount={sectorCount} locked={active} onChange={changeStopConfig} />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Inspect route time</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Drag to any point or select a sector boundary. Scrubbing pauses playback and excludes this run from replay comparisons. Restart for a comparable replay.
        </Text>
        <Text testID="simulation-selected-time" style={[styles.body, { color: colors.foreground }]}>
          {clock(elapsed)} / {clock(model.durationSeconds)} · {stop ? 'includes synthetic delay' : 'Mapbox route time'}
        </Text>
        <SimulationTimeSlider value={elapsed} duration={model.durationSeconds} valueText={`${clock(elapsed)} of ${clock(model.durationSeconds)}`} onSeek={seek} />
        <View style={styles.seekPoints}>
          {[{ label: 'Start', seconds: 0 }, ...(sectors ?? []).map((sector) => ({
            label: sector.id === sectorCount ? 'Finish' : `S${sector.id} end`,
            seconds: sector.endSeconds,
          }))].map(({ label, seconds }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Inspect ${label}, ${clock(seconds)}`}
              testID={`simulation-seek-${label === 'Start' ? 'start' : label === 'Finish' ? 'finish' : label.split(' ')[0]}`}
              onPress={() => { tap(); seek(seconds); }}
              style={({ pressed }) => [styles.seekPoint, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
            >
              <Text style={[styles.body, { color: colors.secondaryForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {inspectionOnly ? (
          <Text testID="simulation-inspection-state" accessibilityLiveRegion="polite" style={[styles.body, { color: colors.signalBlue }]}>
            Inspection only · splits show the selected time, not a completed replay. No comparison baseline will be saved.
          </Text>
        ) : null}
      </View>

      {status === 'idle' ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Rehearse this route</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Plays back the real Mapbox geometry and {model.stepCount} steps using Mapbox estimates{stop ? ' plus your synthetic stop' : ''}. No GPS is used and nothing is persisted.
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
          {stop ? (
            <InfoPanel
              icon="clock"
              title={stopSample.phase === 'holding' ? `Synthetic stop · ${Math.ceil(stopSample.remainingSeconds)}s left`
                : stopSample.phase === 'passed' ? 'Synthetic stop completed' : `Synthetic stop planned in S${stop.sectorId}`}
              body={stopSample.phase === 'holding'
                ? `The simulated marker is stationary halfway through S${stop.sectorId}. This ${stop.durationSeconds}s delay is not live traffic. Pause freezes the countdown.`
                : `Added delay: ${stop.durationSeconds}s in S${stop.sectorId}, separate from the original Mapbox estimate.`}
            />
          ) : null}
          <View style={[styles.instructionCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.tag, { color: colors.accentForeground }]}>
                CURRENT ·{' '}
                STEP {Math.min(sample.stepIndex + 1, model.stepCount)} OF {model.stepCount}
              </Text>
              <Text testID="simulation-playback-state" style={[styles.tag, { color: status === 'paused' ? colors.signalBlue : colors.primary }]}>
                {inspectionOnly ? (status === 'paused' ? 'INSPECTION · PAUSED' : `INSPECTION · ${speed}x`)
                  : status === 'paused' ? (autoPaused ? 'PAUSED · SCREEN LEFT' : 'PAUSED') : `SIMULATING ${speed}x`}
              </Text>
            </View>
            <Text accessibilityLiveRegion="polite" style={[styles.instruction, { color: colors.foreground }]}>
              {sample.instruction}
            </Text>
            <Text style={[styles.distance, { color: colors.primary }]}>
              {stopSample.phase === 'holding' ? `Synthetic delay · ${Math.ceil(stopSample.remainingSeconds)}s remaining`
                : sample.nextInstruction ? `Next instruction in ${miles(sample.distanceToNextMeters)}` : `Arrival in ${miles(sample.distanceToNextMeters)}`}
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
              <Metric value={clock(sample.remainingSeconds)} label={stop ? 'simulated time left' : 'Mapbox estimate left'} />
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
          {splits ? <SimulationSectorSplits splits={splits} baseline={inspectionOnly ? null : baseline} mode={inspectionOnly ? 'inspection' : 'active'} /> : null}
        </>
      ) : null}

      {done ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text testID="simulation-result-state" style={[styles.tag, { color: status === 'finished' ? colors.primary : colors.signalBlue }]}>
            {inspectionOnly ? 'INSPECTION ONLY · NO BASELINE SAVED' : status === 'finished' ? 'SIMULATION COMPLETE' : 'SIMULATION ENDED EARLY'}
          </Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            {inspectionOnly ? `Inspected route to ${destinationName}` : status === 'finished' ? `Reached ${destinationName}` : `Stopped before ${destinationName}`}
          </Text>
          <View style={styles.metrics}>
            <Metric value={miles(sample.traveledMeters)} label="simulated distance" />
            <Metric value={clock(elapsed)} label="simulated route time" />
            <Metric value={`${pct.toFixed(1)}%`} label="of route covered" />
          </View>
          {stop ? (
            <InfoPanel
              icon="clock"
              title="Mapbox estimate + synthetic delay"
              body={inspectionOnly
                ? `Selected route time: ${clock(elapsed - stopSample.elapsedSeconds)} of Mapbox time + ${clock(stopSample.elapsedSeconds)} of synthetic delay. These are inspected values, not a replay record.`
                : status === 'finished'
                ? `Original Mapbox estimate ${clock(reference!.durationSeconds)} + synthetic stop ${clock(stop.durationSeconds)} = simulated total ${clock(elapsed)}. The added delay belongs to S${stop.sectorId}.`
                : `Replayed Mapbox time ${clock(elapsed - stopSample.elapsedSeconds)} + ${clock(stopSample.elapsedSeconds)} of the configured ${clock(stop.durationSeconds)} synthetic stop. Unreached time is not counted.`}
            />
          ) : null}
          {splits ? <SimulationSectorSplits splits={splits} baseline={inspectionOnly ? null : baseline} mode={inspectionOnly ? 'inspection' : 'done'} /> : null}
          {status === 'ended' && !inspectionOnly ? (
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              {miles(sample.remainingMeters)} and about {clock(sample.remainingSeconds)} of the {stop ? 'configured simulation' : 'Mapbox estimate'} were not simulated.
            </Text>
          ) : null}
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Times use Mapbox estimates{stop ? ' plus the configured synthetic stop' : ''}, not your driving. This is not a journey record and no bests were changed.
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
        body="No GPS, no background tracking and no persistence. Movement follows Mapbox estimates; optional synthetic stops add a labelled stationary delay."
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
  seekPoints: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  seekPoint: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10 },
  control: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  controlText: { fontSize: 12, fontWeight: '700' },
});
