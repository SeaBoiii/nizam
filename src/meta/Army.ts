import { contentManager } from '../content/ContentManager';

export interface SquadMeta {
  id: string;
  archetypeId: string;
  size: number;
  tier: number;
  name?: string;
  perks?: string[];
}

export interface ArmyState {
  squads: SquadMeta[];
  gold: number;
  supplies: number;
  recruits: number;
  nextSquadId: number;
}

export function createStartingArmy(): ArmyState {
  const starting = contentManager.getStartingArmy();
  return {
    squads: starting.squads.map((squad, index) => ({
      id: `squad_${index + 1}`,
      archetypeId: squad.archetypeId,
      size: squad.size,
      tier: squad.tier,
      name: squad.name,
    })),
    gold: starting.gold,
    supplies: starting.supplies,
    recruits: starting.recruits,
    nextSquadId: starting.squads.length + 1,
  };
}

export function cloneArmyState(state: ArmyState): ArmyState {
  return {
    squads: state.squads.map((squad) => ({
      id: squad.id,
      archetypeId: squad.archetypeId,
      size: squad.size,
      tier: squad.tier,
      name: squad.name,
      perks: squad.perks ? [...squad.perks] : undefined,
    })),
    gold: state.gold,
    supplies: state.supplies,
    recruits: state.recruits,
    nextSquadId: state.nextSquadId,
  };
}

export function createSquadMeta(
  army: ArmyState,
  archetypeId: string,
  size: number,
  tier: number,
  name?: string,
): SquadMeta {
  const id = `squad_${army.nextSquadId}`;
  army.nextSquadId += 1;

  return {
    id,
    archetypeId,
    size,
    tier,
    name,
  };
}
