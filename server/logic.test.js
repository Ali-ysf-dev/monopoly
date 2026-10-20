import assert from "node:assert/strict";
import { applyClaim, applyGame, applyRelease, emptyRoom, linksForHost } from "./logic.js";

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
