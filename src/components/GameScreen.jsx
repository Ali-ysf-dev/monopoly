import { useEffect, useRef, useState } from "react";
import { GROUPED } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import { collectPot, passGo, payBank, playJailCard, portfolio } from "../game/engine.js";
import { cents, formatMoney } from "../game/money.js";
import { AuctionSheet, CollectSheet, PaySheet, RentSheet, TransferSheet } from "./ActionSheets.jsx";
import CardsSheet from "./CardsSheet.jsx";
import DeedCard from "./DeedCard.jsx";
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
      className={`deed min-w-[11.25rem] flex-1 snap-start rounded-3xl p-3 ${selected ? "ring-2 ring-gold" : ""} ${player.bankrupt ? "opacity-60" : ""}`}
    >
      <button type="button" disabled={player.bankrupt} onClick={onSelect} className="block w-full text-left">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: player.color }} />
          <span className="truncate text-sm font-semibold text-ink">{player.name}</span>
        </span>
        <span data-cash={player.cash} className={`mt-2 block font-display text-3xl tabular-nums ${player.bankrupt ? "text-ink/50" : cashClass}`}>
          {player.bankrupt ? "Out" : formatMoney(player.cash)}
        </span>
        {!player.bankrupt && <span className="mt-1 block text-xs text-ink/55">Worth {formatMoney(worth)}</span>}
        {selected && !player.bankrupt && (
          <span className="mt-1 block text-[11px] font-bold tracking-[0.14em] text-gold-deep uppercase">Acting</span>
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
      className="deed min-h-20 rounded-2xl px-3 py-3 text-left disabled:opacity-40"
    >
      <span className="block text-[11px] font-semibold tracking-[0.14em] text-gold-deep uppercase">{title}</span>
      <span className="mt-1 block font-display text-xl leading-tight text-ink">{detail}</span>
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
    const monopoly = group.properties.every((prop) => state.deeds[prop.id].ownerId)
      && new Set(group.properties.map((prop) => state.deeds[prop.id].ownerId)).size === 1;
    const properties = group.properties.filter((prop) => {
      const deed = state.deeds[prop.id];
      if (filter === "bank" && deed.ownerId) return false;
      if (filter === "mortgaged" && !deed.mortgaged) return false;
      if (filter !== "all" && filter !== "bank" && filter !== "mortgaged" && deed.ownerId !== filter) return false;
      if (!text) return true;
      return `${prop.name} ${prop.nameUk}`.toLowerCase().includes(text);
    });
    return { ...group, properties, monopoly };
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
          <p className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">Physical board</p>
          <h1 className="font-display text-4xl leading-none text-ivory">Monopoly Banker</h1>
          <p className="mt-2 text-sm text-ivory/70">
            Houses {state.bank.houses} · Hotels {state.bank.hotels}
            {state.settings.freeParking ? ` · Free Parking ${formatMoney(state.freeParkingPot)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={undo} disabled={!state.history.length} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={() => setEndOpen(true)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
            End game
          </button>
        </div>
      </header>

      <p className="mt-5 text-sm text-ivory/60">Tap a player, then use an action. Ctrl+Z undoes the last move.</p>
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
        <p className="mt-4 rounded-2xl bg-gold px-4 py-3 font-semibold text-ink">
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
        ].map(([label, type]) => (
          <button
            key={type}
            type="button"
            disabled={!active && type !== "auction"}
            onClick={() => setSheet({ type })}
            className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-40"
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
          className="mt-3 w-full rounded-2xl bg-gold px-4 py-3 text-left font-semibold text-ink disabled:opacity-40"
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
            className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${filter === id ? "bg-gold text-ink" : "bg-white/10 text-ivory"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search deeds"
        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-ivory placeholder:text-ivory/40"
      />

      <div className="mt-5 space-y-5">
        {visible.map((group) => {
          const owner = group.monopoly
            ? state.players.find((player) => player.id === state.deeds[group.properties[0].id].ownerId)
            : null;
          return (
            <section key={group.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: group.color }} />
                <h2 className="text-sm font-semibold tracking-[0.12em] text-ivory/80 uppercase">{group.label}</h2>
                {owner && <span className="text-xs text-gold">{owner.name} owns the set</span>}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {group.properties.map((prop) => (
                  <DeedCard
                    key={prop.id}
                    prop={prop}
                    deed={state.deeds[prop.id]}
                    owner={state.players.find((player) => player.id === state.deeds[prop.id].ownerId)}
                    edition={state.edition}
                    onClick={() => openProperty(prop.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-ivory/60">No deeds match.</p>}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Ledger</h2>
          <button type="button" onClick={() => setSheet({ type: "log" })} className="text-sm font-semibold text-gold">
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
              {active.cash < cents(50) ? `Short ${formatMoney(cents(50) - active.cash)}` : "Pay the $50 fine"}
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
