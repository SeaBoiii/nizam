import { Vec2 } from '../utils/vec2';

export interface Waypoint {
  position: Vec2;
  facing: number | null;
}