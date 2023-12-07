// Reference: https://bun.sh/docs/api/websockets

export interface BunWSOptions {
  message: (
    ws: BunServerWebSocket,
    message: string | ArrayBuffer | Uint8Array,
  ) => void;
  open?: (ws: BunServerWebSocket) => void;
  close?: (ws: BunServerWebSocket) => void;
  error?: (ws: BunServerWebSocket, error: Error) => void;
  drain?: (ws: BunServerWebSocket) => void;
  perMessageDeflate?:
    | boolean
    | {
        compress?: boolean | BunWSCompressor;
        decompress?: boolean | BunWSCompressor;
      };
}

type BunWSCompressor =
  | `"disable"`
  | `"shared"`
  | `"dedicated"`
  | `"3KB"`
  | `"4KB"`
  | `"8KB"`
  | `"16KB"`
  | `"32KB"`
  | `"64KB"`
  | `"128KB"`
  | `"256KB"`;

export interface BunWSServer {
  pendingWebsockets: number;
  publish(
    topic: string,
    data: string | ArrayBufferView | ArrayBuffer,
    compress?: boolean,
  ): number;
  upgrade(
    req: Request,
    options?: {
      headers?: HeadersInit;
      data?: any;
    },
  ): boolean;
}

export interface BunServerWebSocket {
  readonly data: any;
  readonly readyState: number;
  readonly remoteAddress: string;
  send(message: string | ArrayBuffer | Uint8Array, compress?: boolean): number;
  close(code?: number, reason?: string): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  publish(topic: string, message: string | ArrayBuffer | Uint8Array): void;
  isSubscribed(topic: string): boolean;
  cork(cb: (ws: BunServerWebSocket) => void): void;
}
