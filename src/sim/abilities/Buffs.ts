import type { Squad } from '../Squad';
import type { TeamId } from '../types';

export interface MoraleShieldEffect {
  moraleAdd: number;
  moraleLossMult: number;
  durationSec: number;
}

export interface ActiveMoraleShieldBuff {
  active: boolean;
  squad: Squad | null;
  squadId: number;
  teamId: TeamId;
  abilityId: string;
  moraleLossMult: number;
  expiresAt: number;
}

function resetBuff(buff: ActiveMoraleShieldBuff): void {
  buff.active = false;
  buff.squad = null;
  buff.squadId = -1;
  buff.teamId = 0 as TeamId;
  buff.abilityId = '';
  buff.moraleLossMult = 1;
  buff.expiresAt = 0;
}

export function createMoraleShieldBuffPool(size: number): ActiveMoraleShieldBuff[] {
  const pool: ActiveMoraleShieldBuff[] = [];
  const count = Math.max(1, Math.floor(size));
  for (let i = 0; i < count; i += 1) {
    pool.push({
      active: false,
      squad: null,
      squadId: -1,
      teamId: 0 as TeamId,
      abilityId: '',
      moraleLossMult: 1,
      expiresAt: 0,
    });
  }
  return pool;
}

export function clearMoraleShieldBuffPool(pool: ActiveMoraleShieldBuff[]): void {
  for (let i = 0; i < pool.length; i += 1) {
    const buff = pool[i];
    if (buff.active && buff.squad !== null) {
      buff.squad.setAbilityMoraleLossMult(1);
    }
    resetBuff(buff);
  }
}

function findExistingBuff(pool: ActiveMoraleShieldBuff[], squadId: number): ActiveMoraleShieldBuff | null {
  for (let i = 0; i < pool.length; i += 1) {
    const buff = pool[i];
    if (buff.active && buff.squadId === squadId) {
      return buff;
    }
  }
  return null;
}

function findFreeOrOldest(pool: ActiveMoraleShieldBuff[]): ActiveMoraleShieldBuff {
  let oldest = pool[0];
  for (let i = 0; i < pool.length; i += 1) {
    const buff = pool[i];
    if (!buff.active) {
      return buff;
    }
    if (buff.expiresAt < oldest.expiresAt) {
      oldest = buff;
    }
  }
  return oldest;
}

export function applyMoraleShieldBuff(
  pool: ActiveMoraleShieldBuff[],
  nowTime: number,
  squad: Squad,
  teamId: TeamId,
  abilityId: string,
  effect: MoraleShieldEffect,
): void {
  if (!squad.hasLivingSoldiers()) {
    return;
  }

  squad.applyMoraleBoost(effect.moraleAdd);
  squad.showRallyIndicator(1);

  let buff = findExistingBuff(pool, squad.id);
  if (buff === null) {
    buff = findFreeOrOldest(pool);
    if (buff.active && buff.squad !== null && buff.squad.id !== squad.id) {
      buff.squad.setAbilityMoraleLossMult(1);
    }
  }

  buff.active = true;
  buff.squad = squad;
  buff.squadId = squad.id;
  buff.teamId = teamId;
  buff.abilityId = abilityId;
  buff.moraleLossMult = Math.max(0.1, effect.moraleLossMult);
  buff.expiresAt = Math.max(nowTime, nowTime + Math.max(0.05, effect.durationSec));
  squad.setAbilityMoraleLossMult(buff.moraleLossMult);
}

export function updateMoraleShieldBuffs(pool: ActiveMoraleShieldBuff[], nowTime: number): void {
  for (let i = 0; i < pool.length; i += 1) {
    const buff = pool[i];
    if (!buff.active) {
      continue;
    }
    if (buff.squad === null || !buff.squad.hasLivingSoldiers() || nowTime >= buff.expiresAt) {
      if (buff.squad !== null) {
        buff.squad.setAbilityMoraleLossMult(1);
      }
      resetBuff(buff);
    }
  }
}
