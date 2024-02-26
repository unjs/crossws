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
  private _subscriptions: Set<string> = new Set();

  static _idCounter = 0;
  private _id: string;

  constructor(public ctx: AdapterContext) {
    this._id = ++Peer._idCounter + "";
  }

  get id(): string {
    return this._id.toString();
  }

  get addr(): string | undefined {
    return undefined;
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
    return `#${this.id}`;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    const _id = this.toString();
    const _addr = this.addr ? ` (${this.addr})` : "";
    const _state =
      this.readyState === 1 || this.readyState === -1
        ? ""
        : ` [${ReadyStateMap[this.readyState]}]`;

    return `${_id}${_addr}${_state}`;
  }
}
