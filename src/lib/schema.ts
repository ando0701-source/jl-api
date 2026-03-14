export const BUS_SCHEMA_ID = "2PLT_BUS/v1" as const;
export const MESSAGE_SCHEMA_ID = "2PLT_MESSAGE/v1" as const;

export const TRANSPORT_SCHEMA_IDS = [BUS_SCHEMA_ID, MESSAGE_SCHEMA_ID] as const;

export type TransportSchemaId = typeof TRANSPORT_SCHEMA_IDS[number];
