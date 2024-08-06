import { afterAll, beforeAll, describe } from "vitest";
import { createServer, Server } from "node:http";
import { getRandomPort, waitForPort } from "get-port-please";
import nodeAdapter from "../../src/adapters/node";
import { createDemo } from "../fixture/_shared";
import { wsTests } from "../tests";

describe("node", () => {
  let server: Server;
  let url: string;
  let ws: ReturnType<typeof createDemo<typeof nodeAdapter>>;

  beforeAll(async () => {
    ws = createDemo(nodeAdapter);
    server = createServer((_req, res) => {
      res.end("ok");
    });
    server.on("upgrade", ws.handleUpgrade);
    const port = await getRandomPort("localhost");
    url = `ws://localhost:${port}/`;
    await new Promise<void>((resolve) => server.listen(port, resolve));
    await waitForPort(port);
  });

  afterAll(async () => {
    ws.closeAll();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  wsTests(() => url, {});
});
