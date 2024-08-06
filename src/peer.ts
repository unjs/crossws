// https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
type ReadyState = 0 | 1 | 2 | 3;
const ReadyStateMap = {
  "-1": "unknown",
  0: "connecting",
  1: "open",
  2: "closing",
  3: "closed",
} as const;

export abstract class Peer<AdapterContext = any> {
  _topics: Set<string> = new Set();

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
    return "";
  }

  get headers(): Headers | undefined {
    return undefined;
  }

  get readyState(): ReadyState | -1 {
    return -1;
  }

  abstract send(message: any, options?: { compress?: boolean }): number;

  publish(topic: string, message: any, options?: { compress?: boolean }) {
    // noop
  }

  subscribe(topic: string) {
    this._topics.add(topic);
  }

  unsubscribe(topic: string) {
    this._topics.delete(topic);
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

  /**
   * Closes the connection.
   *
   * Here is a list of close codes:
   *
   * - `1000` means "normal closure" (default)
   * - `1009` means a message was too big and was rejected
   * - `1011` means the server encountered an error
   * - `1012` means the server is restarting
   * - `1013` means the server is too busy or the client is rate-limited
   * - `4000` through `4999` are reserved for applications (you can use it!)
   *
   * To close the connection abruptly, use `terminate()`.
   *
   * @param code The close code to send
   * @param reason The close reason to send
   */
  abstract close(code?: number, reason?: string): void;

  /**
   * Abruptly close the connection.
   *
   * To gracefully close the connection, use `close()`.
   */
  abstract terminate(): void;
}
