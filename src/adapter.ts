import type { WebSocketHandler } from "./handler";

export type WebSocketAdapter<RT = any, OT = any> = (
  handler: WebSocketHandler,
  opts: OT,
) => RT;

export function defineWebSocketAdapter<RT, OT>(
  factory: WebSocketAdapter<RT, OT>,
) {
  return factory;
}
