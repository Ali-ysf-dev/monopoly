import assert from "node:assert/strict";
import { applyClaim, applyGame, applyJoin, applyLeave, applyRelease, emptyRoom, linksForHost, mergeRooms } from "./logic.js";

const room = emptyRoom();
const claimed = applyClaim(room, { token: "banker", takeover: false });
assert.equal(claimed.room.hostToken, "banker");
assert.equal(claimed.room.hostStamp, 1);

const guest = applyClaim(claimed.room, { token: "phone", takeover: false });
assert.equal(guest.room.hostToken, "banker");
assert.equal(guest.changed, undefined);

const game = {
  version: 2,
  players: [{ id: "a", name: "Ada" }],
  deeds: { "old-kent": { ownerId: null } },
  history: [{ cash: 1 }],
};
const pushed = applyGame(claimed.room, { token: "banker", hostStamp: 1, seq: 1, game });
assert.equal(pushed.room.revision, 1);
assert.equal(pushed.room.game.history.length, 0);
assert.equal(pushed.room.game.players[0].name, "Ada");

const repeat = applyGame(pushed.room, { token: "banker", hostStamp: 1, seq: 2, game });
assert.equal(repeat.unchanged, true);
assert.equal(repeat.room.revision, 1);

const denied = applyGame(pushed.room, { token: "phone", hostStamp: 1, seq: 3, game });
assert.equal(denied.status, 403);

const joined = applyJoin(pushed.room, { token: "phone-a", playerId: "a" }, 1_000);
assert.equal(joined.room.seats.a.token, "phone-a");
const other = applyJoin(joined.room, { token: "phone-b", playerId: "b" }, 1_000);
assert.equal(other.status, 404);

const gameWithTwo = {
  ...pushed.room.game,
  players: [
    { id: "a", name: "Ada" },
    { id: "b", name: "Bea" },
  ],
};
const seated = applyJoin({ ...pushed.room, game: gameWithTwo }, { token: "phone-a", playerId: "a" }, 2_000);
const both = applyJoin(seated.room, { token: "phone-b", playerId: "b" }, 2_000);
assert.equal(both.room.seats.a.token, "phone-a");
assert.equal(both.room.seats.b.token, "phone-b");
const blocked = applyJoin(both.room, { token: "phone-c", playerId: "a" }, 2_000);
assert.equal(blocked.status, 409);
const left = applyLeave(both.room, { token: "phone-a" }, 2_000);
assert.equal(left.room.seats.a, undefined);
assert.equal(left.room.seats.b.token, "phone-b");

const merged = mergeRooms(
  { ...emptyRoom(), revision: 2, seats: { a: { token: "phone-a", at: 5 } }, game: { startedAt: 1 } },
  { ...emptyRoom(), revision: 1, seats: { b: { token: "phone-b", at: 6 } }, game: { startedAt: 1 }, seatTouch: "phone-b" },
);
assert.equal(merged.revision, 2);
assert.equal(merged.seats.a.token, "phone-a");
assert.equal(merged.seats.b.token, "phone-b");
assert.equal(merged.seatTouch, undefined);

const table = {
  version: 2,
  startedAt: 9,
  players: [{ id: "a", name: "Ada" }],
  deeds: { "old-kent": { ownerId: null } },
  history: [],
};
const opened = applyGame(both.room, { token: "banker", hostStamp: 1, seq: 4, game: table, baseRevision: 0 });
assert.equal(opened.changed, true);
const clash = applyGame(opened.room, {
  token: "banker",
  hostStamp: 1,
  seq: 5,
  game: { ...table, log: [{ id: "x", text: "later", tone: "move" }] },
  baseRevision: 0,
});
assert.equal(clash.conflict, true);
assert.equal(clash.room.revision, opened.room.revision);

const released = applyRelease(claimed.room, "banker");
assert.equal(released.room.hostToken, null);

assert.deepEqual(
  linksForHost("monopoly.vercel.app", "https", 443, []),
  ["https://monopoly.vercel.app/?play=1"],
);
assert.deepEqual(
  linksForHost("localhost:5173", "http", 5173, ["192.168.1.100"]),
  ["http://192.168.1.100:5173/?play=1"],
);

console.log("room logic tests passed");
