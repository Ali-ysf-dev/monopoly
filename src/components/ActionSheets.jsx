import { useMemo, useState } from "react";
import { PROPERTIES, propName } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import {
  auctionProperty,
  chargeRent,
  collect,
  incomeTaxTen,
  payBank,
  payPlayer,
  portfolio,
  rentQuote,
} from "../game/engine.js";
import { cents, formatMoney, parseMoney } from "../game/money.js";
import DeedCard from "./DeedCard.jsx";
import { DicePicker, GoldButton, MoneyField, PlayerChips, Sheet } from "./ui.jsx";

function usePayer(players, activeId) {
  const solvent = players.filter((player) => !player.bankrupt);
  const [payerId, setPayerId] = useState(activeId ?? solvent[0]?.id ?? null);
  const payer = solvent.find((player) => player.id === payerId) ?? solvent[0];
  return { solvent, payer, setPayerId };
}

export function PaySheet({ onClose }) {
  const { state, act, active, setActive } = useGame();
  const { solvent, payer, setPayerId } = usePayer(state.players, active?.id);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [toPot, setToPot] = useState(state.settings.freeParking);
  const parsed = parseMoney(amount);
  const tax = payer ? Math.round(portfolio(state, payer.id).taxable / 10) : 0;

  function pay(centsAmount, label, pot = toPot) {
    if (!payer) return;
    const result = act((draft) => payBank(draft, payer.id, centsAmount, label || note, { toPot: pot && state.settings.freeParking }));
    if (result.ok) onClose();
  }

  return (
    <Sheet
      title="Pay the bank"
      kicker={payer ? payer.name : "Choose a player"}
      onClose={onClose}
      footer={(
        <GoldButton disabled={!payer || !parsed} onClick={() => pay(parsed, note)}>
          {parsed ? `Pay ${formatMoney(parsed)}` : "Enter an amount"}
        </GoldButton>
      )}
    >
      <PlayerChips players={solvent} value={payer?.id} onChange={(id) => { setPayerId(id); setActive(id); }} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink" onClick={() => { setAmount("100"); setNote("Bank deposit"); }}>Bank deposit £100</button>
        <button type="button" className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink" onClick={() => { setAmount("200"); setNote("Income tax"); }}>Income tax £200</button>
        <button
          type="button"
          disabled={!payer}
          className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40"
          onClick={() => {
            const result = act((draft) => incomeTaxTen(draft, payer.id, toPot && state.settings.freeParking));
            if (result.ok) onClose();
          }}
        >
          10% of worth · {formatMoney(tax)}
        </button>
      </div>
      <div className="mt-4">
        <MoneyField label="Amount" value={amount} onChange={setAmount} presets={[15, 50, 75, 100, 200]} />
      </div>
      <label className="mt-4 block text-sm text-ink/70">
        Note
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bank deposit, fine, fee" className="mt-1 w-full rounded-xl bg-white px-3 py-3 text-base text-ink" />
      </label>
      {state.settings.freeParking && (
        <label className="mt-3 flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" checked={toPot} onChange={(event) => setToPot(event.target.checked)} />
          Put it on Free Parking
        </label>
      )}
    </Sheet>
  );
}

export function CollectSheet({ onClose }) {
  const { state, act, active, setActive } = useGame();
  const { solvent, payer, setPayerId } = usePayer(state.players, active?.id);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const parsed = parseMoney(amount);

  return (
    <Sheet
      title="Collect from the bank"
      kicker={payer ? payer.name : "Choose a player"}
      onClose={onClose}
      footer={(
        <GoldButton
          disabled={!payer || !parsed}
          onClick={() => {
            const result = act((draft) => collect(draft, payer.id, parsed, note));
            if (result.ok) onClose();
          }}
        >
          {parsed ? `Collect ${formatMoney(parsed)}` : "Enter an amount"}
        </GoldButton>
      )}
    >
      <PlayerChips players={solvent} value={payer?.id} onChange={(id) => { setPayerId(id); setActive(id); }} />
      <div className="mt-4">
        <MoneyField label="Amount" value={amount} onChange={setAmount} presets={[50, 100, 150, 200]} />
      </div>
      <label className="mt-4 block text-sm text-ink/70">
        Note
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Dividend, refund, prize" className="mt-1 w-full rounded-xl bg-white px-3 py-3 text-base text-ink" />
      </label>
    </Sheet>
  );
}

