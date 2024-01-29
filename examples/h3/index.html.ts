export const html = ({ name }) => /* html */ `<!doctype html>
<head>
  <title>CrossWS Test Page</title>
</head>
<body>
  <h1>CrossWS Test Page (${name || "?"})</h1>

  <button onclick="sendPing()">Send Ping</button>
  <button onclick="connect()">Reconnect</button>
  <button onclick="clearLogs()">Clear</button>

  <pre id="logs"></pre>

  <script type="module">
    const url = "ws://"  + location.host + "/_ws";

    const logsEl = document.querySelector("#logs");
    let lastTime = performance.now();
    const log = (...args) => {
      const now = performance.now();
      const time = Math.round((now - lastTime) * 1000) / 1000;
      lastTime = now;

      console.log("[ws]", ...args);
      logsEl.innerText += "\\n (" + String(time).padStart(4, ' ') + "ms) " +  args.join(" ");
    };

    let ws
    globalThis.connect = async () => {
      if (ws) {
        log("Closing...");
        ws.close();
      }

      log("Connecting to", url, "...");
      ws = new WebSocket(url);

      ws.addEventListener("message", (event) => {
        log("Message from server:", event.data);
      });

      log("Waiting for connection...");
      await new Promise((resolve) => ws.addEventListener("open", resolve));
    }

    globalThis.clearLogs = () => {
      logsEl.innerText = ''
    }

    globalThis.sendPing = () => {
      log("Sending ping...");
      ws.send("ping");
    }

    await connect();
    sendPing()
  </script>
</body>
`;
