import type { TerrainRect } from './Terrain';

export interface GateState {
  id: string;
  rect: TerrainRect;
  isOpen: boolean;
}

export class Gates {
  private readonly gates: GateState[] = [];
  private readonly closedRects: TerrainRect[] = [];
  private closedDirty = true;

  addGate(id: string, rect: TerrainRect, isOpen = false): void {
    this.gates.push({
      id,
      rect,
      isOpen,
    });
    this.closedDirty = true;
  }

  getAll(): readonly GateState[] {
    return this.gates;
  }

  getById(id: string): GateState | null {
    for (let i = 0; i < this.gates.length; i += 1) {
      if (this.gates[i].id === id) {
        return this.gates[i];
      }
    }
    return null;
  }

  isOpen(id: string): boolean {
    const gate = this.getById(id);
    return gate !== null ? gate.isOpen : false;
  }

  setOpen(id: string, isOpen: boolean): boolean {
    const gate = this.getById(id);
    if (gate === null || gate.isOpen === isOpen) {
      return false;
    }
    gate.isOpen = isOpen;
    this.closedDirty = true;
    return true;
  }

  getClosedRects(): readonly TerrainRect[] {
    if (this.closedDirty) {
      this.closedRects.length = 0;
      for (let i = 0; i < this.gates.length; i += 1) {
        const gate = this.gates[i];
        if (!gate.isOpen) {
          this.closedRects.push(gate.rect);
        }
      }
      this.closedDirty = false;
    }
    return this.closedRects;
  }
}

