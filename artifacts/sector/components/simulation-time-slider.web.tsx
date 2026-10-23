import { useColors } from '@/hooks/useColors';
import type { SimulationTimeSliderProps } from './simulation-time-slider';

export default function SimulationTimeSlider({ value, duration, valueText, onSeek }: SimulationTimeSliderProps) {
  const colors = useColors();
  return (
    <input
      data-testid="simulation-scrubber"
      type="range"
      aria-label="Inspect elapsed route time"
      aria-valuetext={valueText}
      min={0}
      max={duration}
      step="any"
      value={value}
      onChange={(event) => onSeek(Number(event.currentTarget.value))}
      onKeyDown={(event) => {
        // Explicit increments also work with step="any", including fractional sector boundaries.
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? duration
          : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? value + 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? value - 1 : null;
        if (next !== null) {
          event.preventDefault();
          onSeek(Math.max(0, Math.min(duration, next)));
        }
      }}
      style={{ width: '100%', minWidth: 0, height: 44, margin: 0, accentColor: colors.primary, cursor: 'pointer' }}
    />
  );
}
