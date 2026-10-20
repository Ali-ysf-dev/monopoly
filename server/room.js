import os from "node:os";

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
  let hostToken = null;
  let hostStamp = 0;
  let revision = 0;
  let lastSeq = 0;
  let game = null;
  const clients = new Set();

  function snapshot() {
    return { revision, hostStamp, game };
  }

  function publish() {
    const payload = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of clients) res.write(payload);
  }

  function links(req) {
    const port = req.socket.localPort;
    return lanAddresses().map((ip) => `http://${ip}:${port}/?play=1`);
  }

  function sessionFor(token, req) {
    let role = "open";
    if (hostToken && token === hostToken) role = "host";
    else if (hostToken) role = "guest";
    return { role, revision, hostStamp, game, links: links(req) };
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
        send(res, 200, sessionFor(token, req));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/claim") {
        const body = await readBody(req);
        const token = body.token;
        if (!token || typeof token !== "string") {
          send(res, 400, { error: "Missing token" });
          return;
        }
        const canTake = !hostToken || hostToken === token || (body.takeover === true && !game);
        if (!canTake) {
          send(res, 200, sessionFor(token, req));
          return;
        }
        hostToken = token;
        hostStamp += 1;
        lastSeq = 0;
        publish();
        send(res, 200, sessionFor(token, req));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/release") {
        const body = await readBody(req);
        if (body.token && body.token === hostToken) {
          hostToken = null;
          hostStamp += 1;
          publish();
        }
        send(res, 200, { ok: true, ...sessionFor("", req) });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/game") {
        const token = String(req.headers["x-banker-token"] || "");
        if (!hostToken && token) hostToken = token;
        if (!token || token !== hostToken) {
          send(res, 403, { error: "Only the banker can update the game" });
          return;
        }
        const body = await readBody(req);
        if (body.hostStamp !== hostStamp || (Number.isInteger(body.seq) && body.seq < lastSeq)) {
          send(res, 200, { revision, hostStamp, ignored: true });
          return;
        }
        if (Number.isInteger(body.seq)) lastSeq = body.seq;
        if (body.game === null) {
          game = null;
        } else if (body.game && body.game.version === 2 && Array.isArray(body.game.players) && body.game.deeds) {
          game = { ...body.game, history: [] };
        } else {
          send(res, 400, { error: "Invalid game" });
          return;
        }
        revision += 1;
        publish();
        send(res, 200, { revision, hostStamp });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
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
