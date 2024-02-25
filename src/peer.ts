import type { WSRequest } from "./types";

// https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
type ReadyState = 0 | 1 | 2 | 3;
const ReadyStateMap = {
  "-1": "unknown",
  0: "connecting",
  1: "open",
  2: "closing",
  3: "closed",
} as const;

export abstract class Peer<AdapterContext = any> implements WSRequest {
  _subscriptions: Set<string> = new Set();

  constructor(public ctx: AdapterContext) {}

  get id(): string | undefined {
    return "??";
  }

  get url(): string {
    return "/";
  }

  get headers(): HeadersInit {
    return {};
  }

  get readyState(): ReadyState | -1 {
    return -1;
  }

  abstract send(message: any, options?: { compress?: boolean }): number;

  publish(topic: string, message: any, options?: { compress?: boolean }) {
    // noop
  }

  subscribe(topic: string) {
    this._subscriptions.add(topic);
  }

  unsubscribe(topic: string) {
    this._subscriptions.delete(topic);
  }

  toString() {
    return `${this.id || ""}${this.readyState === 1 || this.readyState === -1 ? "" : ` [${ReadyStateMap[this.readyState]}]`}`;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }
}
