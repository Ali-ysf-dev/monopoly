import { PROPERTIES } from "../data/board.js";

const KEY = "monopoly-banker-v2";

export function loadGame() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 2 || data.edition !== "uk-mega" || !Array.isArray(data.players) || data.players.length < 2) return null;
    if (!data.deeds || !data.bank || !data.settings) return null;
    if (typeof data.bank.houses !== "number" || typeof data.bank.hotels !== "number" || typeof data.bank.skyscrapers !== "number" || typeof data.bank.depots !== "number" || typeof data.bank.busTickets !== "number") return null;
    if (PROPERTIES.some((prop) => {
      const deed = data.deeds[prop.id];
      return !deed || typeof deed.buildings !== "number" || typeof deed.mortgaged !== "boolean" || typeof deed.depot !== "boolean";
    })) return null;
    if (data.players.some((player) => typeof player.cash !== "number" || !player.id || !player.name)) return null;
    data.players = data.players.map((player) => ({
      ...player,
      jailCards: player.jailCards || 0,
      busTickets: player.busTickets || 0,
      bankrupt: Boolean(player.bankrupt),
    }));
    data.freeParkingPot = data.freeParkingPot || 0;
    data.history = [];
    data.toast = null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  if (typeof localStorage === "undefined") return;
  try {
    if (!state) {
      localStorage.removeItem(KEY);
      return;
    }
    const { history: _history, toast: _toast, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify({ ...rest, history: [], toast: null }));
  } catch {
    // The current session still works if the browser refuses storage.
  }
}
