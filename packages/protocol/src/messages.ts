export const PROTOCOL_CHAT = '/isc/chat/1.0';
export const PROTOCOL_DELEGATE = '/isc/delegate/1.0';
export const PROTOCOL_ANNOUNCE = '/isc/announce/1.0';

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
