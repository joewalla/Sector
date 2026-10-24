import { Platform, type KeyDownEvent } from 'react-native';

export function radioOptionTabIndex(selected: boolean, disabled = false): 0 | -1 | undefined {
  if (Platform.OS !== 'web') return undefined;
  return selected && !disabled ? 0 : -1;
}

export function handleRadioGroupArrowKey<T>(
  event: KeyDownEvent,
  values: readonly T[],
  onSelect: (value: T) => void,
  disabled = false,
) {
  if (Platform.OS !== 'web' || disabled || values.length < 2) return;

  const key = event.nativeEvent.key;
  const direction = key === 'ArrowRight' || key === 'ArrowDown' ? 1
    : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (!direction) return;

  const current = event.currentTarget as unknown as HTMLElement;
  const radioOptions = current.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
  const currentIndex = radioOptions ? Array.from(radioOptions).indexOf(current) : -1;
  if (currentIndex < 0) return;

  event.preventDefault();
  const nextIndex = (currentIndex + direction + values.length) % values.length;
  radioOptions?.[nextIndex]?.focus();
  onSelect(values[nextIndex]);
}
