import { propsInGroup } from "../src/data/board.js";
import {
  buildDepot,
  buildHouse,
  buyProperty,
  mortgageProperty,
  sellAllBuildings,
  sellBuilding,
  sellDepot,
  unmortgageProperty,
} from "../src/game/engine.js";

const ACTIONS = {
  buy: (game, playerId, { propId }) => buyProperty(game, playerId, propId),
  build: (game, _playerId, { propId }) => buildHouse(game, propId),
  sell: (game, _playerId, { propId }) => sellBuilding(game, propId),
  mortgage: (game, _playerId, { propId }) => mortgageProperty(game, propId),
  unmortgage: (game, _playerId, { propId }) => unmortgageProperty(game, propId),
  depot: (game, _playerId, { propId }) => buildDepot(game, propId),
  sellDepot: (game, _playerId, { propId }) => sellDepot(game, propId),
  sellAll: (game, _playerId, { groupId }) => sellAllBuildings(game, groupId),
};

function ownDeed(game, playerId, propId) {
  const deed = game.deeds?.[propId];
  if (!deed || deed.ownerId !== playerId) {
    throw new Error("You can only change your own deeds");
  }
}

export function applyPlayerAction(room, { token, playerId, action, propId, groupId }) {
  const seat = room.seats?.[playerId];
  if (!seat || seat.token !== token) return { error: "Join as this player on this phone first", status: 403 };
  if (!room.game) return { error: "The banker has not started", status: 400 };
  const player = room.game.players.find((item) => item.id === playerId);
  if (!player || player.bankrupt) return { error: "That player is out of the game", status: 400 };
  const run = ACTIONS[action];
  if (!run) return { error: "Unknown action", status: 400 };

  const game = structuredClone(room.game);
  try {
    if (action === "buy") {
      if (game.deeds?.[propId]?.ownerId) throw new Error("That deed is already owned");
    } else if (action === "sellAll") {
      const built = propsInGroup(groupId).filter((prop) => (game.deeds[prop.id]?.buildings || 0) > 0);
      if (!built.length) throw new Error("There are no buildings to sell");
      if (built.some((prop) => game.deeds[prop.id].ownerId !== playerId)) {
        throw new Error("You can only sell buildings on your own streets");
      }
    } else {
      ownDeed(game, playerId, propId);
    }
    const entry = run(game, playerId, { propId, groupId });
    game.log = [{
      id: crypto.randomUUID(),
      at: Date.now(),
      text: entry.text,
      tone: entry.tone || "move",
    }, ...(game.log || [])].slice(0, 80);
    game.toast = { text: entry.text, tone: "ok" };
    game.history = [];
  } catch (error) {
    return { error: error.message || "That action did not go through", status: 400 };
  }

  return {
    room: {
      ...room,
      game,
      revision: room.revision + 1,
      seats: {
        ...(room.seats || {}),
        [playerId]: { token, at: Date.now() },
      },
      seatTouch: token,
    },
    changed: true,
  };
}
