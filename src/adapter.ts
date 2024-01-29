import type { WebSocketHooks } from "./hooks";

export type WebSocketAdapter<RT = any, OT = any> = (
  hooks: Partial<WebSocketHooks>,
  opts: OT,
) => RT;

export function defineWebSocketAdapter<RT, OT>(
  factory: WebSocketAdapter<RT, OT>,
) {
  return factory;
}
