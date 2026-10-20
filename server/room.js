import os from "node:os";
import { applyClaim, applyGame, applyRelease, emptyRoom, linksForHost, view } from "./logic.js";

function lanAddresses() {
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    const virtual = /virtual|vmware|hyper-v|wsl|docker|vbox|bluetooth|tailscale|zerotier|loopback/i.test(name);
    for (const net of list || []) {
      const v4 = net.family === "IPv4" || net.family === 4;
      if (!v4 || net.internal) continue;
      if (net.address.startsWith("169.254.")) continue;
      if (virtual) continue;
      found.push(net.address);
    }
  }
  if (found.length) return found;
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      const v4 = net.family === "IPv4" || net.family === 4;
      if (v4 && !net.internal && !net.address.startsWith("169.254.")) found.push(net.address);
    }
  }
  return found;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function createRoom() {
  let room = emptyRoom();
  const clients = new Set();

  function publish() {
    const payload = `data: ${JSON.stringify({ revision: room.revision, hostStamp: room.hostStamp, game: room.game })}\n\n`;
    for (const res of clients) res.write(payload);
  }

  function links(req) {
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const proto = req.headers["x-forwarded-proto"] || "http";
    return linksForHost(host, proto, req.socket?.localPort, lanAddresses());
  }

  function answer(req, token) {
    return view(room, token, links(req), true);
  }

  async function handle(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) {
      next();
      return;
    }

    try {
      if (req.method === "GET" && url.pathname === "/api/session") {
        const token = String(req.headers["x-banker-token"] || "");
        send(res, 200, answer(req, token));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/claim") {
        const body = await readBody(req);
        const result = applyClaim(room, { token: body.token, takeover: body.takeover === true });
        if (result.error) {
          send(res, result.status, { error: result.error });
          return;
        }
        room = result.room;
        if (result.changed) publish();
        send(res, 200, answer(req, body.token || ""));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/release") {
        const body = await readBody(req);
        const result = applyRelease(room, body.token);
        room = result.room;
        if (result.changed) publish();
        send(res, 200, { ok: true, ...answer(req, "") });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/game") {
        const token = String(req.headers["x-banker-token"] || "");
        const body = await readBody(req);
        const result = applyGame(room, {
          token,
          hostStamp: body.hostStamp,
          seq: body.seq,
          game: body.game,
        });
        if (result.error) {
          send(res, result.status, { error: result.error });
          return;
        }
        room = result.room;
        if (result.changed) publish();
        send(res, 200, {
          revision: room.revision,
          hostStamp: room.hostStamp,
          ignored: Boolean(result.ignored),
          unchanged: Boolean(result.unchanged),
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify({ revision: room.revision, hostStamp: room.hostStamp, game: room.game })}\n\n`);
        clients.add(res);
        const ping = setInterval(() => {
          res.write(": ping\n\n");
        }, 15000);
        req.on("close", () => {
          clearInterval(ping);
          clients.delete(res);
        });
        return;
      }

      send(res, 404, { error: "Not found" });
    } catch {
      if (!res.headersSent) send(res, 400, { error: "Bad request" });
    }
  }

  return { handle };
}
