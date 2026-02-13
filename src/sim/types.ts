export enum TeamId {
  Blue = 0,
  Red = 1,
}

export type FormationType = 'line' | 'column' | 'wedge' | 'loose';

export type OrderMode = 'move' | 'hold' | 'charge' | 'retreat' | 'rout' | 'volley' | 'skirmish';

export interface WorldBounds {
  width: number;
  height: number;
}
