export type PracticeStopMarker = {
  /** Configuration number, not chronological playback order. */
  number: number;
  position: { latitude: number; longitude: number };
};

export type ProjectedPracticeStop = PracticeStopMarker & { x: number; y: number };

/** Group nearby labels, never move or discard their underlying route positions. */
export function clusterPracticeStops(stops: readonly ProjectedPracticeStop[]) {
  const groups: ProjectedPracticeStop[][] = [];
  for (const stop of stops) {
    const touching = groups.filter((group) => group.some((other) =>
      Math.abs(stop.x - other.x) < 100 && Math.abs(stop.y - other.y) < 56));
    const merged = [stop, ...touching.flat()];
    for (const group of touching) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }
  return groups.map((group) => {
    const members = [...group].sort((a, b) => a.number - b.number);
    return {
      members,
      key: members.map((stop) => stop.number).join('-'),
      label: `SIM ${members.map((stop) => stop.number).join(', ')}`,
      description: `Synthetic practice ${members.length === 1 ? 'stop' : 'stops'} ${members.map((stop) => stop.number).join(', ')}. ${members.length > 1 ? 'Nearby labels grouped. ' : ''}Not real roadside stops. No GPS tracking.`,
      x: group.reduce((sum, stop) => sum + stop.x, 0) / group.length,
      y: group.reduce((sum, stop) => sum + stop.y, 0) / group.length,
      position: {
        latitude: group.reduce((sum, stop) => sum + stop.position.latitude, 0) / group.length,
        longitude: group.reduce((sum, stop) => sum + stop.position.longitude, 0) / group.length,
      },
    };
  });
}
