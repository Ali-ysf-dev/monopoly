import { applyClaim, applyGame, applyRelease, linksForHost, view } from "./logic.js";
import { loadRoom, saveRoom } from "./store.js";

const headers = {
  "cache-control": "no-store, max-age=0",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
};

function json(body, status = 200) {
  return Response.json(body, { status, headers });
}

function linksFrom(request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return linksForHost(host, proto, url.port, []);
}

async function persist(result) {
  if (result.changed || result.refresh) await saveRoom(result.room);
}

export async function handleRequest(request, action) {
  try {
    const room = await loadRoom();
    const headerToken = request.headers.get("x-banker-token") || "";
    const links = linksFrom(request);

    if (action === "session") {
      return json(view(room, headerToken, links, false));
    }

    const body = await request.json().catch(() => ({}));
    let result;
    if (action === "claim") result = applyClaim(room, { token: body.token, takeover: body.takeover === true });
    else if (action === "release") result = applyRelease(room, body.token);
    else if (action === "game") {
      result = applyGame(room, {
        token: headerToken,
        hostStamp: body.hostStamp,
        seq: body.seq,
        game: body.game,
      });
    } else return json({ error: "Not found" }, 404);

    if (result.error) return json({ error: result.error }, result.status || 400);
    await persist(result);

    if (action === "game") {
      return json({
        revision: result.room.revision,
        hostStamp: result.room.hostStamp,
        ignored: Boolean(result.ignored),
        unchanged: Boolean(result.unchanged),
      });
    }

    const token = action === "release" ? "" : (body.token || headerToken);
    return json({ ok: true, ...view(result.room, token, links, false) });
  } catch {
    return json({ error: "The table could not be reached" }, 500);
  }
}
