export const SEAT_MS = 90_000;

export function emptyRoom() {
  return { hostToken: null, hostStamp: 0, revision: 0, lastSeq: 0, game: null, seats: {} };
}

function freshSeats(room, now = Date.now()) {
  const seats = {};
  for (const [id, seat] of Object.entries(room.seats || {})) {
    if (seat?.token && now - seat.at < SEAT_MS) seats[id] = seat;
  }
  return seats;
}

export function view(room, token, links, stream, now = Date.now()) {
  let role = "open";
  if (room.hostToken && token === room.hostToken) role = "host";
  else if (room.hostToken) role = "guest";
  const seats = freshSeats(room, now);
  let mine = null;
  for (const [id, seat] of Object.entries(seats)) {
    if (seat.token === token) mine = id;
  }
  return {
    role,
    revision: room.revision,
    hostStamp: room.hostStamp,
    game: room.game,
    links,
    stream: Boolean(stream),
    taken: Object.keys(seats),
    mine,
  };
}

export function mergeSeats(current = {}, next = {}, token = "") {
  const seats = { ...current };
  if (token) {
    for (const [id, seat] of Object.entries(seats)) {
      if (seat?.token === token) delete seats[id];
    }
  }
  for (const [id, seat] of Object.entries(next || {})) {
    if (!seat?.token) continue;
    if (!seats[id] || seat.at >= seats[id].at) seats[id] = seat;
  }
  return seats;
}

export function mergeRooms(current, next) {
  if (!current) return { ...emptyRoom(), ...next, seats: next.seats || {} };
  const seats = mergeSeats(current.seats, next.seats, next.seatTouch || "");
  const nextGameWins = (next.revision || 0) >= (current.revision || 0);
  const nextHostWins = (next.hostStamp || 0) >= (current.hostStamp || 0);
  return {
    hostToken: nextHostWins ? (next.hostToken || null) : (current.hostToken || null),
    hostStamp: Math.max(next.hostStamp || 0, current.hostStamp || 0),
    revision: Math.max(next.revision || 0, current.revision || 0),
    lastSeq: Math.max(next.lastSeq || 0, current.lastSeq || 0),
    game: nextGameWins ? (next.game ?? null) : (current.game ?? null),
    seats,
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

export function applyLeave(room, { token }, now = Date.now()) {
  if (!token || typeof token !== "string") return { error: "Missing token", status: 400 };
  const seats = freshSeats(room, now);
  let changed = false;
  for (const [id, seat] of Object.entries(seats)) {
    if (seat.token === token) {
      delete seats[id];
      changed = true;
    }
  }
  if (!changed) return { room };
  return { room: { ...room, seats, seatTouch: token }, changed: true };
}

export function applyJoin(room, { token, playerId }, now = Date.now()) {
  if (!token || typeof token !== "string") return { error: "Missing token", status: 400 };
  if (!room.game) return { error: "The banker has not started", status: 400 };
  const player = room.game.players.find((item) => item.id === playerId);
  if (!player) return { error: "That player is not in this game", status: 404 };
  const seats = freshSeats(room, now);
  for (const [id, seat] of Object.entries(seats)) {
    if (seat.token === token && id !== playerId) delete seats[id];
  }
  const current = seats[playerId];
  if (current && current.token !== token) {
    return { error: `${player.name} is already open on another phone`, status: 409, room };
  }
  seats[playerId] = { token, at: now };
  return { room: { ...room, seats, seatTouch: token }, changed: true };
}

function sameGame(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function applyGame(room, { token, hostStamp, seq, game, baseRevision }) {
  let next = room;
  if (!next.hostToken && token) next = { ...next, hostToken: token };
  if (!token || token !== next.hostToken) {
    return { error: "Only the banker can update the game", status: 403 };
  }
  if (hostStamp !== next.hostStamp || (Number.isInteger(seq) && seq < next.lastSeq)) {
    return { room: next, ignored: true };
  }
  if (Number.isInteger(baseRevision) && baseRevision !== next.revision && game?.startedAt && game.startedAt === next.game?.startedAt) {
    return { room: next, conflict: true };
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
