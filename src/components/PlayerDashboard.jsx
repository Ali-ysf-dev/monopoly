import { useEffect, useRef, useState } from "react";
import { GROUPED, GROUP_MAP, buildingLabel, propName } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
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
  const { links } = useGame();
  const [copied, setCopied] = useState(false);
  if (!links.length) return null;
  const link = links[0];

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
        Each player opens this link on their own phone, taps their name, and sees their cash and deeds update while you bank.
      </p>
      <p className="mt-2 break-all text-sm font-medium text-ink" data-testid="phone-link">{link}</p>
      {links.length > 1 && (
        <ul className="mt-2 space-y-1">
          {links.slice(1).map((extra) => (
            <li key={extra} className="break-all text-sm text-ink/70">{extra}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={copy} className="mt-3 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink">
        {copied ? "Copied" : "Copy link"}
      </button>
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

function OwnedDeed({ state, prop, deed }) {
  const facts = deedFacts(state, prop, deed);
  return (
    <article data-testid={`dashboard-deed-${prop.id}`} className="deed rounded-lg px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: GROUP_MAP[prop.group].color }} />
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{propName(prop)}</h3>
          <ul className="mt-1 space-y-0.5 text-sm text-ink/70">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function Picker({ players, onChoose }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <h1 className="text-2xl font-semibold text-ink">Who are you?</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        This phone shows only your cash and your deeds. Tap your name.
      </p>
      <div className="mt-6 space-y-2">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            data-testid={`join-${player.name}`}
            onClick={() => onChoose(player.id)}
            className="deed flex w-full items-center gap-3 rounded-lg px-4 py-4 text-left"
          >
            <span className="h-4 w-4 rounded-full" style={{ background: player.color }} />
            <span className="text-base font-semibold text-ink">{player.name}</span>
            {player.bankrupt && <span className="ml-auto text-sm text-ink/50">Out</span>}
          </button>
        ))}
      </div>
    </main>
  );
}

export default function PlayerDashboard() {
  const { state, role, live, followedId, choosePlayer, clearPlayer, takeOverBanker } = useGame();
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
          This phone cannot see the table yet. Join the same Wi-Fi as the banker and open the link on the banker screen.
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

  if (!player) return <Picker players={state.players} onChoose={choosePlayer} />;

  const books = portfolio(state, player.id);
  const groups = GROUPED.map((group) => ({
    ...group,
    properties: group.properties.filter((prop) => state.deeds[prop.id].ownerId === player.id),
  })).filter((group) => group.properties.length);
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
          Not you?
        </button>
      </header>

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
              <h3 className="text-xs font-medium text-ink/50">{group.label}</h3>
              <div className="mt-2 space-y-2">
                {group.properties.map((prop) => (
                  <OwnedDeed key={prop.id} state={state} prop={prop} deed={state.deeds[prop.id]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
