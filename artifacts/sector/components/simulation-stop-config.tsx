import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { handleRadioGroupArrowKey, radioOptionTabIndex } from './radio-group';
import {
  SIMULATED_STOP_DURATIONS,
  MAX_SIMULATED_STOPS,
  type SimulatedStopConfig,
} from '@/simulation/simulated-stop';

export default function SimulationStopConfig({
  value, sectorCount, locked, onChange,
}: {
  value: SimulatedStopConfig[];
  sectorCount: number;
  locked: boolean;
  onChange: (next: SimulatedStopConfig[]) => void;
}) {
  const colors = useColors();
  const update = (index: number, next: SimulatedStopConfig) => {
    if (locked) return;
    if (next.durationSeconds === 0) onChange(value.filter((_, i) => i !== index));
    else if (!value.length) onChange([next]);
    else onChange(value.map((item, i) => i === index ? next : item));
  };
  const options = (kind: 'duration' | 'sector', values: number[], item: SimulatedStopConfig, index: number) => (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={`Stop ${index + 1}: ${kind === 'duration' ? 'duration' : 'practice sector'}`}
      style={styles.options}
    >
      {values.map((option) => {
        const selected = option === (kind === 'duration' ? item.durationSeconds : item.sectorId);
        const label = kind === 'duration' ? option === 0 ? 'Off' : `${option}s` : `S${option}`;
        return (
          <Pressable
            key={option}
            testID={index === 0 ? `simulated-stop-${kind}-${option}` : `simulated-stop-${index + 1}-${kind}-${option}`}
            accessibilityRole="radio"
            accessibilityLabel={kind === 'duration'
              ? `Stop ${index + 1}: ${option === 0 ? 'No simulated stop' : `${option} simulated seconds`}`
              : `Stop ${index + 1} in sector ${option}`}
            aria-checked={selected}
            accessibilityState={{ disabled: locked }}
            tabIndex={radioOptionTabIndex(selected, locked)}
            disabled={locked}
            onPress={() => update(index, kind === 'duration'
              ? { ...item, durationSeconds: option as SimulatedStopConfig['durationSeconds'] }
              : { ...item, sectorId: option })}
            onKeyDown={(event) => handleRadioGroupArrowKey(event, values, (nextOption) => update(
              index,
              kind === 'duration'
                ? { ...item, durationSeconds: nextOption as SimulatedStopConfig['durationSeconds'] }
                : { ...item, sectorId: nextOption },
            ), locked)}
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
      <Text style={[styles.title, { color: colors.foreground }]}>Optional simulated stops · {value.length}/{MAX_SIMULATED_STOPS}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Add up to three stationary delays to practise timing. These are synthetic stops, not measured driving or live traffic.
      </Text>
      {(value.length ? value : [{ sectorId: 1, durationSeconds: 0 as const }]).map((item, index) => {
        const local = value.filter((stop) => stop.sectorId === item.sectorId);
        const ordinal = value.slice(0, index).filter((stop) => stop.sectorId === item.sectorId).length + 1;
        return (
          <View key={index} style={styles.stop}>
            <Text style={[styles.title, { color: colors.foreground }]}>Stop {index + 1}</Text>
            {options('duration', [...SIMULATED_STOP_DURATIONS], item, index)}
            {item.durationSeconds > 0 ? (
              <>
                <Text style={[styles.body, { color: colors.foreground }]}>Choose the practice sector · Off removes this stop</Text>
                {options('sector', Array.from({ length: sectorCount }, (_, i) => i + 1), item, index)}
                <Text style={[styles.body, { color: colors.signalBlue }]}>
                  +{item.durationSeconds}s in S{item.sectorId} · position {ordinal} of {local.length}, {Math.round(ordinal / (local.length + 1) * 100)}% through the sector
                </Text>
              </>
            ) : null}
          </View>
        );
      })}
      {value.length > 0 ? (
        <Pressable
          testID="simulated-stop-add"
          accessibilityRole="button"
          accessibilityLabel="Add simulated stop"
          accessibilityState={{ disabled: locked || value.length >= MAX_SIMULATED_STOPS }}
          disabled={locked || value.length >= MAX_SIMULATED_STOPS}
          onPress={() => { if (!locked && value.length < MAX_SIMULATED_STOPS) onChange([...value, { sectorId: 1, durationSeconds: 30 }]); }}
          style={[styles.option, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        >
          <Text style={[styles.optionText, { color: colors.foreground }]}>{value.length >= MAX_SIMULATED_STOPS ? 'Three-stop limit reached' : 'Add simulated stop'}</Text>
        </Pressable>
      ) : null}
      <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.signalBlue }]}>
        {value.length ? `Total added: ${value.reduce((sum, stop) => sum + stop.durationSeconds, 0)}s. Stops in the same sector are evenly spaced inside it; only that sector gains their delay.` : 'Off · replay only the Mapbox route estimate.'}
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
  stop: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12 },
  note: { fontSize: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  option: { flexGrow: 1, flexBasis: 40, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
