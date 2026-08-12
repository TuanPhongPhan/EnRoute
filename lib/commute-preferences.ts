export const arrivalBufferOptions = [10, 15, 20, 30] as const;

export type ArrivalBufferMinutes = (typeof arrivalBufferOptions)[number];

export type CommutePreferences = {
  homeAddress: string;
  universityAddress: string;
  arrivalBufferMinutes: ArrivalBufferMinutes;
  calendarId: string;
};

export const defaultCommutePreferences: CommutePreferences = {
  homeAddress: 'Graslilienanger 12, 80937 München',
  universityAddress: 'Hochschule Neu-Ulm, Wileystraße 1, 89231 Neu-Ulm',
  arrivalBufferMinutes: 15,
  calendarId: 'primary',
};

const storageKey = 'enroute:commute-preferences:v3';

export function readCommutePreferences(): CommutePreferences {
  if (typeof window === 'undefined') return defaultCommutePreferences;

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return defaultCommutePreferences;
    const parsed: unknown = JSON.parse(saved);
    return isCommutePreferences(parsed) ? { ...defaultCommutePreferences, ...parsed } : defaultCommutePreferences;
  } catch {
    return defaultCommutePreferences;
  }
}

export function saveCommutePreferences(preferences: CommutePreferences) {
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

function isCommutePreferences(value: unknown): value is CommutePreferences {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.homeAddress === 'string'
    && typeof candidate.universityAddress === 'string'
    && arrivalBufferOptions.some((option) => option === candidate.arrivalBufferMinutes)
    && (candidate.calendarId === undefined || typeof candidate.calendarId === 'string');
}
