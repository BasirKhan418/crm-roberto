import { EventEmitter } from "events";

export type AccountStatusValue = "active" | "suspended";

type AccountStatusChangedEvent = {
  userId: string;
  account_status: AccountStatusValue;
  at: number;
};

const EVENT_NAME = "account-status-changed";

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function emitAccountStatusChanged(event: AccountStatusChangedEvent) {
  emitter.emit(EVENT_NAME, event);
}

export function onAccountStatusChanged(
  listener: (event: AccountStatusChangedEvent) => void
): () => void {
  emitter.on(EVENT_NAME, listener);
  return () => {
    emitter.off(EVENT_NAME, listener);
  };
}
