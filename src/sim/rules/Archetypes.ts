import { contentManager } from '../../content/ContentManager';
import type { UnitArchetype } from '../types/UnitArchetype';

function createLiveArchetype(archetypeId: string): UnitArchetype {
  const archetype = contentManager.getBaseUnit(archetypeId);
  const refresh = (): void => {
    const latest = contentManager.getBaseUnit(archetypeId);
    archetype.id = latest.id;
    archetype.name = latest.name;
    archetype.tags = [...latest.tags];
    archetype.stats = { ...latest.stats };
  };
  contentManager.onDidReload(refresh);
  return archetype;
}

export const INFANTRY: UnitArchetype = createLiveArchetype('infantry');
export const SPEARMEN: UnitArchetype = createLiveArchetype('spearmen');
export const CAVALRY: UnitArchetype = createLiveArchetype('cavalry');
export const ARCHERS: UnitArchetype = createLiveArchetype('archers');
export const SLINGERS: UnitArchetype = createLiveArchetype('slingers');
export const ALL_ARCHETYPES: readonly UnitArchetype[] = [INFANTRY, SPEARMEN, CAVALRY, ARCHERS, SLINGERS];
