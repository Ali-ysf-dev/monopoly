import { flushSync } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { createGame } from "../game/engine.js";
import { gameReducer } from "../game/reducer.js";
import { loadGame, saveGame } from "../game/storage.js";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, null, loadGame);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    if (!state?.toast) return undefined;
    const delay = state.toast.tone === "err" ? 5600 : 3400;
    const timer = setTimeout(() => dispatch({ type: "CLEAR_TOAST" }), delay);
    return () => clearTimeout(timer);
  }, [state?.toast]);

  const act = useCallback((exec) => {
    let outcome = { ok: false, error: "That action did not finish" };
    flushSync(() => {
      dispatch({
        type: "ACT",
        exec,
        done: (result) => {
          outcome = result;
        },
      });
    });
    return outcome;
  }, []);

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const end = useCallback(() => dispatch({ type: "END" }), []);
  const dismiss = useCallback(() => dispatch({ type: "CLEAR_TOAST" }), []);
  const setActive = useCallback((id) => dispatch({ type: "SET_ACTIVE", id }), []);
  const start = useCallback((config) => {
    try {
      dispatch({ type: "START", game: createGame(config) });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }, []);

  const value = useMemo(() => ({
    state,
    active: state?.players.find((player) => player.id === state.activePlayerId) ?? null,
    act,
    undo,
    end,
    start,
    setActive,
    dismiss,
  }), [state, act, undo, end, start, setActive, dismiss]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside GameProvider");
  return value;
}
