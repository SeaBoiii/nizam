export type RecordedEventValue = string | number | boolean | null;

export interface RecordedEvent {
  timestamp: number;
  type: string;
  payload: Record<string, RecordedEventValue>;
}

interface EventSlot {
  timestamp: number;
  type: string;
  payload: Record<string, RecordedEventValue>;
}

function normalizeValue(value: unknown): RecordedEventValue {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return value;
  }
  if (typeof value === 'string') {
    return value.length > 160 ? value.slice(0, 160) : value;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

export class EventRecorder {
  private readonly capacity: number;
  private readonly ring: EventSlot[];
  private head = 0;
  private size = 0;

  constructor(capacity = 200) {
    this.capacity = Math.max(16, Math.floor(capacity));
    this.ring = new Array<EventSlot>(this.capacity);
    for (let i = 0; i < this.capacity; i += 1) {
      this.ring[i] = {
        timestamp: 0,
        type: '',
        payload: {},
      };
    }
  }

  record(eventType: string, payload: Record<string, unknown> = {}): void {
    const slot = this.ring[this.head];
    slot.timestamp = Date.now();
    slot.type = eventType;

    const slotPayload = slot.payload;
    for (const key in slotPayload) {
      delete slotPayload[key];
    }
    for (const key in payload) {
      slotPayload[key] = normalizeValue(payload[key]);
    }

    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size += 1;
    }
  }

  getRecentEvents(): RecordedEvent[] {
    const output: RecordedEvent[] = [];
    if (this.size <= 0) {
      return output;
    }

    const start = (this.head - this.size + this.capacity) % this.capacity;
    for (let i = 0; i < this.size; i += 1) {
      const slot = this.ring[(start + i) % this.capacity];
      output.push({
        timestamp: slot.timestamp,
        type: slot.type,
        payload: { ...slot.payload },
      });
    }

    return output;
  }

  clear(): void {
    for (let i = 0; i < this.ring.length; i += 1) {
      const slot = this.ring[i];
      slot.timestamp = 0;
      slot.type = '';
      for (const key in slot.payload) {
        delete slot.payload[key];
      }
    }
    this.head = 0;
    this.size = 0;
  }
}

