import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  SIMULATED_STOP_DURATIONS,
  type SimulatedStopConfig,
} from '@/simulation/simulated-stop';

export default function SimulationStopConfig({
  value, sectorCount, locked, onChange,
}: {
  value: SimulatedStopConfig;
  sectorCount: number;
  locked: boolean;
  onChange: (next: SimulatedStopConfig) => void;
}) {
  const colors = useColors();
  const enabled = value.durationSeconds > 0;
  const options = (kind: 'duration' | 'sector', values: number[]) => (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={kind === 'duration' ? 'Simulated stop duration' : 'Sector containing the simulated stop'}
      style={styles.options}
    >
      {values.map((option) => {
        const selected = option === (kind === 'duration' ? value.durationSeconds : value.sectorId);
        const label = kind === 'duration' ? option === 0 ? 'Off' : `${option}s` : `S${option}`;
        return (
          <Pressable
            key={option}
            testID={`simulated-stop-${kind}-${option}`}
            accessibilityRole="radio"
            accessibilityLabel={kind === 'duration'
              ? option === 0 ? 'No simulated stop' : `${option} simulated seconds`
              : `Stop halfway through sector ${option}`}
            accessibilityState={{ selected, disabled: locked }}
            disabled={locked}
            onPress={() => onChange(kind === 'duration'
              ? { ...value, durationSeconds: option as SimulatedStopConfig['durationSeconds'] }
              : { ...value, sectorId: option })}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: selected ? colors.primary : colors.secondary, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.optionText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <View testID="simulated-stop-config" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Optional simulated stop</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Add a stationary delay to practise timing. This is a synthetic stop, not measured driving or live traffic.
      </Text>
      {options('duration', [...SIMULATED_STOP_DURATIONS])}
      {enabled ? (
        <>
          <Text style={[styles.body, { color: colors.foreground }]}>Choose the practice sector</Text>
          {options('sector', Array.from({ length: sectorCount }, (_, index) => index + 1))}
        </>
      ) : null}
      <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.signalBlue }]}>
        {enabled ? `Add ${value.durationSeconds}s halfway through S${value.sectorId}. Only that sector's split gains the delay.` : 'Off · replay only the Mapbox route estimate.'}
      </Text>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        {locked
          ? 'Stop settings are locked while running or paused. Playback Pause also freezes the stop countdown.'
          : 'Changes clear the previous replay comparison. Mapbox estimates stay unchanged; no extra route request or GPS is used.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12, lineHeight: 18 },
  note: { fontSize: 10, lineHeight: 16 },
  options: { flexDirection: 'row', gap: 5 },
  option: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
