import { flushSync } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createGame } from "../game/engine.js";
import { gameReducer } from "../game/reducer.js";
import { loadGame, saveGame } from "../game/storage.js";
import {
  claimHost,
  deviceToken,
  fetchSession,
  pushGame,
  releaseHost,
  rememberRevision,
  rememberedRevision,
  stripForSync,
  subscribe,
  wantsPlayerView,
} from "../game/sync.js";

const GameContext = createContext(null);
const PLAYER_KEY = "monopoly-dashboard-player";

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, null, loadGame);
  const [role, setRole] = useState("pending");
  const [links, setLinks] = useState([]);
  const [live, setLive] = useState(false);
  const [followedId, setFollowedId] = useState(() => localStorage.getItem(PLAYER_KEY) || "");
  const [syncNonce, setSyncNonce] = useState(0);
  const roleRef = useRef("pending");
  const stateRef = useRef(null);
  const tokenRef = useRef("");
  const hostStampRef = useRef(0);
  const sentRef = useRef("");
  const pushGen = useRef(0);

  useEffect(() => {
    roleRef.current = role;
    stateRef.current = state;
  }, [role, state]);

  useEffect(() => {
    if (role === "host" || role === "solo") saveGame(state);
  }, [state, role]);

  useEffect(() => {
    if (!state?.toast) return undefined;
    if (role !== "host" && role !== "solo") return undefined;
    const delay = state.toast.tone === "err" ? 5600 : 3400;
    const timer = setTimeout(() => dispatch({ type: "CLEAR_TOAST" }), delay);
    return () => clearTimeout(timer);
  }, [state?.toast, role]);

  useEffect(() => {
    let cancelled = false;
    const token = deviceToken();
    tokenRef.current = token;
    const playerView = wantsPlayerView();

    async function boot() {
      try {
        if (playerView) {
          const session = await fetchSession(token);
          if (cancelled) return;
          hostStampRef.current = session.hostStamp || 0;
          setLinks(session.links || []);
          dispatch({ type: "REPLACE", game: session.game });
          setLive(true);
          setRole("player");
          return;
        }

        const session = await claimHost(token);
        if (cancelled) return;
        hostStampRef.current = session.hostStamp || 0;
        setLinks(session.links || []);
        if (session.role !== "host") {
          dispatch({ type: "REPLACE", game: session.game });
          setLive(true);
          setRole("player");
          return;
        }

        const local = stateRef.current;
        if (session.game && !local) {
          dispatch({ type: "REPLACE", game: session.game });
        } else if (local && !session.game) {
          const pushed = await pushGame(token, local, session.hostStamp);
          if (!pushed.ignored) {
            rememberRevision(pushed.revision);
            sentRef.current = JSON.stringify(stripForSync(local));
          }
        } else if (local && session.game) {
          if (session.revision > rememberedRevision()) {
            dispatch({ type: "REPLACE", game: session.game });
            rememberRevision(session.revision);
            sentRef.current = JSON.stringify(stripForSync(session.game));
          } else {
            const pushed = await pushGame(token, local, session.hostStamp);
            if (!pushed.ignored) {
              rememberRevision(pushed.revision);
              sentRef.current = JSON.stringify(stripForSync(local));
            }
          }
        }
        if (!cancelled) setRole("host");
      } catch {
        if (cancelled) return;
        setRole(playerView ? "offline-player" : "solo");
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (role !== "host" && role !== "player") return undefined;
    return subscribe((payload) => {
      if (roleRef.current === "host") {
        if (payload.hostStamp === hostStampRef.current) return;
        fetchSession(tokenRef.current).then((session) => {
          if (roleRef.current !== "host") return;
          hostStampRef.current = session.hostStamp || 0;
          setLinks(session.links || []);
          if (session.role !== "host") {
            dispatch({ type: "REPLACE", game: session.game });
            setLive(true);
            setRole("player");
          } else {
            sentRef.current = "";
            setSyncNonce((nonce) => nonce + 1);
          }
        }).catch(() => {});
        return;
      }
      setLive(true);
      dispatch({ type: "REPLACE", game: payload.game ?? null });
    }, (ok) => {
      if (roleRef.current === "player") setLive(ok);
    });
  }, [role]);

  useEffect(() => {
    if (role !== "host") return undefined;
    const body = JSON.stringify(stripForSync(state));
    if (body === sentRef.current) return undefined;
    const gen = ++pushGen.current;
    const timer = setTimeout(() => {
      pushGame(tokenRef.current, state, hostStampRef.current).then((result) => {
        if (gen !== pushGen.current || result.ignored) return;
        sentRef.current = body;
        rememberRevision(result.revision);
      }).catch(() => {
        if (gen !== pushGen.current || roleRef.current !== "host") return;
        window.setTimeout(() => {
          if (roleRef.current !== "host") return;
          const retryGen = ++pushGen.current;
          pushGame(tokenRef.current, stateRef.current, hostStampRef.current).then((result) => {
            if (retryGen !== pushGen.current || result.ignored) return;
            sentRef.current = JSON.stringify(stripForSync(stateRef.current));
            rememberRevision(result.revision);
          }).catch(() => {});
        }, 800);
      });
    }, 40);
    return () => clearTimeout(timer);
  }, [state, role, syncNonce]);

  const choosePlayer = useCallback((id) => {
    localStorage.setItem(PLAYER_KEY, id);
    setFollowedId(id);
  }, []);

  const clearPlayer = useCallback(() => {
    localStorage.removeItem(PLAYER_KEY);
    setFollowedId("");
  }, []);

  const watchAsPlayer = useCallback(async () => {
    const token = tokenRef.current || deviceToken();
    try {
      await releaseHost(token);
    } catch {
      // This phone can still open the player view if the release did not land.
    }
    const url = new URL(location.href);
    url.searchParams.set("play", "1");
    location.assign(url);
  }, []);

  const takeOverBanker = useCallback(async () => {
    const token = tokenRef.current || deviceToken();
    try {
      const session = await claimHost(token, { takeover: true });
      if (session.role !== "host") return false;
    } catch {
      const url = new URL(location.href);
      url.searchParams.delete("play");
      location.assign(url);
      return false;
    }
    const url = new URL(location.href);
    url.searchParams.delete("play");
    location.assign(url);
    return true;
  }, []);

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
    role,
    links,
    live,
    followedId,
    choosePlayer,
    clearPlayer,
    watchAsPlayer,
    takeOverBanker,
    active: state?.players.find((player) => player.id === state.activePlayerId) ?? null,
    act,
    undo,
    end,
    start,
    setActive,
    dismiss,
  }), [
    state,
    role,
    links,
    live,
    followedId,
    choosePlayer,
    clearPlayer,
    watchAsPlayer,
    takeOverBanker,
    act,
    undo,
    end,
    start,
    setActive,
    dismiss,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside GameProvider");
  return value;
}
