import { getCache } from "@vercel/functions";
import { emptyRoom } from "./logic.js";

const KEY = "table";
const TTL_SECONDS = 60 * 60 * 6;

function cache() {
  return getCache({ namespace: "monopoly-banker" });
}

export async function loadRoom() {
  const stored = await cache().get(KEY);
  if (!stored || typeof stored !== "object" || typeof stored.hostStamp !== "number") return emptyRoom();
  return {
    hostToken: stored.hostToken || null,
    hostStamp: stored.hostStamp,
    revision: stored.revision || 0,
    lastSeq: stored.lastSeq || 0,
    game: stored.game || null,
  };
}

export async function saveRoom(room) {
  await cache().set(KEY, room, { ttl: TTL_SECONDS, name: "monopoly-table" });
}
