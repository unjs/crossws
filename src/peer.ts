// https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
type ReadyState = 0 | 1 | 2 | 3;
const ReadyStateMap = {
  "-1": "unkown",
  0: "connecting",
  1: "open",
  2: "closing",
  3: "closed",
} as const;

export abstract class WebSocketPeerBase<AdapterContext = any> {
  constructor(public ctx: AdapterContext) {}

  get id(): string | undefined {
    return undefined;
  }

  get url(): string {
    return "/";
  }

  get headers(): Headers {
    return new Headers();
  }

  get readyState(): ReadyState | -1 {
    return -1;
  }

  abstract send(
    message: string | ArrayBuffer | Uint8Array,
    compress?: boolean,
  ): number;

  toString() {
    const readyState = ReadyStateMap[this.readyState];
    return `<WebSocketPeer${this.id ? ` ${this.id}` : ""} (${readyState})>`;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }
}
