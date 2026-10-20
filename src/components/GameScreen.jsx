import { useEffect, useRef, useState } from "react";
import { GROUPED } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import { collect, collectPot, expireBusTickets, passGo, payBank, playBusTicket, playJailCard, portfolio, takeBusTicket } from "../game/engine.js";
import { cents, formatMoney } from "../game/money.js";
import { AuctionSheet, CollectSheet, PaySheet, RentSheet, TransferSheet } from "./ActionSheets.jsx";
import CardsSheet from "./CardsSheet.jsx";
import DeedCard from "./DeedCard.jsx";
import { PhoneLinks } from "./PlayerDashboard.jsx";
import PlayerSheet from "./PlayerSheet.jsx";
import PropertySheet from "./PropertySheet.jsx";
import TradeSheet from "./TradeSheet.jsx";
import { GoldButton, Ledger, Sheet } from "./ui.jsx";

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

function PlayerCard({ player, worth, selected, onSelect, onManage }) {
  const flash = useCashFlash(player.cash);
  const cashClass = flash === "up" ? "text-emerald-700" : flash === "down" ? "text-rose-700" : "text-ink";
  return (
    <article
      data-testid={`player-${player.name}`}
      className={`deed min-w-[11.25rem] flex-1 snap-start rounded-lg p-3 ${selected ? "border-ink" : ""} ${player.bankrupt ? "opacity-60" : ""}`}
    >
      <button type="button" disabled={player.bankrupt} onClick={onSelect} className="block w-full text-left">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: player.color }} />
          <span className="truncate text-sm font-semibold text-ink">{player.name}</span>
        </span>
        <span data-cash={player.cash} className={`mt-1 block text-2xl font-semibold tabular-nums ${player.bankrupt ? "text-ink/50" : cashClass}`}>
          {player.bankrupt ? "Out" : formatMoney(player.cash)}
        </span>
        {!player.bankrupt && <span className="mt-1 block text-xs text-ink/55">Worth {formatMoney(worth)}</span>}
        {selected && !player.bankrupt && (
          <span className="mt-1 block text-xs font-medium text-ink/70">Acting</span>
        )}
      </button>
      {!player.bankrupt && (
        <button type="button" onClick={onManage} className="mt-2 text-xs font-semibold text-ink/70 underline-offset-2 hover:underline">
          Deeds and worth
        </button>
      )}
    </article>
  );
}

function ActionTile({ title, detail, onClick, disabled, testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="deed min-h-16 rounded-lg px-3 py-2.5 text-left disabled:opacity-40"
    >
      <span className="block text-xs text-ink/50">{title}</span>
      <span className="mt-0.5 block text-sm font-medium leading-tight text-ink">{detail}</span>
    </button>
  );
}

