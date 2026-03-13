export const PROTOCOL_CHAT = '/isc/chat/1.0';
export const PROTOCOL_DELEGATE = '/isc/delegate/1.0';
export const PROTOCOL_ANNOUNCE = '/isc/announce/1.0';
export const PROTOCOL_MODERATION = '/isc/moderation/1.0';
export const PROTOCOL_DELEGATION_HEALTH = '/isc/delegation_health/1.0';
export const PROTOCOL_REACTION = '/isc/reaction/1.0';
export const PROTOCOL_PROFILE = '/isc/profile/1.0';
export const PROTOCOL_DM = '/isc/dm/1.0';

export interface DelegationHealth {
  type: 'delegation_health';
  peerID: string;
  successRate: number;
  avgLatencyMs: number;
  requestsServed24h: number;
  timestamp: number;
  signature: string;
}

export interface ChatMessage {
  channelID: string;
  msg: string;
  signature?: string;
  ephemeral?: boolean;
}

export interface DelegateRequest {
  requestID: string;
  timestamp: number;
  text: string;
}

export interface DelegateResponse {
  requestID: string;
  embedding: number[];
  modelHash: string;
  signature: string;
}

export interface SignedAnnouncement {
  peerID: string;
  channelID: string;
  model: string;
  vec: number[];
  relTag?: string;
  ttl: number;
  signature: string;
}
