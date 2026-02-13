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
  return {
    squads: [
      { id: 'squad_1', archetypeId: 'infantry', size: 30, tier: 1, name: 'Vanguard' },
      { id: 'squad_2', archetypeId: 'spearmen', size: 28, tier: 1, name: 'Pikes' },
      { id: 'squad_3', archetypeId: 'archers', size: 24, tier: 1, name: 'Bowline' },
    ],
    gold: 55,
    supplies: 35,
    recruits: 12,
    nextSquadId: 4,
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