import { toBufferLike } from "./_utils";

export class Message {
  constructor(
    public readonly rawData: any,
    public readonly isBinary?: boolean,
  ) {}

  text(): string {
    if (typeof this.rawData === "string") {
      return this.rawData;
    }
    const buff = toBufferLike(this.rawData);
    if (typeof buff === "string") {
      return buff;
    }
    return new TextDecoder().decode(buff);
  }

  toString() {
    return this.text();
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.text();
  }
}