export function TransferSheet({ onClose }) {
  const { state, act, active, setActive } = useGame();
  const { solvent, payer, setPayerId } = usePayer(state.players, active?.id);
  const others = solvent.filter((player) => player.id !== payer?.id);
  const [toId, setToId] = useState(others[0]?.id ?? null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const parsed = parseMoney(amount);
  const receiver = others.find((player) => player.id === toId) ?? others[0];

  return (
    <Sheet
      title="Pay a player"
      kicker="Cash only"
      onClose={onClose}
      footer={(
        <GoldButton
          disabled={!payer || !receiver || !parsed}
          onClick={() => {
            const result = act((draft) => payPlayer(draft, payer.id, receiver.id, parsed, note));
            if (result.ok) onClose();
          }}
        >
          {payer && receiver && parsed ? `${payer.name} pays ${receiver.name} ${formatMoney(parsed)}` : "Enter an amount"}
        </GoldButton>
      )}
    >
      <p className="mb-2 text-sm font-medium text-ink/70">From</p>
      <PlayerChips
        players={solvent}
        value={payer?.id}
        onChange={(id) => {
          setPayerId(id);
          setActive(id);
          if (id === toId) setToId(solvent.find((player) => player.id !== id)?.id ?? null);
        }}
      />
      <p className="mt-4 mb-2 text-sm font-medium text-ink/70">To</p>
      <PlayerChips players={others} value={receiver?.id} onChange={setToId} />
      <div className="mt-4">
        <MoneyField label="Amount" value={amount} onChange={setAmount} />
      </div>
      <label className="mt-4 block text-sm text-ink/70">
        Note
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Debt, rent, deal" className="mt-1 w-full rounded-xl bg-white px-3 py-3 text-base text-ink" />
      </label>
    </Sheet>
  );
}

export function RentSheet({ onClose }) {
  const { state, act, active, setActive } = useGame();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [payerId, setPayerId] = useState(active?.id ?? null);
  const [dice, setDice] = useState(null);
  const [doubleRail, setDoubleRail] = useState(false);
  const [tenUtil, setTenUtil] = useState(false);
  const solvent = state.players.filter((player) => !player.bankrupt);
  const selected = selectedId ? PROPERTIES.find((prop) => prop.id === selectedId) : null;
  const ownerId = selected ? state.deeds[selected.id].ownerId : null;
  const payers = solvent.filter((player) => player.id !== ownerId);
  const payer = payers.find((player) => player.id === payerId) ?? payers[0];
  const quote = selected
    ? rentQuote(state, selected.id, { dice: dice || 0, doubleRail, tenUtil })
    : null;
  const owned = useMemo(() => {
    const text = query.trim().toLowerCase();
    return PROPERTIES.filter((prop) => {
      const deed = state.deeds[prop.id];
      if (!deed.ownerId) return false;
      if (!text) return true;
      return prop.name.toLowerCase().includes(text);
    });
  }, [query, state.deeds]);

  return (
    <Sheet
      title={selected ? propName(selected) : "Charge rent"}
      kicker="Rent"
      onClose={onClose}
      footer={selected && payer ? (
        <GoldButton
          disabled={quote.blocked || quote.needsDice || quote.amount <= 0}
          onClick={() => {
            const result = act((draft) => chargeRent(draft, {
              propId: selected.id,
              payerId: payer.id,
              dice: dice || 0,
              doubleRail: selected.type === "railroad" && doubleRail,
              tenUtil: selected.type === "utility" && tenUtil,
            }));
            if (result.ok) onClose();
          }}
        >
          {quote.needsDice ? "Choose the dice total" : quote.blocked ? quote.detail : `Charge ${formatMoney(quote.amount)} from ${payer.name}`}
        </GoldButton>
      ) : null}
    >
      {!selected && (
        <>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search owned deeds"
            className="mb-3 w-full rounded-xl bg-white px-3 py-3 text-base text-ink"
          />
          <div className="space-y-2">
            {owned.map((prop) => (
              <DeedCard
                key={prop.id}
                prop={prop}
                deed={state.deeds[prop.id]}
                owner={state.players.find((player) => player.id === state.deeds[prop.id].ownerId)}
                disabled={state.deeds[prop.id].mortgaged}
                onClick={() => setSelectedId(prop.id)}
              />
            ))}
            {owned.length === 0 && <p className="text-sm text-ink/60">No owned deeds match.</p>}
          </div>
        </>
      )}
      {selected && (
        <div className="space-y-3">
          <button type="button" onClick={() => setSelectedId(null)} className="text-sm font-semibold text-gold-deep">Choose another deed</button>
          <p className="text-sm font-medium text-ink/70">Who landed here?</p>
          <PlayerChips players={payers} value={payer?.id} onChange={(id) => { setPayerId(id); setActive(id); }} />
          {selected.type === "railroad" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={doubleRail} onChange={(event) => setDoubleRail(event.target.checked)} />
              Chance card: charge double rent
            </label>
          )}
          {selected.type === "utility" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tenUtil} onChange={(event) => setTenUtil(event.target.checked)} />
                Chance card: charge 10× the dice
              </label>
              <DicePicker value={dice} onChange={setDice} />
            </>
          )}
          {quote && <p className="text-sm text-ink/60">{quote.detail}</p>}
        </div>
      )}
    </Sheet>
  );
}

