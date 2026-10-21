const TOKEN_KEY = "monopoly-banker-device";
const REV_KEY = "monopoly-banker-rev";

export function deviceToken() {
  const store = wantsPlayerView() ? sessionStorage : localStorage;
  let token = store.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    store.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function playerFromUrl() {
  return new URLSearchParams(location.search).get("as") || "";
}

export function personalLink(base, playerId) {
  const url = new URL(base);
  url.searchParams.set("play", "1");
  if (playerId) url.searchParams.set("as", playerId);
  else url.searchParams.delete("as");
  return url.toString();
}

export function wantsPlayerView() {
  const params = new URLSearchParams(location.search);
  return params.get("play") === "1" || Boolean(params.get("as"));
}

export function rememberedRevision() {
  return Number(localStorage.getItem(REV_KEY) || 0);
}

export function rememberRevision(revision) {
  if (Number.isInteger(revision)) localStorage.setItem(REV_KEY, String(revision));
}

export function stripForSync(state) {
  if (!state) return null;
  const { history: _history, ...rest } = state;
  return { ...rest, history: [] };
}

async function post(path, token, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-banker-token": token,
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "The table could not be updated");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function withPlayerLinks(links) {
  if (Array.isArray(links) && links.length) return links;
  const hostname = location.hostname;
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") return [];
  return [`${location.origin}/?play=1`];
}

export function fetchSession(token) {
  return fetch(`/api/session?t=${Date.now()}`, {
    headers: { "x-banker-token": token },
    cache: "no-store",
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No table");
    return data;
  });
}

export function claimHost(token, { takeover = false } = {}) {
  return post("/api/claim", token, { token, takeover });
}

export function releaseHost(token) {
  return post("/api/release", token, { token });
}

let pushSeq = 0;

export function pushGame(token, state, hostStamp, baseRevision) {
  pushSeq += 1;
  return post("/api/game", token, {
    seq: pushSeq,
    hostStamp,
    baseRevision,
    game: stripForSync(state),
  });
}

export function joinSeat(token, playerId) {
  return post("/api/join", token, { playerId });
}

export function actAsPlayer(token, playerId, action, extra = {}) {
  return post("/api/act", token, { playerId, action, ...extra });
}

export function subscribe(onMessage, onStatus) {
  let stopped = false;
  let lastKey = "";
  let source = null;

  function emit(payload) {
    const taken = (payload.taken || []).join(",");
    const key = `${payload.hostStamp}:${payload.revision}:${taken}:${payload.mine || ""}`;
    if (key === lastKey) return;
    lastKey = key;
    onMessage({
      revision: payload.revision,
      hostStamp: payload.hostStamp,
      game: payload.game ?? null,
      taken: payload.taken,
      mine: payload.mine || null,
    });
  }

  async function tick() {
    try {
      const session = await fetchSession(deviceToken());
      emit(session);
      onStatus?.(true);
      if (session.stream && !source) {
        source = new EventSource("/api/events");
        source.onmessage = (event) => {
          try {
            emit(JSON.parse(event.data));
            onStatus?.(true);
          } catch {
            // Ignore a frame that is not the game snapshot.
          }
        };
      }
    } catch {
      onStatus?.(false);
    }
  }

  tick();
  const timer = setInterval(() => {
    if (!stopped && document.visibilityState !== "hidden") tick();
  }, 2000);
  const onVisible = () => {
    if (!stopped && document.visibilityState !== "hidden") tick();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    source?.close();
  };
}
