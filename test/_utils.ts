import type { OutgoingHttpHeaders } from "node:http";
import { afterAll, beforeAll, afterEach } from "vitest";
import { execa, ResultPromise as ExecaRes } from "execa";
import { fileURLToPath } from "node:url";
import { getRandomPort, waitForPort } from "get-port-please";
import { WebSocket } from "ws";
import { wsTests } from "./tests";

const fixtureDir = fileURLToPath(new URL("fixture", import.meta.url));

export function wsConnect(
  url: string,
  opts?: { skip?: number; headers?: OutgoingHttpHeaders },
) {
  const ws = new WebSocket(url, { headers: opts?.headers });

  const upgradeHeaders: Record<string, string> = Object.create(null);

  const send = async (data: any) => {
    ws.send(
      typeof data === "string" ? data : JSON.stringify({ message: data }),
    );
  };

  const messages: unknown[] = [];

  const waitCallbacks: Record<string, (message: any) => void> = {};
  let nextIndex = opts?.skip || 0;
  const next = () => {
    const index = nextIndex++;
    if (index < messages.length) {
      return Promise.resolve(messages[index]);
    }
    return new Promise<any>((resolve) => {
      waitCallbacks[index] = resolve;
    });
  };
  const skip = (count: number = 1) => {
    nextIndex += count;
  };

  ws.once("upgrade", (req) => {
    Object.assign(upgradeHeaders, req.headers);
  });

  ws.on("message", (data: any) => {
    const str =
      typeof data === "string" ? data : new TextDecoder().decode(data);
    const payload = str[0] === "{" ? JSON.parse(str) : str;
    messages.push(payload);
    const index = messages.length - 1;
    if (waitCallbacks[index]) {
      waitCallbacks[index](payload);
      delete waitCallbacks[index];
    }
  });

  afterEach(() => {
    ws.removeAllListeners();
    ws.close();
  });

  const res = {
    ws,
    send,
    next,
    skip,
    messages,
    upgradeHeaders,
  };

  const connectPromise = new Promise((resolve, reject) => {
    ws.once("open", () => resolve(res));
    ws.once("error", reject);
    ws.once("unexpected-response", (_req, res) => {
      const bodyChunks: any[] = [];
      res.on("data", (chunk) => {
        bodyChunks.push(chunk);
      });
      res.once("end", () => {
        const body = Buffer.concat(bodyChunks).toString();
        reject(
          new Error(
            `Unexpected response: ${res.statusCode} ${res.statusMessage} (body:${body})`,
            {
              cause: {
                status: res.statusCode!,
                statusText: res.statusMessage!,
                headers: res.headers,
                body,
              },
            },
          ),
        );
      });
    });
  });

  return Object.assign(connectPromise, res) as Promise<typeof res>;
}

export function wsTestsExec(cmd: string, opts?: Parameters<typeof wsTests>[1]) {
  let childProc: ExecaRes;
  let url: string;
  beforeAll(async () => {
    const port = await getRandomPort("localhost");
    url = `ws://localhost:${port}/`;
    const [bin, ...args] = cmd
      .replace("$PORT", String(port))
      .replace("./", fixtureDir + "/")
      .split(" ");
    childProc = execa(bin, args, { env: { PORT: port.toString() } });
    childProc.catch((error) => {
      if (error.signal !== "SIGTERM") {
        console.error(error);
      }
    });
    childProc.stderr!.on("data", (chunk) => {
      console.log(chunk.toString());
    });
    if (process.env.TEST_DEBUG) {
      childProc.stdout!.on("data", (chunk) => {
        console.log(chunk.toString());
      });
    }
    await waitForPort(port, { host: "localhost", delay: 50, retries: 100 });
  });
  afterAll(async () => {
    await childProc.kill();
  });
  wsTests(() => url, opts);
}
