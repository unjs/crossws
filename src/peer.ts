import { randomUUID } from "uncrypto";

export interface AdapterInternal {
  ws: unknown;
  request?: Request | Partial<Request>;
  peers?: Set<Peer>;
}

export abstract class Peer<Internal extends AdapterInternal = AdapterInternal> {
  protected _internal: Internal;
  protected _topics: Set<string>;
  #id?: string;

  constructor(internal: Internal) {
    this._topics = new Set();
    this._internal = internal;
  }

  /**
   * Unique random [uuid v4](https://developer.mozilla.org/en-US/docs/Glossary/UUID) identifier for the peer.
   */
  get id(): string {
    if (!this.#id) {
      this.#id = randomUUID();
    }
    return this.#id;
  }

  /** IP address of the peer */
  get remoteAddress(): string | undefined {
    return undefined;
  }

  /** upgrade request */
  get request(): Request | Partial<Request> | undefined {
    return this._internal.request;
  }

  /** All connected peers to the server */
  get peers(): Set<Peer> {
    return this._internal.peers || new Set();
  }

  /** Get the [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) instance. */
  get webSocket(): WebSocket | Partial<WebSocket> {
    return this._internal.ws as WebSocket | Partial<WebSocket>;
  }

  get protocol(): string | undefined {
    return (
      this.webSocket.protocol ||
      this.request?.headers?.get("sec-websocket-protocol") ||
      undefined
    );
  }

  get extensions(): string | undefined {
    return (
      this.webSocket.extensions ||
      this.request?.headers?.get("sec-websocket-extensions") ||
      undefined
    );
  }

  abstract close(code?: number, reason?: string): void;

  /** Abruptly close the connection */
  terminate() {
    this.close();
  }

  /** Subscribe to a topic */
  subscribe(topic: string) {
    this._topics.add(topic);
  }

  /** Unsubscribe from a topic */
  unsubscribe(topic: string) {
    this._topics.delete(topic);
  }

  /** Send a message to the peer. */
  abstract send(
    data: unknown,
    options?: { compress?: boolean },
  ): number | void | undefined;

  /** Send message to subscribes of topic */
  abstract publish(
    topic: string,
    data: unknown,
    options?: { compress?: boolean },
  ): void;

  // --- inspect ---

  toString() {
    return this.id;
  }

  [Symbol.toPrimitive]() {
    return this.id;
  }

  [Symbol.toStringTag]() {
    return "WebSocket";
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return Object.fromEntries(
      [
        ["id", this.id],
        ["remoteAddress", this.remoteAddress],
        ["peers", this.peers],
        ["webSocket", this.webSocket],
      ].filter((p) => p[1]),
    );
  }
}
