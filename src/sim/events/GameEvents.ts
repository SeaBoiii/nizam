import type { TeamId } from '../types';
import type { OrderMode } from '../types';

export interface OrderIssuedEvent {
  teamId: TeamId;
  orderType: OrderMode;
  squadIds: number[];
}

export interface ProjectileFiredEvent {
  teamId: TeamId;
  x: number;
  y: number;
}

export interface DamageEvent {
  teamIdAttacker: TeamId;
  teamIdDefender: TeamId;
  x: number;
  y: number;
  amount: number;
}

export interface SquadRoutedEvent {
  teamId: TeamId;
  squadId: number;
  x: number;
  y: number;
}

export interface BattleEndEvent {
  winnerTeamId: TeamId;
}

type Listener<T> = (event: T) => void;

export class GameEvents {
  private readonly orderIssued: OrderIssuedEvent[] = [];
  private readonly orderIssuedPool: OrderIssuedEvent[] = [];
  private readonly projectileFired: ProjectileFiredEvent[] = [];
  private readonly projectileFiredPool: ProjectileFiredEvent[] = [];
  private readonly damage: DamageEvent[] = [];
  private readonly damagePool: DamageEvent[] = [];
  private readonly squadRouted: SquadRoutedEvent[] = [];
  private readonly squadRoutedPool: SquadRoutedEvent[] = [];
  private readonly battleEnd: BattleEndEvent[] = [];
  private readonly battleEndPool: BattleEndEvent[] = [];

  private readonly orderListeners: Listener<OrderIssuedEvent>[] = [];
  private readonly projectileListeners: Listener<ProjectileFiredEvent>[] = [];
  private readonly damageListeners: Listener<DamageEvent>[] = [];
  private readonly routedListeners: Listener<SquadRoutedEvent>[] = [];
  private readonly battleEndListeners: Listener<BattleEndEvent>[] = [];

  beginTick(): void {
    this.recycleOrders();
    this.recycleSimple(this.projectileFired, this.projectileFiredPool);
    this.recycleSimple(this.damage, this.damagePool);
    this.recycleSimple(this.squadRouted, this.squadRoutedPool);
    this.recycleSimple(this.battleEnd, this.battleEndPool);
  }

  emitOrderIssued(teamId: TeamId, orderType: OrderMode, squadIds: Iterable<number>): void {
    const event = this.orderIssuedPool.pop() ?? { teamId, orderType, squadIds: [] };
    event.teamId = teamId;
    event.orderType = orderType;
    event.squadIds.length = 0;
    for (const id of squadIds) {
      event.squadIds.push(id);
    }
    this.orderIssued.push(event);
  }

  emitProjectileFired(teamId: TeamId, x: number, y: number): void {
    const event = this.projectileFiredPool.pop() ?? { teamId, x, y };
    event.teamId = teamId;
    event.x = x;
    event.y = y;
    this.projectileFired.push(event);
  }

  emitDamage(teamIdAttacker: TeamId, teamIdDefender: TeamId, x: number, y: number, amount: number): void {
    const event = this.damagePool.pop() ?? { teamIdAttacker, teamIdDefender, x, y, amount };
    event.teamIdAttacker = teamIdAttacker;
    event.teamIdDefender = teamIdDefender;
    event.x = x;
    event.y = y;
    event.amount = amount;
    this.damage.push(event);
  }

  emitSquadRouted(teamId: TeamId, squadId: number, x: number, y: number): void {
    const event = this.squadRoutedPool.pop() ?? { teamId, squadId, x, y };
    event.teamId = teamId;
    event.squadId = squadId;
    event.x = x;
    event.y = y;
    this.squadRouted.push(event);
  }

  emitBattleEnd(winnerTeamId: TeamId): void {
    const event = this.battleEndPool.pop() ?? { winnerTeamId };
    event.winnerTeamId = winnerTeamId;
    this.battleEnd.push(event);
  }

  dispatch(): void {
    this.dispatchList(this.orderIssued, this.orderListeners);
    this.dispatchList(this.projectileFired, this.projectileListeners);
    this.dispatchList(this.damage, this.damageListeners);
    this.dispatchList(this.squadRouted, this.routedListeners);
    this.dispatchList(this.battleEnd, this.battleEndListeners);
  }

  onOrderIssued(listener: Listener<OrderIssuedEvent>): () => void {
    this.orderListeners.push(listener);
    return () => this.removeListener(this.orderListeners, listener);
  }

  onProjectileFired(listener: Listener<ProjectileFiredEvent>): () => void {
    this.projectileListeners.push(listener);
    return () => this.removeListener(this.projectileListeners, listener);
  }

  onDamage(listener: Listener<DamageEvent>): () => void {
    this.damageListeners.push(listener);
    return () => this.removeListener(this.damageListeners, listener);
  }

  onSquadRouted(listener: Listener<SquadRoutedEvent>): () => void {
    this.routedListeners.push(listener);
    return () => this.removeListener(this.routedListeners, listener);
  }

  onBattleEnd(listener: Listener<BattleEndEvent>): () => void {
    this.battleEndListeners.push(listener);
    return () => this.removeListener(this.battleEndListeners, listener);
  }

  private dispatchList<T>(events: T[], listeners: Listener<T>[]): void {
    if (events.length === 0 || listeners.length === 0) {
      return;
    }
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      for (let j = 0; j < listeners.length; j += 1) {
        listeners[j](event);
      }
    }
  }

  private recycleOrders(): void {
    for (let i = 0; i < this.orderIssued.length; i += 1) {
      const event = this.orderIssued[i];
      event.squadIds.length = 0;
      this.orderIssuedPool.push(event);
    }
    this.orderIssued.length = 0;
  }

  private recycleSimple<T>(active: T[], pool: T[]): void {
    for (let i = 0; i < active.length; i += 1) {
      pool.push(active[i]);
    }
    active.length = 0;
  }

  private removeListener<T>(list: Listener<T>[], listener: Listener<T>): void {
    const index = list.indexOf(listener);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }
}