export function AuctionSheet({ propId, onClose, onPick }) {
  const { state, act } = useGame();
  const prop = propId ? PROPERTIES.find((item) => item.id === propId) : null;
  const solvent = state.players.filter((player) => !player.bankrupt);
  const [bids, setBids] = useState({});

  if (!prop) {
    const unowned = PROPERTIES.filter((item) => !state.deeds[item.id].ownerId);
    return (
      <Sheet title="Auction a deed" kicker="Highest bid pays the bank" onClose={onClose}>
        <div className="space-y-2">
          {unowned.map((item) => (
            <DeedCard
              key={item.id}
              prop={item}
              deed={state.deeds[item.id]}
              owner={null}
              onClick={() => onPick(item.id)}
            />
          ))}
          {unowned.length === 0 && <p className="text-sm text-ink/60">Every deed has an owner.</p>}
        </div>
      </Sheet>
    );
  }

  const ranked = solvent
    .map((player) => ({ player, bid: Number(bids[player.id] || 0) }))
    .filter((item) => item.bid > 0)
    .sort((a, b) => b.bid - a.bid);
  const leader = ranked[0];
  const tied = Boolean(leader && ranked[1] && ranked[1].bid === leader.bid);
  const short = leader ? leader.player.cash < cents(leader.bid) : false;

  function bump(id, delta) {
    setBids((current) => ({ ...current, [id]: String(Math.max(0, Number(current[id] || 0) + delta)) }));
  }

  return (
    <Sheet
      title={propName(prop)}
      kicker={`Auction · printed price ${formatMoney(cents(prop.price))}`}
      onClose={onClose}
      footer={(
        <GoldButton
          disabled={!leader || tied || short}
          onClick={() => {
            const result = act((draft) => auctionProperty(draft, prop.id, leader.player.id, cents(leader.bid)));
            if (result.ok) onClose();
          }}
        >
          {!leader && "Waiting for a bid"}
          {leader && tied && "Break the tie"}
          {leader && !tied && short && `${leader.player.name} is short ${formatMoney(cents(leader.bid) - leader.player.cash)}`}
          {leader && !tied && !short && `Award to ${leader.player.name} · ${formatMoney(cents(leader.bid))}`}
        </GoldButton>
      )}
    >
      <div className="space-y-3">
        {solvent.map((player) => (
          <div key={player.id} className="rounded-2xl bg-white px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
                {player.name}
              </span>
              <span className="text-xs text-ink/50">Has {formatMoney(player.cash)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => bump(player.id, -10)} className="h-11 rounded-xl bg-ink/5 px-3 font-semibold text-ink">−10</button>
              <input
                inputMode="numeric"
                value={bids[player.id] || ""}
                placeholder="0"
                onChange={(event) => setBids((current) => ({ ...current, [player.id]: event.target.value.replace(/[^\d]/g, "").slice(0, 7) }))}
                className="h-11 w-full rounded-lg border border-ink/15 bg-white px-3 text-right text-xl font-semibold text-ink tabular-nums"
              />
              <button type="button" onClick={() => bump(player.id, 10)} className="h-11 rounded-xl bg-ink px-3 font-semibold text-ivory">+10</button>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
