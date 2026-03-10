export const PROTOCOL_CHAT = '/isc/chat/1.0';
export const PROTOCOL_DELEGATE = '/isc/delegate/1.0';
export const PROTOCOL_ANNOUNCE = '/isc/announce/1.0';

export interface ChatMessage {
  channelID: string;
  msg: string;
  signature?: string;
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
