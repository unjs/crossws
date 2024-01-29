export class WebSocketMessage {
  constructor(
    public readonly rawData: string | ArrayBuffer | Uint8Array,
    public readonly isBinary?: boolean,
  ) {}

  text(): string {
    if (typeof this.rawData === "string") {
      return this.rawData;
    }
    return new TextDecoder().decode(this.rawData);
  }

  toString() {
    return `<WebSocketMessage: ${this.text()}>`;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }
}
