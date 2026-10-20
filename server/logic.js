export function emptyRoom() {
  return { hostToken: null, hostStamp: 0, revision: 0, lastSeq: 0, game: null };
}

export function view(room, token, links, stream) {
  let role = "open";
  if (room.hostToken && token === room.hostToken) role = "host";
  else if (room.hostToken) role = "guest";
  return {
    role,
    revision: room.revision,
    hostStamp: room.hostStamp,
    game: room.game,
    links,
    stream: Boolean(stream),
  };
}

export function linksForHost(hostHeader, protocol, port, lanAddresses) {
  const host = String(hostHeader || "").split(",")[0].trim();
  const hostname = host.split(":")[0];
  const namedHost = hostname && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.includes(":");
  if (namedHost) {
    const proto = String(protocol || "https").split(",")[0].trim() || "https";
    return [`${proto}://${host}/?play=1`];
  }
  return (lanAddresses || []).map((ip) => `http://${ip}:${port}/?play=1`);
}

export function applyClaim(room, { token, takeover }) {
  if (!token || typeof token !== "string") return { error: "Missing token", status: 400 };
  const canTake = !room.hostToken || room.hostToken === token || (takeover === true && !room.game);
  if (!canTake) return { room };
  return {
    room: { ...room, hostToken: token, hostStamp: room.hostStamp + 1, lastSeq: 0 },
    changed: true,
  };
}

export function applyRelease(room, token) {
  if (!token || token !== room.hostToken) return { room };
  return {
    room: { ...room, hostToken: null, hostStamp: room.hostStamp + 1 },
    changed: true,
  };
}

function sameGame(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function applyGame(room, { token, hostStamp, seq, game }) {
  let next = room;
  if (!next.hostToken && token) next = { ...next, hostToken: token };
  if (!token || token !== next.hostToken) {
    return { error: "Only the banker can update the game", status: 403 };
  }
  if (hostStamp !== next.hostStamp || (Number.isInteger(seq) && seq < next.lastSeq)) {
    return { room: next, ignored: true };
  }
  const stamped = Number.isInteger(seq) ? { ...next, lastSeq: seq } : next;
  if (game === null) {
    if (stamped.game === null) return { room: stamped, unchanged: true, refresh: true };
    return { room: { ...stamped, game: null, revision: stamped.revision + 1 }, changed: true };
  }
  if (!game || game.version !== 2 || !Array.isArray(game.players) || !game.deeds) {
    return { error: "Invalid game", status: 400 };
  }
  const stored = { ...game, history: [] };
  if (sameGame(stamped.game, stored)) return { room: stamped, unchanged: true, refresh: true };
  return { room: { ...stamped, game: stored, revision: stamped.revision + 1 }, changed: true };
}
