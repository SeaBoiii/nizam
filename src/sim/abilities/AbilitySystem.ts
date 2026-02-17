import { Graphics } from 'pixi.js';
import { contentManager } from '../../content/ContentManager';
import type { AbilityContent } from '../../content/ContentTypes';
import type { GameEvents } from '../events/GameEvents';
import type { Squad } from '../Squad';
import { TeamId } from '../types';
import { Vec2 } from '../../utils/vec2';
import {
  applyMoraleShieldBuff,
  clearMoraleShieldBuffPool,
  createMoraleShieldBuffPool,
  updateMoraleShieldBuffs,
  type ActiveMoraleShieldBuff,
} from './Buffs';

const TEAM_COUNT = 2;
const MAX_ACTIVE_BUFFS = 160;
const MAX_PULSES = 12;
const PULSE_DURATION_SEC = 0.6;

interface AbilityPulse {
  active: boolean;
  x: number;
  y: number;
  age: number;
  maxAge: number;
  maxRadius: number;
}

interface AbilitySystemOptions {
  squads: readonly Squad[];
  events: GameEvents;
  selectedAbilityId: string;
}

function clampTeamIndex(teamId: TeamId): number {
  if (teamId === TeamId.Red) {
    return 1;
  }
  return 0;
}

function pickAbilityId(candidate: string, fallback: string): string {
  if (candidate.length > 0 && contentManager.getAbility(candidate) !== null) {
    return candidate;
  }
  if (contentManager.getAbility(fallback) !== null) {
    return fallback;
  }
  return 'rally';
}

export class AbilitySystem {
  readonly selectedAbilityId: string;
  readonly activeBuffs: ActiveMoraleShieldBuff[];

  private readonly squads: readonly Squad[];
  private readonly events: GameEvents;
  private readonly teamAbilityIds: string[] = ['rally', 'rally'];
  private readonly cooldownRemaining: number[] = [0, 0];
  private readonly castRemaining: number[] = [0, 0];
  private readonly pendingCastActive: boolean[] = [false, false];
  private readonly pendingAbilityId: string[] = ['', ''];
  private readonly pendingCastPos: Vec2[] = [new Vec2(), new Vec2()];
  private readonly abilityCache = new Map<string, AbilityContent>();
  private readonly pulses: AbilityPulse[] = [];

  private simTime = 0;

  constructor(options: AbilitySystemOptions) {
    this.squads = options.squads;
    this.events = options.events;

    const startRules = contentManager.getStartAbilityRules();
    this.selectedAbilityId = pickAbilityId(options.selectedAbilityId, startRules.normalDefault);
    this.teamAbilityIds[clampTeamIndex(TeamId.Blue)] = this.selectedAbilityId;
    this.teamAbilityIds[clampTeamIndex(TeamId.Red)] = pickAbilityId(startRules.normalDefault, this.selectedAbilityId);

    this.activeBuffs = createMoraleShieldBuffPool(MAX_ACTIVE_BUFFS);
    for (let i = 0; i < MAX_PULSES; i += 1) {
      this.pulses.push({
        active: false,
        x: 0,
        y: 0,
        age: 0,
        maxAge: PULSE_DURATION_SEC,
        maxRadius: 220,
      });
    }
  }

  destroy(): void {
    clearMoraleShieldBuffPool(this.activeBuffs);
  }

  getAbility(teamId: TeamId): AbilityContent | null {
    return this.resolveAbility(this.teamAbilityIds[clampTeamIndex(teamId)]);
  }

  getCooldownRemaining(teamId: TeamId): number {
    return this.cooldownRemaining[clampTeamIndex(teamId)];
  }

  getCooldownDuration(teamId: TeamId): number {
    const ability = this.getAbility(teamId);
    return ability ? Math.max(0.01, ability.cooldownSec) : 1;
  }

  canCast(teamId: TeamId): boolean {
    const idx = clampTeamIndex(teamId);
    if (this.pendingCastActive[idx]) {
      return false;
    }
    if (this.cooldownRemaining[idx] > 0) {
      return false;
    }
    return this.resolveAbility(this.teamAbilityIds[idx]) !== null;
  }

