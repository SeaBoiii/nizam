export type BattleObjectiveType = 'CAPTURE' | 'ASSASSINATE' | 'HOLDOUT' | 'ESCORT' | 'SIEGE';

export function objectiveDisplayName(type: BattleObjectiveType): string {
  switch (type) {
    case 'CAPTURE':
      return 'Capture Point';
    case 'ASSASSINATE':
      return 'Decapitation';
    case 'HOLDOUT':
      return 'Last Stand';
    case 'ESCORT':
      return 'Caravan Run';
    case 'SIEGE':
      return 'Siege';
  }
}
