import { describe, expect, it } from 'vitest';

import { focusMinutes, xpToNextLevel } from '@/lib/focus-rpg';

describe('focus RPG helpers', () => {
  it('calculates remaining XP from the current level threshold', () => {
    expect(xpToNextLevel({ level: 1, xp: 25 })).toBe(75);
    expect(xpToNextLevel({ level: 3, xp: 40 })).toBe(260);
  });

  it('awards XP only for focus blocks, not breaks', () => {
    expect(
      focusMinutes({
        blocks: [
          { kind: 'focus', minutes: 25 },
          { kind: 'break', minutes: 5 },
          { kind: 'focus', minutes: 25 },
        ],
      }),
    ).toBe(50);
  });
});
