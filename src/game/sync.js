const TOKEN_KEY = "monopoly-banker-device";
const REV_KEY = "monopoly-banker-rev";

export function deviceToken() {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function wantsPlayerView() {
  return new URLSearchParams(location.search).get("play") === "1";
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

export function fetchSession(token) {
  return fetch("/api/session", {
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

export function pushGame(token, state, hostStamp) {
  pushSeq += 1;
  return post("/api/game", token, {
    seq: pushSeq,
    hostStamp,
    game: stripForSync(state),
  });
}

export function subscribe(onMessage, onStatus) {
  const source = new EventSource("/api/events");
  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
      onStatus?.(true);
    } catch {
      // Ignore a frame that is not the game snapshot.
    }
  };
  source.onerror = () => onStatus?.(false);
  return () => source.close();
}
