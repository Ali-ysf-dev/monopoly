import { useState } from "react";
import { DEPOT_COST, GROUP_MAP, PROPERTIES, RAIL_RENT, propName } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import {
  buildBlockReason,
  buildDepot,
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
  sellDepot,
  sellRound,
  unmortgageCost,
  unmortgageProperty,
} from "../game/engine.js";
import { cents, formatMoney } from "../game/money.js";
import { DicePicker, GoldButton, PlayerChips, Sheet } from "./ui.jsx";

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
  const name = propName(prop);
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
  const activeRow = prop.type === "street" ? quote.tier : null;
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
      <div className="flex items-start gap-3 border-b border-ink/10 pb-3">
        <span className="mt-1 h-4 w-4 shrink-0 rounded-sm" style={{ background: group.color }} />
        <div>
          <p className="text-sm text-ink/60">Price {formatMoney(price)} · Mortgage {formatMoney(cents(prop.mortgage))}</p>
          <p className="text-lg font-semibold text-ink">
            {deed.ownerId ? owner?.name ?? "Owned" : "Owned by the bank"}
          </p>
          {owner && <p className="text-sm text-ink/60">Cash {formatMoney(owner.cash)}</p>}
        </div>
      </div>

      {prop.type === "street" && (
        <ul className="mt-4 overflow-hidden rounded-2xl bg-white/80">
          {[
            ["base", "Rent", prop.rent[0]],
            ["double", "Majority of the colour", prop.rent[0] * 2],
            ["triple", "Whole colour", prop.rent[0] * 3],
            [1, "1 house", prop.rent[1]],
            [2, "2 houses", prop.rent[2]],
            [3, "3 houses", prop.rent[3]],
            [4, "4 houses", prop.rent[4]],
            [5, "Hotel", prop.rent[5]],
            [6, "Skyscraper", prop.rent[6]],
          ].map(([id, label, amount]) => (
            <li key={label} className={`flex items-center justify-between px-3 py-2 text-sm ${activeRow === id ? "bg-ink/10 font-semibold" : "text-ink/75"}`}>
              <span>{label}</span>
              <span className="tabular-nums">{formatMoney(cents(amount))}</span>
            </li>
          ))}
        </ul>
      )}

      {prop.type === "railroad" && (
        <ul className="mt-4 overflow-hidden rounded-2xl bg-white/80">
          {[1, 2, 3, 4].map((count) => (
            <li key={count} className={`flex items-center justify-between px-3 py-2 text-sm ${railCount === count && !deed.mortgaged ? "bg-ink/10 font-semibold" : "text-ink/75"}`}>
              <span>{count} station{count > 1 ? "s" : ""}{deed.depot && railCount === count ? " · depot" : ""}</span>
              <span className="tabular-nums">{formatMoney(cents(RAIL_RENT[count] * (deed.depot && railCount === count ? 2 : 1)))}</span>
            </li>
          ))}
        </ul>
      )}

      {prop.type === "utility" && (
        <p className="mt-4 rounded-2xl bg-white/80 px-3 py-3 text-sm text-ink/75">
          One utility is 4× the white dice. Two are 10×. All three are 20×. The Chance card that sends you to a utility stays at 10×. A mortgaged utility still counts toward the others.
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
          <button type="button" onClick={onAuction} className="text-sm font-medium text-ink underline">
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
              Chance card: nearest station, charge double rent
            </label>
          )}
          {prop.type === "utility" && (
            <>
              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input type="checkbox" checked={tenUtil} onChange={(event) => setTenUtil(event.target.checked)} />
                Chance card: nearest utility, charge 10× the white dice
              </label>
              <DicePicker value={dice} onChange={setDice} />
            </>
          )}
          <p className="text-sm text-ink/60">{quote.detail}</p>
        </div>
      )}

      {prop.type === "street" && deed.ownerId && (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-ink/70">Houses, hotels, and skyscrapers · {formatMoney(cents(prop.houseCost))} each</p>
          <p className="text-xs text-ink/55">The bank has {state.bank.houses} houses, {state.bank.hotels} hotels, and {state.bank.skyscrapers} skyscrapers. You can build once you own all but one street. A skyscraper needs the whole colour, with a hotel on every street.</p>
          <div className="grid grid-cols-2 gap-2">
            <GoldButton tone="ghost" disabled={Boolean(buildReason)} onClick={() => run((draft) => buildHouse(draft, prop.id), false)}>
              {deed.buildings === 5 ? "Add skyscraper" : deed.buildings === 4 ? "Add hotel" : "Add house"}
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

      {prop.type === "railroad" && deed.ownerId && !deed.mortgaged && (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-ink/70">Train depot · {formatMoney(cents(DEPOT_COST))} · the bank has {state.bank.depots}</p>
          <p className="text-xs text-ink/55">A depot doubles this station only. You do not need the other stations. Sell it for half before mortgaging.</p>
          {deed.depot ? (
            <GoldButton tone="ghost" onClick={() => run((draft) => sellDepot(draft, prop.id), false)}>
              Sell the depot · get {formatMoney(cents(DEPOT_COST / 2))}
            </GoldButton>
          ) : (
            <GoldButton tone="ghost" disabled={state.bank.depots < 1 || owner.cash < cents(DEPOT_COST)} onClick={() => run((draft) => buildDepot(draft, prop.id), false)}>
              {state.bank.depots < 1 ? "No depots left" : owner.cash < cents(DEPOT_COST) ? `${owner.name} is short ${formatMoney(cents(DEPOT_COST) - owner.cash)}` : `Build a depot · ${formatMoney(cents(DEPOT_COST))}`}
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
        <button type="button" onClick={onTrade} className="mt-4 text-sm font-medium text-ink underline">
          Trade {name}
        </button>
      )}
    </Sheet>
  );
}