  cast(teamId: TeamId, worldPos: Vec2): boolean {
    const idx = clampTeamIndex(teamId);
    const ability = this.resolveAbility(this.teamAbilityIds[idx]);
    if (ability === null || !this.canCast(teamId)) {
      return false;
    }

    this.cooldownRemaining[idx] = Math.max(0, ability.cooldownSec);
    this.castRemaining[idx] = Math.max(0, ability.castTimeSec);
    this.pendingCastActive[idx] = true;
    this.pendingAbilityId[idx] = ability.id;
    this.pendingCastPos[idx].copy(worldPos);

    if (this.castRemaining[idx] <= 0) {
      this.resolvePendingCast(idx, teamId);
    }
    return true;
  }

  update(dt: number): void {
    this.simTime += dt;

    for (let i = 0; i < TEAM_COUNT; i += 1) {
      if (this.cooldownRemaining[i] > 0) {
        this.cooldownRemaining[i] = Math.max(0, this.cooldownRemaining[i] - dt);
      }
      if (!this.pendingCastActive[i]) {
        continue;
      }
      this.castRemaining[i] -= dt;
      if (this.castRemaining[i] <= 0) {
        this.resolvePendingCast(i, i === 0 ? TeamId.Blue : TeamId.Red);
      }
    }

    updateMoraleShieldBuffs(this.activeBuffs, this.simTime);
    this.updatePulses(dt);
  }

  renderOverlay(graphics: Graphics): void {
    graphics.clear();
    for (let i = 0; i < this.pulses.length; i += 1) {
      const pulse = this.pulses[i];
      if (!pulse.active) {
        continue;
      }
      const t = pulse.age / pulse.maxAge;
      const radius = Math.max(12, pulse.maxRadius * t);
      const alpha = Math.max(0, 0.42 * (1 - t));
      graphics.circle(pulse.x, pulse.y, radius);
      graphics.stroke({ color: 0x8fd0ff, width: 2, alpha });
    }
  }

  private resolvePendingCast(index: number, teamId: TeamId): void {
    if (!this.pendingCastActive[index]) {
      return;
    }
    this.pendingCastActive[index] = false;
    this.castRemaining[index] = 0;

    const ability = this.resolveAbility(this.pendingAbilityId[index]);
    if (ability === null) {
      return;
    }
    const castPos = this.pendingCastPos[index];
    const rangeSq = ability.range * ability.range;
    this.events.emitAbilityCast(teamId, ability.id, castPos.x, castPos.y);
    this.spawnPulse(castPos.x, castPos.y, ability.range * 0.58);

    for (let i = 0; i < this.squads.length; i += 1) {
      const squad = this.squads[i];
      if (squad.team !== teamId || !squad.hasLivingSoldiers()) {
        continue;
      }
      const dx = squad.anchor.x - castPos.x;
      const dy = squad.anchor.y - castPos.y;
      if (dx * dx + dy * dy > rangeSq) {
        continue;
      }

      applyMoraleShieldBuff(
        this.activeBuffs,
        this.simTime,
        squad,
        teamId,
        ability.id,
        ability.effects,
      );
      this.events.emitAbilityAffected(teamId, ability.id, squad.id);
    }
  }

  private resolveAbility(abilityId: string): AbilityContent | null {
    if (abilityId.length === 0) {
      return null;
    }
    const cached = this.abilityCache.get(abilityId);
    if (cached) {
      return cached;
    }
    const ability = contentManager.getAbility(abilityId);
    if (ability === null) {
      return null;
    }
    this.abilityCache.set(abilityId, ability);
    return ability;
  }

  private spawnPulse(x: number, y: number, maxRadius: number): void {
    let best = this.pulses[0];
    for (let i = 0; i < this.pulses.length; i += 1) {
      const pulse = this.pulses[i];
      if (!pulse.active) {
        best = pulse;
        break;
      }
      if (pulse.age > best.age) {
        best = pulse;
      }
    }
    best.active = true;
    best.x = x;
    best.y = y;
    best.age = 0;
    best.maxAge = PULSE_DURATION_SEC;
    best.maxRadius = Math.max(90, maxRadius);
  }

  private updatePulses(dt: number): void {
    for (let i = 0; i < this.pulses.length; i += 1) {
      const pulse = this.pulses[i];
      if (!pulse.active) {
        continue;
      }
      pulse.age += dt;
      if (pulse.age >= pulse.maxAge) {
        pulse.active = false;
      }
    }
  }
}
