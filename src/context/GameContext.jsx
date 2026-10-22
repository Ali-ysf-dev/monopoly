import { flushSync } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createGame } from "../game/engine.js";
import { gameReducer } from "../game/reducer.js";
import { loadGame, saveGame } from "../game/storage.js";
import {
  actAsPlayer,
  claimHost,
  deviceToken,
  fetchSession,
  joinSeat,
  leaveSeat,
  pushGame,
  releaseHost,
  rememberRevision,
  rememberedRevision,
  stripForSync,
  subscribe,
  wantsPlayerView,
  withPlayerLinks,
} from "../game/sync.js";

const GameContext = createContext(null);
const PLAYER_KEY = "monopoly-dashboard-player";

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, null, loadGame);
  const [role, setRole] = useState("pending");
  const [links, setLinks] = useState([]);
  const [live, setLive] = useState(false);
  const [followedId, setFollowedId] = useState(() => {
    try {
      return localStorage.getItem(PLAYER_KEY) || "";
    } catch {
      return "";
    }
  });
  const [taken, setTaken] = useState([]);
  const [joinError, setJoinError] = useState("");
  const [syncNonce, setSyncNonce] = useState(0);
  const roleRef = useRef("pending");
  const stateRef = useRef(null);
  const tokenRef = useRef("");
  const hostStampRef = useRef(0);
  const sentRef = useRef("");
  const pushGen = useRef(0);
  const revisionRef = useRef(-1);
  const adoptingRef = useRef(false);
  const followedRef = useRef(followedId);

  useEffect(() => {
    roleRef.current = role;
    stateRef.current = state;
    followedRef.current = followedId;
  }, [role, state, followedId]);

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
          setLinks(withPlayerLinks(session.links));
          dispatch({ type: "REPLACE", game: session.game });
          setLive(true);
          setRole("player");
          return;
        }

        const session = await claimHost(token);
        if (cancelled) return;
        hostStampRef.current = session.hostStamp || 0;
        setLinks(withPlayerLinks(session.links));
        if (session.role !== "host") {
          dispatch({ type: "REPLACE", game: session.game });
          setLive(true);
          setRole("player");
          return;
        }

        const local = stateRef.current;
        if (session.game && !local) {
          dispatch({ type: "REPLACE", game: session.game });
          revisionRef.current = session.revision || 0;
          rememberRevision(session.revision);
        } else if (local && !session.game) {
          const pushed = await pushGame(token, local, session.hostStamp, rememberedRevision());
          if (!pushed.ignored && !pushed.conflict) {
            revisionRef.current = pushed.revision ?? 0;
            rememberRevision(pushed.revision);
            sentRef.current = JSON.stringify(stripForSync(local));
          }
        } else if (local && session.game) {
          const sameTable = local.startedAt && local.startedAt === session.game.startedAt;
          if (sameTable && session.revision > rememberedRevision()) {
            dispatch({ type: "REPLACE", game: session.game });
            revisionRef.current = session.revision || 0;
            rememberRevision(session.revision);
            sentRef.current = JSON.stringify(stripForSync(session.game));
          } else {
            const pushed = await pushGame(token, local, session.hostStamp, sameTable ? rememberedRevision() : 0);
            if (!pushed.ignored && !pushed.conflict) {
              revisionRef.current = pushed.revision ?? 0;
              rememberRevision(pushed.revision);
              sentRef.current = JSON.stringify(stripForSync(local));
            }
          }
        }
        if (!cancelled) setRole("host");
      } catch {
        if (cancelled) return;
        setLinks(withPlayerLinks([]));
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
      if (Array.isArray(payload.taken)) setTaken(payload.taken);

      if (roleRef.current === "host") {
        const remoteRev = payload.revision || 0;
        if (payload.game && stateRef.current?.startedAt === payload.game.startedAt && remoteRev > revisionRef.current) {
          adoptingRef.current = true;
          revisionRef.current = remoteRev;
          rememberRevision(remoteRev);
          dispatch({ type: "REPLACE", game: payload.game });
        }
        if (payload.hostStamp === hostStampRef.current) return;
        fetchSession(tokenRef.current).then((session) => {
          if (roleRef.current !== "host") return;
          hostStampRef.current = session.hostStamp || 0;
          setLinks(withPlayerLinks(session.links));
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

      const remoteRev = payload.revision ?? -1;
      if (remoteRev !== revisionRef.current) {
        revisionRef.current = remoteRev;
        dispatch({ type: "REPLACE", game: payload.game ?? null });
      }
      setLive(true);
    }, (ok) => {
      if (roleRef.current === "player") setLive(ok);
    });
  }, [role]);

  useEffect(() => {
    if (role !== "host") return undefined;
    const body = JSON.stringify(stripForSync(state));
    if (adoptingRef.current) {
      adoptingRef.current = false;
      sentRef.current = body;
      return undefined;
    }
    if (body === sentRef.current) return undefined;
    const gen = ++pushGen.current;
    const timer = setTimeout(() => {
      pushGame(tokenRef.current, state, hostStampRef.current, rememberedRevision()).then(async (result) => {
        if (gen !== pushGen.current) return;
        if (result.conflict) {
          const session = await fetchSession(tokenRef.current);
          adoptingRef.current = true;
          revisionRef.current = session.revision || 0;
          rememberRevision(session.revision);
          dispatch({ type: "REPLACE", game: session.game });
          return;
        }
        if (result.ignored) return;
        sentRef.current = body;
        revisionRef.current = result.revision ?? revisionRef.current;
        rememberRevision(result.revision);
      }).catch(() => {
        if (gen !== pushGen.current || roleRef.current !== "host") return;
        window.setTimeout(() => {
          if (roleRef.current !== "host") return;
          const retryGen = ++pushGen.current;
          pushGame(tokenRef.current, stateRef.current, hostStampRef.current, rememberedRevision()).then((result) => {
            if (retryGen !== pushGen.current || result.ignored || result.conflict) return;
            sentRef.current = JSON.stringify(stripForSync(stateRef.current));
            revisionRef.current = result.revision ?? revisionRef.current;
            rememberRevision(result.revision);
          }).catch(() => {});
        }, 800);
      });
    }, 40);
    return () => clearTimeout(timer);
  }, [state, role, syncNonce]);

  useEffect(() => {
    if (role !== "host") return undefined;
    const timer = setInterval(() => {
      pushGame(tokenRef.current, stateRef.current, hostStampRef.current, rememberedRevision()).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [role]);

  useEffect(() => {
    if (role !== "player" || !followedId) return undefined;
    let stop = false;
    async function beat() {
      try {
        await joinSeat(tokenRef.current, followedId);
        if (!stop) setJoinError("");
      } catch (error) {
        if (stop || error.status !== 409) return;
        try {
          localStorage.removeItem(PLAYER_KEY);
        } catch {
          // The chooser still opens if storage is blocked.
        }
        setFollowedId("");
        setJoinError(error.message);
      }
    }
    beat();
    const timer = setInterval(beat, 12000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [role, followedId]);

  const choosePlayer = useCallback((id) => {
    setJoinError("");
    try {
      localStorage.setItem(PLAYER_KEY, id);
    } catch {
      // A private phone can still play for this visit.
    }
    setFollowedId(id);
  }, []);

  const clearPlayer = useCallback(() => {
    try {
      localStorage.removeItem(PLAYER_KEY);
    } catch {
      // The chooser still opens if storage is blocked.
    }
    setFollowedId("");
    leaveSeat(tokenRef.current).catch(() => {});
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
      rememberRevision(0);
      revisionRef.current = 0;
      dispatch({ type: "START", game: createGame(config) });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }, []);

  const playerAct = useCallback(async (action, extra = {}) => {
    const playerId = followedRef.current;
    if (!playerId) return { ok: false, error: "Choose your name first" };
    try {
      await joinSeat(tokenRef.current, playerId);
      const result = await actAsPlayer(tokenRef.current, playerId, action, extra);
      revisionRef.current = result.revision ?? revisionRef.current;
      rememberRevision(result.revision);
      dispatch({ type: "REPLACE", game: result.game });
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
    taken,
    joinError,
    choosePlayer,
    clearPlayer,
    watchAsPlayer,
    takeOverBanker,
    playerAct,
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
    taken,
    joinError,
    choosePlayer,
    clearPlayer,
    watchAsPlayer,
    takeOverBanker,
    playerAct,
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
