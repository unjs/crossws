import type { Peer } from "./peer.ts";
import { AdapterInstance } from "./types.ts";

type BufferLike = string | Buffer | Uint8Array | ArrayBuffer;

export function toBufferLike(val: any): BufferLike {
  if (val === undefined || val === null) {
    return "";
  }

  const type = typeof val;

  if (type === "string") {
    return val;
  }

  if (type === "number" || type === "boolean" || type === "bigint") {
    return val.toString();
  }

  if (type === "function" || type === "symbol") {
    return "{}";
  }

  if (val instanceof Uint8Array || val instanceof ArrayBuffer) {
    return val;
  }

  if (isPlainObject(val)) {
    return JSON.stringify(val);
  }

  return val;
}

// Forked from sindresorhus/is-plain-obj (MIT)
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
// From https://github.com/unjs/defu/blob/main/src/_utils.ts
export function isPlainObject(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== null &&
    prototype !== Object.prototype &&
    Object.getPrototypeOf(prototype) !== null
  ) {
    return false;
  }

  if (Symbol.iterator in value) {
    return false;
  }

  if (Symbol.toStringTag in value) {
    return Object.prototype.toString.call(value) === "[object Module]";
  }

  return true;
}

export function adapterUtils(peers: Set<Peer>) {
  return {
    peers,
    publish(topic: string, message: any, options) {
      const firstPeer = peers.values().next().value as Peer;
      if (firstPeer) {
        firstPeer.send(message, options);
        firstPeer.publish(topic, message, options);
      }
    },
  } satisfies AdapterInstance;
}
