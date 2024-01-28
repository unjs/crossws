import { WebSocketError } from "./error";
import type { WebSocketMessage } from "./message";
import type { WebSocketPeerBase } from "./peer";

export interface WebSocketHandler {
  onEvent?(event: string, peer: WebSocketPeerBase, ...args: any[]): void;

  /** A message is received */
  onMessage?(peer: WebSocketPeerBase, message: WebSocketMessage): void;

  /** A socket is opened */
  onOpen?(peer: WebSocketPeerBase): void;

  /** A socket is closed */
  onClose?(peer: WebSocketPeerBase, code: number, reason: string): void;

  /** An error occurs */
  onError?(peer: WebSocketPeerBase, error: WebSocketError): void;
}

export function defineWebSocketHandler(
  handler: WebSocketHandler,
): WebSocketHandler {
  return handler;
}
