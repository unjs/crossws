export class WebSocketError extends Error {
  constructor(...args: any[]) {
    super(...args);
    this.name = "WebSocketError";
  }
}
