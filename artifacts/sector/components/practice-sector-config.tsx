import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { handleRadioGroupArrowKey, radioOptionTabIndex } from './radio-group';
import {
  PRACTICE_SECTOR_COUNTS,
  type PracticeSectorCount,
  type SimulationSector,
} from '@/simulation/sector-timing';

function distanceLabel(meters: number) {
  return `${(meters / 1609.344).toFixed(2)} mi`;
}

export default function PracticeSectorConfig({
  count,
  sectors,
  locked,
  onChange,
}: {
  count: PracticeSectorCount;
  sectors: SimulationSector[];
  locked: boolean;
  onChange: (count: PracticeSectorCount) => void;
}) {
  const colors = useColors();
  return (
    <View
      testID="practice-sector-config"
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.foreground }]}>Practice sectors</Text>
        {locked ? <Feather name="lock" size={14} color={colors.mutedForeground} /> : null}
      </View>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Divide this same route into equal-distance simulated sectors. No new route request is needed.
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Number of practice sectors" style={styles.options}>
        {PRACTICE_SECTOR_COUNTS.map((value) => {
          const selected = value === count;
          return (
            <Pressable
              key={value}
              testID={`practice-sector-count-${value}`}
              accessibilityRole="radio"
              accessibilityLabel={`${value} equal-distance practice sectors`}
              aria-checked={selected}
              accessibilityState={{ checked: selected, disabled: locked }}
              tabIndex={radioOptionTabIndex(selected, locked)}
              disabled={locked}
              onPress={() => onChange(value)}
              onKeyDown={(event) => handleRadioGroupArrowKey(
                event,
                PRACTICE_SECTOR_COUNTS,
                onChange,
                locked,
              )}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? colors.primary : colors.secondary,
                  borderColor: selected ? colors.primary : colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                {value}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.foreground }]}>
        {count} sectors · approximately {distanceLabel(sectors[0].endMeters)} each
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Boundaries from start: {sectors.map((sector) => `S${sector.id} ${distanceLabel(sector.endMeters)}`).join(' · ')} (arrival)
      </Text>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        {locked
          ? 'Locked while running or paused. End this simulation to change the sectors.'
          : 'Changing the sector count clears the practice replay comparison and returns to the preview. Real history and bests are unaffected.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexGrow: 1, flexBasis: 44, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 10 },
  pressed: { opacity: 0.72 },
});
