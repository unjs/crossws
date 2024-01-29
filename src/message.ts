export class WebSocketMessage {
  constructor(
    public readonly rawData: string | ArrayBuffer | Uint8Array,
    public readonly isBinary?: boolean,
  ) {}

  text(): string {
    return this.rawData.toString();
  }

  toString() {
    return `<WebSocketMessage: ${this.text()}>`;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }
}
