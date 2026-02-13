import { SKIRMISH_THREAT_FACTOR } from '../rules/Constants';
import type { OrderMode } from '../types';

export function canSquadFireRanged(order: OrderMode): boolean {
  return order !== 'retreat' && order !== 'rout';
}

export function isRangedOrder(order: OrderMode): boolean {
  return order === 'volley' || order === 'skirmish';
}

export function skirmishThreatRange(rangedRange: number): number {
  return rangedRange * SKIRMISH_THREAT_FACTOR;
}