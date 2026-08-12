export type RpgStat = 'focus' | 'knowledge' | 'resilience';
export type CombatAction = 'attack' | 'focus' | 'guard';

export type RpgProfile = {
  user_id: string;
  level: number;
  xp: number;
  focus: number;
  knowledge: number;
  resilience: number;
  unspent_stat_points: number;
  current_streak: number;
  last_completed_date: string | null;
};

export type RpgItem = {
  id: string;
  item_name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  slot: 'charm' | 'tool' | 'cloak' | null;
  stat: RpgStat | null;
  stat_bonus: number;
  is_equipped: boolean;
};

export type RpgEncounter = {
  id: string;
  enemy_name: string;
  enemy_health: number;
  player_health: number;
  turns: number;
  status: 'pending' | 'won' | 'lost';
};

export type FocusRewardResult = {
  profile: RpgProfile;
  claim: {
    id: string;
    xp_awarded: number;
  };
  item: RpgItem;
  encounter: RpgEncounter;
  duplicate: boolean;
};

export function xpToNextLevel(profile: Pick<RpgProfile, 'level' | 'xp'>): number {
  return profile.level * 100 - profile.xp;
}

export function focusMinutes(session: { blocks: { kind: string; minutes: number }[] }): number {
  return session.blocks.reduce((total, block) => total + (block.kind === 'focus' ? block.minutes : 0), 0);
}

export function createFocusSessionId(): string {
  return crypto.randomUUID();
}
