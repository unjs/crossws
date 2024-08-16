// You can run this demo using `npm run play:cf-durable` in repo
import { DurableObject } from "cloudflare:workers";
import cloudflareAdapter from "../../src/adapters/cloudflare-durable.ts";
import { createDemo, getIndexHTML, handleDemoRoutes } from "./_shared.ts";

const ws = createDemo(cloudflareAdapter);

export default {
  async fetch(
    request: Request,
    env: Record<string, any>,
    context: ExecutionContext,
  ): Promise<Response> {
    const response = handleDemoRoutes(ws, request);
    if (response) {
      return response;
    }

    if (request.headers.get("upgrade") === "websocket") {
      return ws.handleUpgrade(request, env, context);
    }

    return new Response(await getIndexHTML(), {
      headers: { "content-type": "text/html" },
    });
  },
};

export class $DurableObject extends DurableObject {
  constructor(state: DurableObjectState, env: Record<string, any>) {
    super(state, env);
    ws.handleDurableInit(this, state, env);
  }

  fetch(request: Request) {
    return ws.handleDurableUpgrade(this, request);
  }

  async webSocketMessage(client: WebSocket, message: ArrayBuffer | string) {
    return ws.handleDurableMessage(this, client, message);
  }

  async webSocketClose(
    client: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ) {
    return ws.handleDurableClose(this, client, code, reason, wasClean);
  }
}
