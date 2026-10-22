import { useEffect, useRef, useState } from "react";
import { GROUPED, GROUP_MAP, buildingLabel, propName } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import { personalLink, withPlayerLinks } from "../game/sync.js";
import { portfolio, rentQuote, unmortgageCost } from "../game/engine.js";
import { cents, formatMoney } from "../game/money.js";

function useCashFlash(value) {
  const previous = useRef(value);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (previous.current === value) return undefined;
    setFlash(value > previous.current ? "up" : "down");
    previous.current = value;
    const timer = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(timer);
  }, [value]);
  return flash;
}

export function PhoneLinks() {
  const { links, state } = useGame();
  const shown = withPlayerLinks(links);
  const [copied, setCopied] = useState(false);
  if (!shown.length) return null;
  const link = personalLink(shown[0]);
  const players = state?.players?.filter((player) => !player.bankrupt) ?? [];

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-ink/15 bg-white px-4 py-3">
      <h2 className="text-sm font-semibold text-ink">Player phones</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink/70">
        Every player opens this same link, then taps their own name.
      </p>
      <p className="mt-2 break-all text-sm font-medium text-ink" data-testid="phone-link">{link}</p>
      <button type="button" onClick={copy} className="mt-3 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink">
        {copied ? "Copied" : "Copy link"}
      </button>
      {players.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {players.map((player) => (
            <li key={player.id} className="flex items-center gap-2 rounded-full border border-ink/10 px-3 py-1 text-sm text-ink">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
              {player.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function deedFacts(state, prop, deed) {
  const quote = rentQuote(state, prop.id);
  const facts = [];
  const buildings = buildingLabel(deed.buildings);
  if (buildings) facts.push(buildings);
  if (deed.depot) facts.push("Train depot");
  if (deed.mortgaged) {
    facts.push("No rent while mortgaged");
    facts.push(`Mortgaged for ${formatMoney(cents(prop.mortgage))}`);
    facts.push(`Unmortgage costs ${formatMoney(unmortgageCost(prop))}`);
  } else if (quote.needsDice) {
    facts.push(`Rent is ${quote.detail}`);
  } else if (quote.amount) {
    facts.push(`Rent ${formatMoney(quote.amount)}`);
    if (quote.detail) facts.push(quote.detail);
  } else if (quote.detail) {
    facts.push(quote.detail);
  }
  facts.push(`Printed price ${formatMoney(cents(prop.price))}`);
  if (!deed.mortgaged) facts.push(`Mortgage value ${formatMoney(cents(prop.mortgage))}`);
  return facts;
}

function ActionButton({ children, onClick, disabled, testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function OwnedDeed({ state, prop, deed, busy, onAct }) {
  const facts = deedFacts(state, prop, deed);
  const street = prop.type === "street";
  const station = prop.type === "railroad";
  return (
    <article data-testid={`dashboard-deed-${prop.id}`} className="deed rounded-lg px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: GROUP_MAP[prop.group].color }} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">{propName(prop)}</h3>
          <ul className="mt-1 space-y-0.5 text-sm text-ink/70">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {street && !deed.mortgaged && deed.buildings < 6 && (
              <ActionButton testId={`build-${prop.id}`} disabled={busy} onClick={() => onAct("build", { propId: prop.id })}>
                Build · {formatMoney(cents(prop.houseCost))}
              </ActionButton>
            )}
            {street && deed.buildings > 0 && (
              <ActionButton testId={`sell-${prop.id}`} disabled={busy} onClick={() => onAct("sell", { propId: prop.id })}>
                Sell building
              </ActionButton>
            )}
            {station && !deed.mortgaged && !deed.depot && (
              <ActionButton disabled={busy} onClick={() => onAct("depot", { propId: prop.id })}>Depot · £100</ActionButton>
            )}
            {station && deed.depot && (
              <ActionButton disabled={busy} onClick={() => onAct("sellDepot", { propId: prop.id })}>Sell depot</ActionButton>
            )}
            {!deed.mortgaged && deed.buildings === 0 && !deed.depot && (
              <ActionButton testId={`mortgage-${prop.id}`} disabled={busy} onClick={() => onAct("mortgage", { propId: prop.id })}>
                Mortgage · {formatMoney(cents(prop.mortgage))}
              </ActionButton>
            )}
            {deed.mortgaged && (
              <ActionButton testId={`unmortgage-${prop.id}`} disabled={busy} onClick={() => onAct("unmortgage", { propId: prop.id })}>
                Unmortgage · {formatMoney(unmortgageCost(prop))}
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function NameChoices({ players, taken, currentId, onChoose }) {
  return (
    <div className="space-y-2">
      {players.map((player) => {
        const selected = player.id === currentId;
        const busy = taken.includes(player.id) && !selected;
        return (
          <button
            key={player.id}
            type="button"
            data-testid={`join-${player.name}`}
            aria-pressed={selected}
            onClick={() => onChoose(player.id)}
            className={`deed flex w-full items-center gap-3 rounded-lg px-4 py-4 text-left ${selected ? "ring-2 ring-ink" : ""}`}
          >
            <span className="h-4 w-4 rounded-full" style={{ background: player.color }} />
            <span className="text-base font-semibold text-ink">{player.name}</span>
            {selected && <span className="ml-auto text-sm text-ink/50">This phone</span>}
            {!selected && busy && <span className="ml-auto text-sm text-ink/50">On a phone</span>}
            {!selected && !busy && player.bankrupt && <span className="ml-auto text-sm text-ink/50">Out</span>}
          </button>
        );
      })}
    </div>
  );
}

function Picker({ players, taken, error, onChoose }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <h1 className="text-2xl font-semibold text-ink">Who are you?</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        Tap your own name. Every player can join from their phone at the same time.
      </p>
      {error && <p className="mt-4 text-sm text-rose-800">{error}</p>}
      <div className="mt-6">
        <NameChoices players={players} taken={taken} currentId="" onChoose={onChoose} />
      </div>
    </main>
  );
}

export default function PlayerDashboard() {
  const { state, role, live, followedId, taken, joinError, choosePlayer, clearPlayer, takeOverBanker, playerAct } = useGame();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const player = state?.players.find((item) => item.id === followedId) ?? null;
  const flash = useCashFlash(player?.cash ?? 0);
  const cashClass = flash === "up" ? "text-emerald-700" : flash === "down" ? "text-rose-700" : "text-ink";
  const sawGame = Boolean(state) || sessionStorage.getItem("monopoly-saw-game") === "1";
  if (state) sessionStorage.setItem("monopoly-saw-game", "1");

  if (role === "offline-player") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">Your dashboard</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          This phone cannot see the table yet. Open your link from the banker again.
        </p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">Your dashboard</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          {sawGame
            ? "The banker ended this game. Keep this page open and it will show the next one."
            : "Waiting for the banker to start. Keep this page open."}
        </p>
        {!sawGame && (
          <button type="button" onClick={takeOverBanker} className="mt-6 self-start rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink">
            Use this device as the banker
          </button>
        )}
      </main>
    );
  }

  if (!player) return <Picker players={state.players} taken={taken} error={joinError} onChoose={choosePlayer} />;

  const books = portfolio(state, player.id);
  const forSale = GROUPED.flatMap((group) => group.properties.filter((prop) => !state.deeds[prop.id].ownerId));
  const groups = GROUPED.map((group) => ({
    ...group,
    properties: group.properties.filter((prop) => state.deeds[prop.id].ownerId === player.id),
  })).filter((group) => group.properties.length);

  async function onAct(action, extra) {
    setBusy(true);
    setActionError("");
    const result = await playerAct(action, extra);
    setBusy(false);
    if (!result.ok) setActionError(result.error);
  }
  const latest = state.log?.[0]?.text;

  return (
    <main data-testid="dashboard" className="mx-auto min-h-dvh w-full max-w-lg px-4 pt-5 pb-16">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink/55">{live ? "Live from the banker" : "Reconnecting"}</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-ink">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: player.color }} />
            <span className="truncate">{player.name}</span>
          </h1>
        </div>
        <button type="button" onClick={clearPlayer} className="shrink-0 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink">
          Change
        </button>
      </header>
      <div className="mt-4">
        <NameChoices players={state.players} taken={taken} currentId={player.id} onChoose={choosePlayer} />
      </div>
      {joinError && <p className="mt-3 text-sm text-rose-800">{joinError}</p>}

      <p
        data-testid="dashboard-cash"
        data-cash={player.cash}
        className={`mt-6 text-5xl font-semibold tabular-nums ${player.bankrupt ? "text-ink/40" : cashClass}`}
      >
        {player.bankrupt ? "Out" : formatMoney(player.cash)}
      </p>
      <p className="mt-2 text-sm text-ink/60">
        {player.bankrupt ? "Your deeds have left your hands." : `Worth ${formatMoney(books.worth)}`}
      </p>
      {!player.bankrupt && (
        <p className="mt-1 text-sm text-ink/55">
          Deeds {formatMoney(books.deeds)}
          {books.buildings > 0 ? ` · Buildings ${formatMoney(books.buildings)}` : ""}
          {books.mortgages > 0 ? ` · Mortgages ${formatMoney(books.mortgages)}` : ""}
        </p>
      )}
      {(player.jailCards > 0 || player.busTickets > 0) && (
        <p className="mt-2 text-sm text-ink/70">
          {player.jailCards > 0 ? `Get out of jail free × ${player.jailCards}` : ""}
          {player.jailCards > 0 && player.busTickets > 0 ? " · " : ""}
          {player.busTickets > 0 ? `Bus tickets × ${player.busTickets}` : ""}
        </p>
      )}
      {player.id === state.activePlayerId && !player.bankrupt && (
        <p className="mt-3 text-sm font-medium text-ink">You are the active player at the table.</p>
      )}
      {latest && <p className="mt-3 text-sm leading-relaxed text-ink/70">{latest}</p>}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Your properties</h2>
        {groups.length === 0 && (
          <p className="mt-2 text-sm text-ink/60">You do not own any deeds yet.</p>
        )}
        <div className="mt-3 space-y-5">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-ink/50">{group.label}</h3>
                {group.properties.some((prop) => state.deeds[prop.id].buildings > 0) && (
                  <button type="button" disabled={busy || player.bankrupt} onClick={() => onAct("sellAll", { groupId: group.id })} className="text-xs font-medium text-ink/70 underline-offset-2 hover:underline disabled:opacity-40">
                    Sell all buildings
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {group.properties.map((prop) => (
                  <OwnedDeed
                    key={prop.id}
                    state={state}
                    prop={prop}
                    deed={state.deeds[prop.id]}
                    busy={busy || player.bankrupt}
                    onAct={onAct}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {actionError && <p className="mt-3 text-sm text-rose-800">{actionError}</p>}
        {forSale.length > 0 && !player.bankrupt && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Buy a deed from the bank</summary>
            <div className="mt-3 space-y-2">
              {forSale.map((prop) => (
                <div key={prop.id} className="deed flex items-center gap-3 rounded-lg px-3 py-2">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: GROUP_MAP[prop.group].color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{propName(prop)}</span>
                  <ActionButton testId={`buy-${prop.id}`} disabled={busy} onClick={() => onAct("buy", { propId: prop.id })}>
                    Buy · {formatMoney(cents(prop.price))}
                  </ActionButton>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
