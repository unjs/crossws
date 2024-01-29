import { WebSocket as _WebSocket } from "ws";

export default globalThis.WebSocket || _WebSocket;
