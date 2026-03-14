export const BUS_QUEUE_STATES = {
  PENDING: "PENDING",
  DONE: "DONE",
  DEAD: "DEAD",
} as const;

export type BusQueueState = typeof BUS_QUEUE_STATES[keyof typeof BUS_QUEUE_STATES];
export type BusFinalQueueState = typeof BUS_QUEUE_STATES.DONE | typeof BUS_QUEUE_STATES.DEAD;

export const MESSAGE_TYPES = {
  REQUEST: "REQUEST",
  RESPONSE: "RESPONSE",
} as const;

export type BusMessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

export const CHANNEL_KINDS = {
  D1: "D1",
  WEBHOOK: "WEBHOOK",
} as const;

export type ChannelKind = typeof CHANNEL_KINDS[keyof typeof CHANNEL_KINDS];

export const BUS_ACK_KINDS = {
  AUTO_FINALIZE_ACK: "AUTO_FINALIZE_ACK",
} as const;

export type BusAckKind = typeof BUS_ACK_KINDS[keyof typeof BUS_ACK_KINDS];

export function isBusFinalQueueState(v: string): v is BusFinalQueueState {
  return v === BUS_QUEUE_STATES.DONE || v === BUS_QUEUE_STATES.DEAD;
}

export function isBusMessageType(v: string): v is BusMessageType {
  return v === MESSAGE_TYPES.REQUEST || v === MESSAGE_TYPES.RESPONSE;
}

export function coerceChannelKind(v: unknown): ChannelKind {
  return v === CHANNEL_KINDS.WEBHOOK ? CHANNEL_KINDS.WEBHOOK : CHANNEL_KINDS.D1;
}
