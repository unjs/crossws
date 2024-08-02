import { afterAll, beforeAll, afterEach } from "vitest";
import { execa, ResultPromise as ExecaRes } from "execa";
import { fileURLToPath } from "node:url";
import { getRandomPort, waitForPort } from "get-port-please";
import WebSocket from "../src/websocket/node";
import { wsTests } from "./tests";

const fixtureDir = fileURLToPath(new URL("fixture", import.meta.url));

export function wsConnect(url: string, initialSkip?: number) {
  const ws = new WebSocket(url);

  const send = async (data: any) => {
    ws.send(
      typeof data === "string" ? data : JSON.stringify({ message: data }),
    );
  };

  const messages: unknown[] = [];

  const waitCallbacks: Record<string, (message: any) => void> = {};
  let nextIndex = initialSkip || 0;
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

  ws.on("message", (data: any) => {
    const str =
      typeof data === "string" ? data : new TextDecoder().decode(data);
    const msg = str[0] === "{" ? JSON.parse(str).message : str;
    messages.push(msg);
    const index = messages.length - 1;
    if (waitCallbacks[index]) {
      waitCallbacks[index](msg);
      delete waitCallbacks[index];
    }
  });

  const connectPromise = new Promise<void>((resolve) => ws.on("open", resolve));

  afterEach(() => {
    ws.close();
    ws.removeAllListeners("open");
    ws.removeAllListeners("message");
  });

  return connectPromise.then(() => ({
    ws,
    send,
    next,
    skip,
    messages,
  }));
}

export function wsTestsExec(cmd: string, pubsub = true) {
  let childProc: ExecaRes;
  let url: string;
  beforeAll(async () => {
    const port = await getRandomPort();
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
    // childProc.stdout!.on('data', (chunk) => { console.log(chunk.toString()) })
    await waitForPort(port, { host: "localhost", delay: 50, retries: 100 });
  });
  afterAll(async () => {
    await childProc.kill();
  });
  wsTests(() => url, pubsub);
}
