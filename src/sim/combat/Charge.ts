import { clamp } from '../../utils/math';
import type { Soldier } from '../Soldier';
import { getFacing } from './Facing';
import { Vec2 } from '../../utils/vec2';

const CHARGE_SPEED_FACTOR_MIN = 0.8;
const CHARGE_SPEED_FACTOR_MAX = 1.4;
const CHARGE_COOLDOWN_SECONDS = 3.5;
const CONTACT_ALIGNMENT_DOT = 0.15;
const CHARGE_KNOCKBACK = 34;

const facingBuffer = new Vec2();

export function updateChargeState(unit: Soldier, dt: number): void {
  if (unit.chargeCooldown > 0) {
    unit.chargeCooldown = Math.max(0, unit.chargeCooldown - dt);
    if (unit.chargeCooldown <= 0) {
      unit.chargeReady = true;
      unit.chargeState = 'none';
    } else {
      unit.chargeState = 'cooldown';
      unit.chargeReady = false;
    }
    return;
  }

  if (!unit.squad.isChargingOrder()) {
    unit.chargeState = 'none';
    return;
  }

  const speed = unit.velocity.len();
  if (speed < unit.baseStats.chargeMinSpeed || !unit.chargeReady) {
    unit.chargeState = 'none';
    return;
  }

  const target = unit.squad.getChargeTarget();
  if (target === null) {
    unit.chargeState = 'none';
    return;
  }

  const toTargetX = target.anchor.x - unit.position.x;
  const toTargetY = target.anchor.y - unit.position.y;
  const targetLenSq = toTargetX * toTargetX + toTargetY * toTargetY;
  if (targetLenSq <= 0.0001) {
    unit.chargeState = 'none';
    return;
  }

  getFacing(unit, facingBuffer);
  const invLen = 1 / Math.sqrt(targetLenSq);
  const dot = facingBuffer.x * (toTargetX * invLen) + facingBuffer.y * (toTargetY * invLen);
  unit.chargeState = dot > CONTACT_ALIGNMENT_DOT ? 'charging' : 'none';
}

export function computeChargeBurstDamage(attacker: Soldier): number {
  const speedFactor = clamp(
    attacker.velocity.len() / Math.max(1, attacker.baseStats.moveSpeed),
    CHARGE_SPEED_FACTOR_MIN,
    CHARGE_SPEED_FACTOR_MAX,
  );
  const perkChargePower = Math.max(0.2, attacker.squad.perkMods.chargePowerMult);
  return attacker.baseStats.attackDamage * attacker.baseStats.chargePower * perkChargePower * speedFactor;
}

export function applyChargeKnockback(attacker: Soldier, defender: Soldier): void {
  const dx = defender.position.x - attacker.position.x;
  const dy = defender.position.y - attacker.position.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.00001) {
    return;
  }

  const invLen = 1 / Math.sqrt(lenSq);
  const massRatio = attacker.mass / Math.max(0.35, defender.mass);
  const impulse = CHARGE_KNOCKBACK * clamp(massRatio, 0.7, 1.8);

  defender.velocity.x += dx * invLen * impulse;
  defender.velocity.y += dy * invLen * impulse;
}

export function consumeCharge(attacker: Soldier): void {
  attacker.chargeState = 'cooldown';
  attacker.chargeCooldown = CHARGE_COOLDOWN_SECONDS * Math.max(0.2, attacker.squad.perkMods.chargeCooldownMult);
  attacker.chargeReady = false;
}
