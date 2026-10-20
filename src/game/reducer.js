function snapshot(state) {
  const { history: _history, toast: _toast, ...rest } = state;
  return structuredClone(rest);
}

export function gameReducer(state, action) {
  if (action.type === "START") return action.game;
  if (action.type === "END") return null;
  if (action.type === "REPLACE") {
    if (!action.game) return null;
    if (action.game.version !== 2 || !Array.isArray(action.game.players) || !action.game.deeds) return state;
    return {
      ...action.game,
      history: [],
      toast: action.game.toast ?? null,
      log: action.game.log || [],
    };
  }
  if (!state) return state;

  if (action.type === "SET_ACTIVE") {
    const player = state.players.find((item) => item.id === action.id && !item.bankrupt);
    if (!player) return state;
    return { ...state, activePlayerId: player.id };
  }

  if (action.type === "CLEAR_TOAST") {
    if (!state.toast) return state;
    return { ...state, toast: null };
  }

  if (action.type === "UNDO") {
    const history = state.history || [];
    if (!history.length) return { ...state, toast: { text: "Nothing to undo", tone: "err" } };
    const previous = history[history.length - 1];
    return {
      ...previous,
      history: history.slice(0, -1),
      toast: { text: "Last action undone", tone: "ok" },
    };
  }

  if (action.type === "ACT") {
    const snap = snapshot(state);
    const draft = structuredClone(snap);
    try {
      const entry = action.exec(draft);
      if (!entry?.text) throw new Error("That action did not finish");
      draft.log = [{
        id: crypto.randomUUID(),
        at: Date.now(),
        text: entry.text,
        tone: entry.tone || "move",
      }, ...(draft.log || [])].slice(0, 80);
      draft.history = [...(state.history || []), snap].slice(-25);
      draft.toast = { text: entry.text, tone: "ok" };
      action.done?.({ ok: true });
      return draft;
    } catch (error) {
      const text = error.message || "That action did not go through";
      action.done?.({ ok: false, error: text });
      return { ...state, toast: { text, tone: "err" } };
    }
  }

  return state;
}
