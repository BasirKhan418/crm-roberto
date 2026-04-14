import { EventEmitter } from "events";

export type ActivityEventType = "created" | "updated" | "deleted" | "read_all";

export interface ActivityChangedEvent {
  eventId: string;
  userId: string;
  type: ActivityEventType;
  activityId?: string | null;
  at: number;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const EVENT_NAME = "activity-changed";

export function createActivityEventId(): string {
  const now = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${now}-${random}`;
}

export function emitActivityChanged(event: Omit<ActivityChangedEvent, "eventId" | "at">) {
  emitter.emit(EVENT_NAME, {
    ...event,
    eventId: createActivityEventId(),
    at: Date.now(),
  } as ActivityChangedEvent);
}

export function onActivityChanged(listener: (event: ActivityChangedEvent) => void): () => void {
  emitter.on(EVENT_NAME, listener);
  return () => {
    emitter.off(EVENT_NAME, listener);
  };
}
