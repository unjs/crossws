import { defineHooks } from "crossws";
import {createServer} from 'node:http'
import crossws from "crossws/adapters/node";
import { readFileSync } from "node:fs";

const ws = crossws({
  hooks: defineHooks({
    upgrade(req, socket) {
      if(!authorizedCheck(req)){
        socket.reject("Unauthorized")
      }else{
        socket.accept()
      }
    },

    open(peer) {
      // console.log("[ws] open", peer);
      peer.send({ user: "server", message: `Welcome ${peer}!` });
    },

    message(peer, message) {
      // console.log("[ws] message", peer, message);
      if (message.text().includes("ping")) {
        peer.send({ user: "server", message: "pong" });
      } else {
        peer.send({ user: peer.toString(), message: message.toString() });
      }
    },

    close(peer, event) {
      // console.log("[ws] close", peer, event);
    },

    error(peer, error) {
      // console.log("[ws] error", peer, error);
    },
  }),
});

const hostname = '127.0.0.1';
const port = 3000;

const index = readFileSync("./public/index.html");

const server = createServer((req, res) => {
  res.writeHead(200);
  res.end(index);
})

server.on("upgrade", ws.handleUpgrade);

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
