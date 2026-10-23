import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sector.recent-searches.v1';
const MAX_SEARCHES = 8;

export type RecentSearch = {
  id: string;
  query: string;
  savedAt: string;
};

function parseSearches(value: string | null): RecentSearch[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('Saved searches have an invalid format.');
  }
  return parsed.filter(
    (item): item is RecentSearch =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.query === 'string' &&
      typeof item.savedAt === 'string',
  );
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  return parseSearches(await AsyncStorage.getItem(STORAGE_KEY));
}

export async function saveRecentSearch(query: string): Promise<RecentSearch[]> {
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error('Enter a place name before saving.');
  }

  const existing = await getRecentSearches();
  const foldedQuery = normalized.toLocaleLowerCase();
  const next: RecentSearch[] = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      query: normalized,
      savedAt: new Date().toISOString(),
    },
    ...existing.filter((item) => item.query.toLocaleLowerCase() !== foldedQuery),
  ].slice(0, MAX_SEARCHES);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
