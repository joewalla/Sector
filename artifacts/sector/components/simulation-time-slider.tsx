import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type SimulationTimeSliderProps = {
  value: number;
  duration: number;
  valueText: string;
  onSeek: (seconds: number) => void;
};

/** Native responder slider; the web counterpart uses a keyboard-accessible range input. */
export default function SimulationTimeSlider({ value, duration, valueText, onSeek }: SimulationTimeSliderProps) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const dragStart = useRef({ x: 0, seconds: 0 });
  const usableWidth = Math.max(0, width - 24);
  const fraction = duration > 0 ? value / duration : 0;
  const seekAt = (x: number) => {
    if (usableWidth > 0) onSeek(Math.max(0, Math.min(duration, (x - 12) / usableWidth * duration)));
  };
  const begin = (event: GestureResponderEvent) => {
    dragStart.current = { x: event.nativeEvent.pageX, seconds: value };
    seekAt(event.nativeEvent.locationX);
    // Movement uses page coordinates, which do not change when the thumb moves.
    dragStart.current.seconds = usableWidth > 0
      ? Math.max(0, Math.min(duration, (event.nativeEvent.locationX - 12) / usableWidth * duration)) : value;
  };
  return (
    <View
      testID="simulation-scrubber"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Inspect elapsed route time"
      accessibilityHint="Adjusting pauses playback and makes this run inspection only."
      accessibilityValue={{ min: 0, max: duration, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment') onSeek(Math.min(duration, value + 1));
        if (nativeEvent.actionName === 'decrement') onSeek(Math.max(0, value - 1));
      }}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={begin}
      onResponderMove={({ nativeEvent }) => {
        if (usableWidth > 0) onSeek(Math.max(0, Math.min(duration,
          dragStart.current.seconds + (nativeEvent.pageX - dragStart.current.x) / usableWidth * duration)));
      }}
      style={styles.touchArea}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.secondary }]}>
        <View style={[styles.fill, { backgroundColor: colors.primary, width: `${fraction * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { backgroundColor: colors.primary, left: fraction * usableWidth }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: { height: 44, justifyContent: 'center', paddingHorizontal: 12 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: 10 },
});
