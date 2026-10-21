import { getCache } from "@vercel/functions";
import { emptyRoom, mergeRooms } from "./logic.js";

const KEY = "table";
const REMOTE_KEY = "monopoly-table";
const TTL_SECONDS = 60 * 60 * 6;
const memory = globalThis;

function bucket() {
  if (!memory.__monopolyRooms) memory.__monopolyRooms = new Map();
  return memory.__monopolyRooms;
}

function cache() {
  return getCache({ namespace: "monopoly-banker" });
}

function remoteConfig() {
  const endpoint = process.env.RUNTIME_CACHE_ENDPOINT;
  const raw = process.env.RUNTIME_CACHE_HEADERS;
  if (!endpoint || !raw) return null;
  try {
    return { endpoint, headers: JSON.parse(raw) };
  } catch {
    return null;
  }
}

async function remoteGet() {
  const config = remoteConfig();
  if (!config) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${config.endpoint}${REMOTE_KEY}`, {
      headers: config.headers,
      signal: controller.signal,
    });
    if (response.status !== 200) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function remoteSet(room) {
  const config = remoteConfig();
  if (!config) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`${config.endpoint}${REMOTE_KEY}`, {
      method: "POST",
      headers: {
        ...config.headers,
        "x-vercel-revalidate": String(TTL_SECONDS),
        "x-vercel-cache-item-name": "monopoly-table",
      },
      body: JSON.stringify(room),
      signal: controller.signal,
    });
  } catch {
    // The other cache copy still serves the table when this write misses.
  } finally {
    clearTimeout(timer);
  }
}

function usable(stored) {
  return Boolean(stored && typeof stored === "object" && typeof stored.hostStamp === "number");
}

function normalize(stored) {
  if (!usable(stored)) return null;
  return {
    hostToken: stored.hostToken || null,
    hostStamp: stored.hostStamp,
    revision: stored.revision || 0,
    lastSeq: stored.lastSeq || 0,
    game: stored.game || null,
    seats: stored.seats || {},
  };
}

async function readShared() {
  let shared = null;
  try {
    shared = normalize(await cache().get(KEY));
  } catch {
    shared = null;
  }
  const remote = normalize(await remoteGet());
  if (shared && remote) return mergeRooms(shared, remote);
  return shared || remote;
}

async function writeShared(room) {
  try {
    await cache().set(KEY, room, { ttl: TTL_SECONDS, name: "monopoly-table" });
  } catch {
    // A timed-out runtime-cache write still leaves the direct copy and this instance.
  }
  await remoteSet(room);
}

export async function loadRoom() {
  const shared = await readShared();
  const local = normalize(bucket().get(KEY));
  const room = shared && local ? mergeRooms(shared, local) : (shared || local || emptyRoom());
  bucket().set(KEY, room);
  return room;
}

export async function saveRoom(room) {
  const current = await loadRoom();
  let merged = mergeRooms(current, room);
  bucket().set(KEY, merged);
  await writeShared(merged);

  const touch = room.seatTouch;
  const mine = touch && Object.entries(room.seats || {}).find(([, seat]) => seat?.token === touch);
  if (mine && merged.seats?.[mine[0]]?.token !== touch) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const latest = await loadRoom();
    merged = mergeRooms(latest, {
      ...room,
      seats: { ...(latest.seats || {}), [mine[0]]: mine[1] },
      seatTouch: touch,
    });
    bucket().set(KEY, merged);
    await writeShared(merged);
  }
  return merged;
}
