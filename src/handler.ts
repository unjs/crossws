import { WebSocketError } from "./error";
import type { WebSocketMessage } from "./message";
import type { WebSocketPeer } from "./peer";

export interface WebSocketHandler {
  onEvent?(event: string, ...args: any[]): void;

  /** A message is received */
  onMessage?(peer: WebSocketPeer, message: WebSocketMessage): void;

  /** A socket is opened */
  onOpen?(peer: WebSocketPeer): void;

  /** A socket is closed */
  onClose?(peer: WebSocketPeer, code: number, reason: string): void;

  /** An error occurs */
  onError?(peer: WebSocketPeer, error: WebSocketError): void;
}

export function defineWebSocketHandler(
  handler: WebSocketHandler,
): WebSocketHandler {
  return handler;
}
