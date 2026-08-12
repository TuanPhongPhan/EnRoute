import type { TransportJourney } from '@/lib/transport-provider';

export const focusActivities = ['Study', 'Read', 'Flashcards', 'Code', 'Watch', 'Podcast', 'Rest'] as const;
export type FocusActivity = (typeof focusActivities)[number];
export type FocusBlock = { kind: 'focus' | 'break'; minutes: number };
export type FocusSession = { activity: FocusActivity; blocks: FocusBlock[]; activeIndex: number; startedAt: string; pausedAt?: string; pausedMs: number; completed: boolean; destination: string };
const key = 'enroute:focus-session:v1';

export function usableLeg(journey: TransportJourney | null) { const legs = journey?.legs.filter((leg) => leg.mode === 'regional_train') ?? []; const candidates = legs.length ? legs : journey?.legs.filter((leg) => leg.mode !== 'walk') ?? []; return candidates.filter((leg) => Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture) >= 20 * 60000).sort((a, b) => Date.parse(b.actualArrival) - Date.parse(b.actualDeparture) - (Date.parse(a.actualArrival) - Date.parse(a.actualDeparture)))[0]; }
export function blocksFor(minutes: number): FocusBlock[] { const blocks: FocusBlock[] = []; let remaining = minutes; while (remaining > 0) { const focus = Math.min(25, remaining); blocks.push({ kind: 'focus', minutes: focus }); remaining -= focus; if (remaining >= 10) { blocks.push({ kind: 'break', minutes: Math.min(5, remaining) }); remaining -= Math.min(5, remaining); } } return blocks; }
export function saveFocus(session: FocusSession) { localStorage.setItem(key, JSON.stringify(session)); }
export function readFocus(): FocusSession | null { try { const value = JSON.parse(localStorage.getItem(key) ?? 'null'); return value?.blocks && typeof value.activeIndex === 'number' ? value : null; } catch { return null; } }
export function clearFocus() { localStorage.removeItem(key); }
export function remainingSeconds(session: FocusSession, now = Date.now()) { const block = session.blocks[session.activeIndex]; if (!block) return 0; const elapsed = session.pausedAt ? Date.parse(session.pausedAt) - Date.parse(session.startedAt) - session.pausedMs : now - Date.parse(session.startedAt) - session.pausedMs; return Math.max(0, block.minutes * 60 - Math.floor(elapsed / 1000)); }