export default function GameScreen() {
  const { state, active, act, undo, end, setActive, dismiss } = useGame();
  const [sheet, setSheet] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [endOpen, setEndOpen] = useState(false);
  const alive = state.players.filter((player) => !player.bankrupt);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const visible = GROUPED.map((group) => {
    const text = query.trim().toLowerCase();
    const properties = group.properties.filter((prop) => {
      const deed = state.deeds[prop.id];
      if (filter === "bank" && deed.ownerId) return false;
      if (filter === "mortgaged" && !deed.mortgaged) return false;
      if (filter !== "all" && filter !== "bank" && filter !== "mortgaged" && deed.ownerId !== filter) return false;
      if (!text) return true;
      return prop.name.toLowerCase().includes(text);
    });
    return { ...group, properties };
  }).filter((group) => group.properties.length);

  function openProperty(id, bonus = null) {
    setSheet({ type: "property", id, bonus });
  }

  const filters = [
    ["all", "All"],
    ["bank", "Bank"],
    ["mortgaged", "Mortgaged"],
    ...state.players.filter((player) => !player.bankrupt).map((player) => [player.id, player.name]),
  ];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pt-5 pb-16 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Monopoly Banker</h1>
          <p className="mt-1 text-sm text-ink/60">
            Houses {state.bank.houses} · Hotels {state.bank.hotels} · Skyscrapers {state.bank.skyscrapers} · Depots {state.bank.depots} · Bus tickets {state.bank.busTickets}
            {state.settings.freeParking ? ` · Free Parking ${formatMoney(state.freeParkingPot)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={undo} disabled={!state.history.length} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={() => setEndOpen(true)} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink">
            End game
          </button>
        </div>
      </header>

      <PhoneLinks />
      <p className="mt-4 text-sm text-ink/55">Tap a player, then an action. Ctrl+Z undoes the last move.</p>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1 snap-x">
        {state.players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            worth={portfolio(state, player.id).worth}
            selected={player.id === state.activePlayerId}
            onSelect={() => setActive(player.id)}
            onManage={() => setSheet({ type: "player", id: player.id })}
          />
        ))}
      </div>

      {alive.length === 1 && (
        <p className="mt-4 rounded-lg border border-ink/15 bg-white px-4 py-3 font-medium text-ink">
          {alive[0].name} is the only player left.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ActionTile
          testId="pass-go"
          title={active ? active.name : "No player"}
          detail={`Pass Go ${formatMoney(state.settings.goSalary)}`}
          disabled={!active}
          onClick={() => act((draft) => passGo(draft, active.id))}
        />
        <ActionTile title="Rent" detail="Charge a deed" disabled={!active} onClick={() => setSheet({ type: "rent" })} />
        <ActionTile title="Pay" detail="Bank or fees" disabled={!active} onClick={() => setSheet({ type: "pay" })} />
        <ActionTile title="Collect" detail="Money from bank" disabled={!active} onClick={() => setSheet({ type: "collect" })} />
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {[
          ["Transfer", "transfer"],
          ["Trade", "trade"],
          ["Cards", "cards"],
          ["Auction", "auction"],
          ["Jail", "jail"],
          ["Bus", "bus"],
        ].map(([label, type]) => (
          <button
            key={type}
            type="button"
            disabled={!active && type !== "auction"}
            onClick={() => setSheet({ type })}
            className="shrink-0 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      {state.settings.freeParking && state.freeParkingPot > 0 && (
        <button
          type="button"
          disabled={!active}
          onClick={() => act((draft) => collectPot(draft, active.id))}
          className="mt-3 w-full rounded-lg border border-ink/15 bg-white px-4 py-3 text-left font-medium text-ink disabled:opacity-40"
        >
          Give Free Parking {formatMoney(state.freeParkingPot)} to {active?.name}
        </button>
      )}

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${filter === id ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search deeds"
        className="mt-3 w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink/40"
      />

      <div className="mt-5 space-y-5">
        {visible.map((group) => {
          const counts = new Map();
          for (const prop of group.properties) {
            const ownerId = state.deeds[prop.id].ownerId;
            if (ownerId) counts.set(ownerId, (counts.get(ownerId) || 0) + 1);
          }
          let holder = null;
          let complete = false;
          for (const [ownerId, count] of counts) {
            if (count === group.properties.length) {
              holder = state.players.find((player) => player.id === ownerId);
              complete = true;
            } else if (!complete && group.properties[0].type === "street" && count >= group.properties.length - 1) {
              holder = state.players.find((player) => player.id === ownerId);
            }
          }
          return (
            <section key={group.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: group.color }} />
                <h2 className="text-sm font-medium text-ink">{group.label}</h2>
                {holder && (
                  <span className="text-xs text-ink/55">
                    {holder.name} {complete ? "owns the set" : "can build"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {group.properties.map((prop) => (
                  <DeedCard
                    key={prop.id}
                    prop={prop}
                    deed={state.deeds[prop.id]}
                    owner={state.players.find((player) => player.id === state.deeds[prop.id].ownerId)}
                    onClick={() => openProperty(prop.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-ink/55">No deeds match.</p>}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Ledger</h2>
          <button type="button" onClick={() => setSheet({ type: "log" })} className="text-sm font-medium text-ink underline">
            View all
          </button>
        </div>
        <Ledger entries={state.log} limit={4} />
      </section>

      {state.toast && (
        <button
          type="button"
          data-testid="toast"
          onClick={dismiss}
          className={`fixed top-3 left-1/2 z-[80] w-[min(36rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl px-4 py-3 text-left text-sm shadow-xl ${state.toast.tone === "err" ? "bg-rose-800 text-white" : "bg-ink text-ivory"}`}
        >
          {state.toast.text}
        </button>
      )}

      {sheet?.type === "property" && (
        <PropertySheet
          key={`${sheet.id}-${sheet.bonus || "base"}`}
          propId={sheet.id}
          bonus={sheet.bonus}
          onClose={() => setSheet(null)}
          onAuction={() => setSheet({ type: "auction", propId: sheet.id })}
          onTrade={() => setSheet({ type: "trade", propId: sheet.id })}
        />
      )}
      {sheet?.type === "player" && (
        <PlayerSheet
          playerId={sheet.id}
          onClose={() => setSheet(null)}
          onOpenDeed={(id) => setSheet({ type: "property", id })}
        />
      )}
      {sheet?.type === "pay" && <PaySheet onClose={() => setSheet(null)} />}
      {sheet?.type === "collect" && <CollectSheet onClose={() => setSheet(null)} />}
      {sheet?.type === "transfer" && <TransferSheet onClose={() => setSheet(null)} />}
      {sheet?.type === "rent" && <RentSheet onClose={() => setSheet(null)} />}
      {sheet?.type === "auction" && (
        <AuctionSheet propId={sheet.propId} onClose={() => setSheet(null)} onPick={(id) => setSheet({ type: "auction", propId: id })} />
      )}
      {sheet?.type === "trade" && <TradeSheet focusPropId={sheet.propId} onClose={() => setSheet(null)} />}
      {sheet?.type === "cards" && <CardsSheet onClose={() => setSheet(null)} onOpenProperty={openProperty} />}
      {sheet?.type === "log" && (
        <Sheet title="Ledger" kicker="Newest first" onClose={() => setSheet(null)}>
          <Ledger entries={state.log} onDark={false} />
        </Sheet>
      )}
      {sheet?.type === "jail" && active && (
        <Sheet title="Jail" kicker={active.name} onClose={() => setSheet(null)}>
          <div className="space-y-3">
            {active.jailCards > 0 && (
              <GoldButton onClick={() => {
                const result = act((draft) => playJailCard(draft, active.id));
                if (result.ok) setSheet(null);
              }}
              >
                Use a Get Out of Jail Free card ({active.jailCards})
              </GoldButton>
            )}
            <GoldButton
              tone="ink"
              disabled={active.cash < cents(50)}
              onClick={() => {
                const result = act((draft) => payBank(draft, active.id, cents(50), "Jail fine"));
                if (result.ok) setSheet(null);
              }}
            >
              {active.cash < cents(50) ? `Short ${formatMoney(cents(50) - active.cash)}` : "Pay the £50 fine"}
            </GoldButton>
          </div>
        </Sheet>
      )}
      {sheet?.type === "bus" && active && (
        <Sheet title="Bus tickets" kicker={active.name} onClose={() => setSheet(null)}>
          <p className="text-sm leading-relaxed text-ink/75">
            {active.name} holds {active.busTickets || 0}. The deck has {state.bank.busTickets} left. A used or expired ticket leaves the game. Move the token on the physical board, then record the space you reached.
          </p>
          <div className="mt-4 space-y-3">
            <GoldButton
              disabled={state.bank.busTickets <= 0}
              onClick={() => act((draft) => takeBusTicket(draft, active.id))}
            >
              {state.bank.busTickets > 0 ? "Take a bus ticket" : "The deck is empty"}
            </GoldButton>
            <GoldButton
              tone="ink"
              disabled={(active.busTickets || 0) <= 0}
              onClick={() => {
                const result = act((draft) => playBusTicket(draft, active.id));
                if (result.ok) setSheet(null);
              }}
            >
              Use a bus ticket
            </GoldButton>
            <GoldButton tone="ghost" onClick={() => act((draft) => collect(draft, active.id, cents(100), "Birthday gift"))}>
              Birthday gift · collect £100
            </GoldButton>
            <GoldButton
              tone="danger"
              onClick={() => {
                const result = act((draft) => expireBusTickets(draft));
                if (result.ok) setSheet(null);
              }}
            >
              All tickets expire
            </GoldButton>
          </div>
        </Sheet>
      )}
      {endOpen && (
        <Sheet
          title="End this game?"
          kicker="The saved ledger will be cleared"
          onClose={() => setEndOpen(false)}
          footer={(
            <div className="grid grid-cols-2 gap-2">
              <GoldButton tone="ghost" onClick={() => setEndOpen(false)}>Keep playing</GoldButton>
              <GoldButton tone="danger" onClick={end}>End game</GoldButton>
            </div>
          )}
        >
          <p className="text-sm leading-relaxed text-ink/75">
            Undo cannot bring the game back after this. Starting cash and deeds will be set up again from scratch.
          </p>
        </Sheet>
      )}
    </main>
  );
}
