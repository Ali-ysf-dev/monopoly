import { useState } from "react";
import { GROUP_MAP, PROPERTIES, propName, propsInGroup } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import {
  buildBlockReason,
  buildHouse,
  buildRound,
  buyProperty,
  chargeRent,
  mortgageBlockReason,
  mortgageProperty,
  rentQuote,
  roundBuildQuote,
  roundSellQuote,
  sellAllBuildings,
  sellAllQuote,
  sellBlockReason,
  sellBuilding,
  sellRound,
  unmortgageCost,
  unmortgageProperty,
} from "../game/engine.js";
import { cents, formatMoney } from "../game/money.js";
import { DicePicker, GoldButton, PlayerChips, Sheet } from "./ui.jsx";

function streetRow(state, prop) {
  const deed = state.deeds[prop.id];
  if (!deed.ownerId || deed.mortgaged) return null;
  if (deed.buildings > 0) return deed.buildings;
  const group = propsInGroup(prop.group);
  const monopoly = group.every((item) => state.deeds[item.id].ownerId === deed.ownerId);
  const improved = group.some((item) => state.deeds[item.id].buildings > 0);
  return monopoly && !improved ? "double" : "base";
}

export default function PropertySheet({ propId, bonus = null, onClose, onTrade, onAuction }) {
  const { state, act, active, setActive } = useGame();
  const prop = PROPERTIES.find((item) => item.id === propId);
  const deed = state.deeds[propId];
  const solvent = state.players.filter((player) => !player.bankrupt);
  const owner = solvent.concat(state.players).find((player) => player.id === deed?.ownerId) ?? null;
  const [buyerId, setBuyerId] = useState(active?.id ?? solvent[0]?.id ?? null);
  const [payerId, setPayerId] = useState(() => {
    if (active && active.id !== deed?.ownerId) return active.id;
    return solvent.find((player) => player.id !== deed?.ownerId)?.id ?? null;
  });
  const [dice, setDice] = useState(null);
  const [doubleRail, setDoubleRail] = useState(bonus === "double-rail");
  const [tenUtil, setTenUtil] = useState(bonus === "ten-util");

  if (!prop || !deed) return null;

  const group = GROUP_MAP[prop.group];
  const name = propName(prop, state.edition);
  const quote = rentQuote(state, prop.id, {
    dice: dice || 0,
    doubleRail: prop.type === "railroad" && doubleRail,
    tenUtil: prop.type === "utility" && tenUtil,
  });
  const buyers = solvent;
  const payers = solvent.filter((player) => player.id !== deed.ownerId);
  const buyer = buyers.find((player) => player.id === buyerId) ?? buyers[0];
  const payer = payers.find((player) => player.id === payerId) ?? payers[0];
  const price = cents(prop.price);
  const lift = unmortgageCost(prop);
  const buildReason = buildBlockReason(state, prop.id);
  const sellReason = deed.buildings > 0 ? sellBlockReason(state, prop.id) : null;
  const mortgageReason = mortgageBlockReason(state, prop.id);
  const round = roundBuildQuote(state, prop.group);
  const selling = roundSellQuote(state, prop.group);
  const clear = sellAllQuote(state, prop.group);
  const activeRow = prop.type === "street" ? streetRow(state, prop) : null;
  const railCount = prop.type === "railroad" && deed.ownerId
    ? PROPERTIES.filter((item) => item.type === "railroad" && state.deeds[item.id].ownerId === deed.ownerId).length
    : 0;

  function run(exec, close) {
    const result = act(exec);
    if (result.ok && close) onClose();
  }

  let footer = null;
  if (!deed.ownerId && buyer) {
    const short = buyer.cash < price;
    footer = (
      <GoldButton testId="buy" disabled={short} onClick={() => run((draft) => buyProperty(draft, buyer.id, prop.id), true)}>
        {short ? `${buyer.name} is short ${formatMoney(price - buyer.cash)}` : `Buy for ${buyer.name} · ${formatMoney(price)}`}
      </GoldButton>
    );
  } else if (deed.mortgaged && owner) {
    const short = owner.cash < lift;
    footer = (
      <GoldButton disabled={short} onClick={() => run((draft) => unmortgageProperty(draft, prop.id), false)}>
        {short ? `${owner.name} is short ${formatMoney(lift - owner.cash)}` : `Lift mortgage · ${formatMoney(lift)}`}
      </GoldButton>
    );
  } else if (deed.ownerId && payer) {
    const waiting = prop.type === "utility" && !dice;
    const short = !quote.blocked && quote.amount > payer.cash;
    footer = (
      <GoldButton
        testId="charge-rent"
        disabled={waiting || quote.blocked || quote.amount <= 0 || short}
        onClick={() => run((draft) => chargeRent(draft, {
          propId: prop.id,
          payerId: payer.id,
          dice: dice || 0,
          doubleRail: prop.type === "railroad" && doubleRail,
          tenUtil: prop.type === "utility" && tenUtil,
        }), true)}
      >
        {waiting && "Choose the dice total"}
        {!waiting && short && `${payer.name} is short ${formatMoney(quote.amount - payer.cash)}`}
        {!waiting && !short && (quote.blocked ? quote.detail : `Charge ${formatMoney(quote.amount)} from ${payer.name}`)}
      </GoldButton>
    );
  }

  return (
    <Sheet title={name} kicker={group.label} onClose={onClose} footer={footer}>
      <div className="rounded-2xl px-4 py-4" style={{ background: group.color, color: group.ink }}>
        <p className="text-sm opacity-80">Printed price {formatMoney(price)} · Mortgage {formatMoney(cents(prop.mortgage))}</p>
        <p className="mt-1 font-display text-3xl leading-none">
          {deed.ownerId ? owner?.name ?? "Owned" : "Owned by the bank"}
        </p>
        {owner && <p className="mt-2 text-sm">Cash on hand {formatMoney(owner.cash)}</p>}
      </div>

      {prop.type === "street" && (
        <ul className="mt-4 overflow-hidden rounded-2xl bg-white/80">
          {[
            ["base", "Rent", prop.rent[0]],
            ["double", "Full color set", prop.rent[0] * 2],
            [1, "1 house", prop.rent[1]],
            [2, "2 houses", prop.rent[2]],
            [3, "3 houses", prop.rent[3]],
            [4, "4 houses", prop.rent[4]],
            [5, "Hotel", prop.rent[5]],
          ].map(([id, label, amount]) => (
            <li key={label} className={`flex items-center justify-between px-3 py-2 text-sm ${activeRow === id ? "bg-gold/40 font-semibold" : "text-ink/75"}`}>
              <span>{label}</span>
              <span className="tabular-nums">{formatMoney(cents(amount))}</span>
            </li>
          ))}
        </ul>
      )}

      {prop.type === "railroad" && (
        <ul className="mt-4 overflow-hidden rounded-2xl bg-white/80">
          {[1, 2, 3, 4].map((count) => (
            <li key={count} className={`flex items-center justify-between px-3 py-2 text-sm ${railCount === count && !deed.mortgaged ? "bg-gold/40 font-semibold" : "text-ink/75"}`}>
              <span>{count} railroad{count > 1 ? "s" : ""}</span>
              <span className="tabular-nums">{formatMoney(cents([0, 25, 50, 100, 200][count]))}</span>
            </li>
          ))}
        </ul>
      )}

      {prop.type === "utility" && (
        <p className="mt-4 rounded-2xl bg-white/80 px-3 py-3 text-sm text-ink/75">
          One utility is 4× the dice. Both utilities are 10×. A mortgaged utility still raises the rent on the other one.
        </p>
      )}

      {deed.mortgaged && (
        <p className="mt-4 rounded-2xl bg-rose-100 px-3 py-3 text-sm text-rose-900">
          This deed is mortgaged. It collects no rent until {owner?.name ?? "the owner"} pays {formatMoney(lift)}.
        </p>
      )}

      {!deed.ownerId && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-ink/70">Who is buying?</p>
          <PlayerChips players={buyers} value={buyer?.id} onChange={(id) => { setBuyerId(id); setActive(id); }} />
          <button type="button" onClick={onAuction} className="text-sm font-semibold text-gold-deep underline-offset-2 hover:underline">
            Nobody buys at the printed price. Auction it.
          </button>
        </div>
      )}

      {deed.ownerId && !deed.mortgaged && payers.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-ink/70">Who landed here?</p>
          <PlayerChips players={payers} value={payer?.id} onChange={(id) => { setPayerId(id); setActive(id); }} />
          {prop.type === "railroad" && (
            <label className="flex items-center gap-2 text-sm text-ink/80">
              <input type="checkbox" checked={doubleRail} onChange={(event) => setDoubleRail(event.target.checked)} />
              Chance card: charge double rent
            </label>
          )}
          {prop.type === "utility" && (
            <>
              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input type="checkbox" checked={tenUtil} onChange={(event) => setTenUtil(event.target.checked)} />
                Chance card: charge 10× the dice
              </label>
              <DicePicker value={dice} onChange={setDice} />
            </>
          )}
          <p className="text-sm text-ink/60">{quote.detail}</p>
        </div>
      )}

      {prop.type === "street" && deed.ownerId && (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-ink/70">Houses and hotels · {formatMoney(cents(prop.houseCost))} each</p>
          <p className="text-xs text-ink/55">The bank has {state.bank.houses} houses and {state.bank.hotels} hotels.</p>
          <div className="grid grid-cols-2 gap-2">
            <GoldButton tone="ghost" disabled={Boolean(buildReason)} onClick={() => run((draft) => buildHouse(draft, prop.id), false)}>
              {deed.buildings === 4 ? "Add hotel" : "Add house"}
            </GoldButton>
            <GoldButton tone="ghost" disabled={deed.buildings <= 0 || Boolean(sellReason)} onClick={() => run((draft) => sellBuilding(draft, prop.id), false)}>
              Sell one
            </GoldButton>
          </div>
          {(buildReason || sellReason) && <p className="text-sm text-ink/60">{buildReason || sellReason}</p>}
          {round && (
            <GoldButton tone="ink" disabled={Boolean(round.blocked)} onClick={() => run((draft) => buildRound(draft, prop.group), false)}>
              {round.blocked || `Build ${round.noun} · ${formatMoney(round.cost)}`}
            </GoldButton>
          )}
          {selling && (
            <GoldButton tone="ghost" disabled={Boolean(selling.blocked)} onClick={() => run((draft) => sellRound(draft, prop.group), false)}>
              {selling.blocked || `Sell ${selling.noun} · get ${formatMoney(selling.refund)}`}
            </GoldButton>
          )}
          {clear && (
            <GoldButton tone="ghost" onClick={() => run((draft) => sellAllBuildings(draft, prop.group), false)}>
              Sell every building on this color · get {formatMoney(clear.refund)}
            </GoldButton>
          )}
        </div>
      )}

      {deed.ownerId && !deed.mortgaged && (
        <div className="mt-5 space-y-2">
          <GoldButton tone="ghost" disabled={Boolean(mortgageReason)} onClick={() => run((draft) => mortgageProperty(draft, prop.id), false)}>
            {mortgageReason || `Mortgage for ${formatMoney(cents(prop.mortgage))}`}
          </GoldButton>
          <p className="text-xs text-ink/55">The bank does not buy deeds back. Mortgage this one, or trade it to a player.</p>
        </div>
      )}

      {deed.ownerId && (
        <button type="button" onClick={onTrade} className="mt-4 text-sm font-semibold text-gold-deep underline-offset-2 hover:underline">
          Trade {name}
        </button>
      )}
    </Sheet>
  );
}
