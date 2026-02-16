export interface CombinedPerkMods {
  moraleRegenMult: number;
  moraleLossMult: number;
  routThresholdAdd: number;
  cohesionMult: number;
  formationSpacingMult: number;
  chargePowerMult: number;
  chargeCooldownMult: number;
  rangedAccuracyAdd: number;
  projectileSpeedMult: number;
  captureRateMult: number;
  waveStrengthMult: number;
  spearCounterDamageMult: number;
  armorEffectivenessMult: number;
  moveSpeedMult: number;
  fieldMedicRecruitsPerCasualty: number;
  rangedAttackRateMult: number;
  suppressionMult: number;
}

export const DEFAULT_PERK_MODS: Readonly<CombinedPerkMods> = Object.freeze({
  moraleRegenMult: 1,
  moraleLossMult: 1,
  routThresholdAdd: 0,
  cohesionMult: 1,
  formationSpacingMult: 1,
  chargePowerMult: 1,
  chargeCooldownMult: 1,
  rangedAccuracyAdd: 0,
  projectileSpeedMult: 1,
  captureRateMult: 1,
  waveStrengthMult: 1,
  spearCounterDamageMult: 1,
  armorEffectivenessMult: 1,
  moveSpeedMult: 1,
  fieldMedicRecruitsPerCasualty: 0,
  rangedAttackRateMult: 1,
  suppressionMult: 1,
});

export function createPerkMods(): CombinedPerkMods {
  return {
    moraleRegenMult: 1,
    moraleLossMult: 1,
    routThresholdAdd: 0,
    cohesionMult: 1,
    formationSpacingMult: 1,
    chargePowerMult: 1,
    chargeCooldownMult: 1,
    rangedAccuracyAdd: 0,
    projectileSpeedMult: 1,
    captureRateMult: 1,
    waveStrengthMult: 1,
    spearCounterDamageMult: 1,
    armorEffectivenessMult: 1,
    moveSpeedMult: 1,
    fieldMedicRecruitsPerCasualty: 0,
    rangedAttackRateMult: 1,
    suppressionMult: 1,
  };
}

function applyMul(base: number, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return base;
  }
  return base * value;
}

function applyAdd(base: number, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return base;
  }
  return base + value;
}

export function mergePerkMods(target: CombinedPerkMods, source: Record<string, unknown>): void {
  target.moraleRegenMult = applyMul(target.moraleRegenMult, source.moraleRegenMult);
  target.moraleLossMult = applyMul(target.moraleLossMult, source.moraleLossMult);
  target.routThresholdAdd = applyAdd(target.routThresholdAdd, source.routThresholdAdd);
  target.cohesionMult = applyMul(target.cohesionMult, source.cohesionMult);
  target.formationSpacingMult = applyMul(target.formationSpacingMult, source.formationSpacingMult);
  target.chargePowerMult = applyMul(target.chargePowerMult, source.chargePowerMult);
  target.chargeCooldownMult = applyMul(target.chargeCooldownMult, source.chargeCooldownMult);
  target.rangedAccuracyAdd = applyAdd(target.rangedAccuracyAdd, source.rangedAccuracyAdd);
  target.projectileSpeedMult = applyMul(target.projectileSpeedMult, source.projectileSpeedMult);
  target.captureRateMult = applyMul(target.captureRateMult, source.captureRateMult);
  target.waveStrengthMult = applyMul(target.waveStrengthMult, source.waveStrengthMult);
  target.spearCounterDamageMult = applyMul(target.spearCounterDamageMult, source.spearCounterDamageMult);
  target.armorEffectivenessMult = applyMul(target.armorEffectivenessMult, source.armorEffectivenessMult);
  target.moveSpeedMult = applyMul(target.moveSpeedMult, source.moveSpeedMult);
  target.fieldMedicRecruitsPerCasualty = applyAdd(
    target.fieldMedicRecruitsPerCasualty,
    source.fieldMedicRecruitsPerCasualty,
  );
  target.rangedAttackRateMult = applyMul(target.rangedAttackRateMult, source.rangedAttackRateMult);
  target.suppressionMult = applyMul(target.suppressionMult, source.suppressionMult);
}
