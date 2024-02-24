import type { WebSocketHooks, AdapterHooks } from "./hooks";

export type WebSocketAdapter<RT = any, OT = any> = (
  hooks: Partial<WebSocketHooks & AdapterHooks>,
  opts: OT,
) => RT;

export function defineWebSocketAdapter<RT, OT>(
  factory: WebSocketAdapter<RT, OT>,
) {
  return factory;
}
