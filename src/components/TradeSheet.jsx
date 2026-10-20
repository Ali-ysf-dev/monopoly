import { useMemo, useState } from "react";
import { PROPERTIES, PROP_MAP, propName } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import { mortgageInterest, trade, tradeError, unmortgageCost } from "../game/engine.js";
import { formatMoney, parseMoney } from "../game/money.js";
import { GoldButton, Sheet } from "./ui.jsx";

function Side({ player, deeds, cash, cards, onCash, onToggle, onCards, edition, state }) {
  const owned = PROPERTIES.filter((prop) => state.deeds[prop.id].ownerId === player.id);
  return (
    <section className="rounded-2xl bg-white/75 p-3">
      <h3 className="flex items-center gap-2 font-semibold text-ink">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
        {player.name} gives
      </h3>
      <label className="mt-3 block text-xs font-medium text-ink/60">
        Cash
        <input
          inputMode="decimal"
          value={cash}
          placeholder="0"
          onChange={(event) => onCash(event.target.value.replace(/[^\d.]/g, ""))}
          className="mt-1 w-full rounded-xl bg-ivory px-3 py-2 text-base text-ink"
        />
      </label>
      {player.jailCards > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span>Jail cards ({player.jailCards})</span>
          <span className="flex items-center gap-2">
            <button type="button" className="h-8 w-8 rounded-full bg-ink/10" onClick={() => onCards(Math.max(0, cards - 1))}>−</button>
            {cards}
            <button type="button" className="h-8 w-8 rounded-full bg-ink/10" onClick={() => onCards(Math.min(player.jailCards, cards + 1))}>+</button>
          </span>
        </div>
      )}
      <div className="mt-3 space-y-1.5">
        {owned.map((prop) => {
          const on = deeds.includes(prop.id);
          const deed = state.deeds[prop.id];
          return (
            <button
              key={prop.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(prop.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${on ? "bg-ink text-ivory" : "bg-ivory text-ink"}`}
            >
              <span>{propName(prop, edition)}</span>
              <span className="text-xs opacity-70">
                {deed.buildings === 5 ? "Hotel" : deed.buildings > 0 ? `${deed.buildings}h` : ""}
                {deed.mortgaged ? " M" : ""}
              </span>
            </button>
          );
        })}
        {owned.length === 0 && <p className="text-xs text-ink/50">No deeds</p>}
      </div>
    </section>
  );
}

export default function TradeSheet({ focusPropId, onClose }) {
  const { state, act, active } = useGame();
  const solvent = state.players.filter((player) => !player.bankrupt);
  const focusOwner = focusPropId ? state.deeds[focusPropId]?.ownerId : null;
  const [leftId, setLeftId] = useState(focusOwner || active?.id || solvent[0]?.id);
  const [rightId, setRightId] = useState(solvent.find((player) => player.id !== (focusOwner || active?.id))?.id ?? null);
  const [leftDeeds, setLeftDeeds] = useState(focusOwner ? [focusPropId] : []);
  const [rightDeeds, setRightDeeds] = useState([]);
  const [leftCash, setLeftCash] = useState("");
  const [rightCash, setRightCash] = useState("");
  const [leftCards, setLeftCards] = useState(0);
  const [rightCards, setRightCards] = useState(0);
  const [plan, setPlan] = useState({});

  const left = solvent.find((player) => player.id === leftId);
  const right = solvent.find((player) => player.id === rightId);
  const leftParsed = parseMoney(leftCash, { emptyIsZero: true });
  const rightParsed = parseMoney(rightCash, { emptyIsZero: true });
  const deal = useMemo(() => ({
    leftId,
    rightId,
    leftDeedIds: leftDeeds,
    rightDeedIds: rightDeeds,
    leftCash: leftParsed || 0,
    rightCash: rightParsed || 0,
    leftCards,
    rightCards,
    mortgagePlan: plan,
  }), [leftId, rightId, leftDeeds, rightDeeds, leftParsed, rightParsed, leftCards, rightCards, plan]);
  const problem = !left || !right
    ? "Pick two players"
    : leftParsed == null || rightParsed == null
      ? "Finish the cash amount"
      : tradeError(state, deal);

  const moving = [
    ...leftDeeds.map((id) => ({ id, to: right })),
    ...rightDeeds.map((id) => ({ id, to: left })),
  ].filter((item) => item.to && state.deeds[item.id]?.mortgaged);

  const singleId = leftDeeds.length + rightDeeds.length === 1 ? (leftDeeds[0] || rightDeeds[0]) : null;

  function choose(side, id) {
    if (side === "left") {
      setLeftId(id);
      setLeftDeeds(focusPropId && state.deeds[focusPropId].ownerId === id ? [focusPropId] : []);
      setLeftCards(0);
      if (id === rightId) {
        const replacement = solvent.find((player) => player.id !== id);
        setRightId(replacement?.id ?? null);
        setRightDeeds([]);
        setRightCards(0);
      }
      return;
    }
    setRightId(id);
    setRightDeeds([]);
    setRightCards(0);
    if (id === leftId) {
      const replacement = solvent.find((player) => player.id !== id);
      setLeftId(replacement?.id ?? null);
      setLeftDeeds([]);
      setLeftCards(0);
    }
  }

  function printedPrice() {
    if (!singleId) return;
    const price = String(PROP_MAP[singleId].price);
    if (leftDeeds.includes(singleId)) setRightCash(price);
    else setLeftCash(price);
  }

  return (
    <Sheet
      title="Trade"
      kicker="Deeds, cash, and jail cards"
      onClose={onClose}
      footer={(
        <div className="space-y-2">
          {problem && <p className="text-sm text-rose-800">{problem}</p>}
          <GoldButton
            disabled={Boolean(problem)}
            onClick={() => {
              const result = act((draft) => trade(draft, deal));
              if (result.ok) onClose();
            }}
          >
            Make the trade
          </GoldButton>
        </div>
      )}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-2 text-sm font-medium text-ink/70">First player</p>
          <div className="flex flex-wrap gap-2">
            {solvent.map((player) => (
              <button key={player.id} type="button" onClick={() => choose("left", player.id)} className={`rounded-full px-3 py-2 text-sm font-semibold ${player.id === leftId ? "bg-ink text-ivory" : "bg-white text-ink"}`}>
                {player.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink/70">Second player</p>
          <div className="flex flex-wrap gap-2">
            {solvent.filter((player) => player.id !== leftId).map((player) => (
              <button key={player.id} type="button" onClick={() => choose("right", player.id)} className={`rounded-full px-3 py-2 text-sm font-semibold ${player.id === rightId ? "bg-ink text-ivory" : "bg-white text-ink"}`}>
                {player.name}
              </button>
            ))}
          </div>
        </div>
        {singleId && (
          <button type="button" onClick={printedPrice} className="text-sm font-semibold text-gold-deep">
            Ask the printed price, {formatMoney(PROP_MAP[singleId].price * 100)}
          </button>
        )}
        {left && right && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Side
              player={left}
              deeds={leftDeeds}
              cash={leftCash}
              cards={leftCards}
              edition={state.edition}
              state={state}
              onCash={setLeftCash}
              onCards={setLeftCards}
              onToggle={(id) => setLeftDeeds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
            />
            <Side
              player={right}
              deeds={rightDeeds}
              cash={rightCash}
              cards={rightCards}
              edition={state.edition}
              state={state}
              onCash={setRightCash}
              onCards={setRightCards}
              onToggle={(id) => setRightDeeds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
            />
          </div>
        )}
        {moving.map((item) => {
          const prop = PROP_MAP[item.id];
          const choice = plan[item.id] === "unmortgage" ? "unmortgage" : "interest";
          return (
            <div key={item.id} className="rounded-2xl bg-rose-50 p-3 text-sm text-ink">
              <p className="font-semibold">{propName(prop, state.edition)} is mortgaged. {item.to.name} must settle it with the bank.</p>
              <div className="mt-2 grid gap-2">
                <button type="button" onClick={() => setPlan((current) => ({ ...current, [item.id]: "interest" }))} className={`rounded-xl px-3 py-2 text-left ${choice === "interest" ? "bg-ink text-ivory" : "bg-white"}`}>
                  Pay {formatMoney(mortgageInterest(prop))} interest and keep it mortgaged
                </button>
                <button type="button" onClick={() => setPlan((current) => ({ ...current, [item.id]: "unmortgage" }))} className={`rounded-xl px-3 py-2 text-left ${choice === "unmortgage" ? "bg-ink text-ivory" : "bg-white"}`}>
                  Unmortgage now for {formatMoney(unmortgageCost(prop))}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
