import { useState } from "react";
import { GROUPED, buildingLabel, propName } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import { bankrupt, correctCash, playJailCard, portfolio } from "../game/engine.js";
import { formatMoney, parseMoney } from "../game/money.js";
import { GoldButton, MoneyField, Sheet } from "./ui.jsx";

export default function PlayerSheet({ playerId, onClose, onOpenDeed }) {
  const { state, act } = useGame();
  const player = state.players.find((item) => item.id === playerId);
  const [amount, setAmount] = useState("");
  const [creditor, setCreditor] = useState("bank");
  if (!player) return null;
  const books = portfolio(state, player.id);
  const others = state.players.filter((item) => !item.bankrupt && item.id !== player.id);
  const parsed = parseMoney(amount);

  return (
    <Sheet title={player.name} kicker={player.bankrupt ? "Out of the game" : "Player"} onClose={onClose}>
      <div className="flex items-end justify-between gap-3 border-b border-ink/10 pb-3">
        <div>
          <p className="text-sm text-ink/55">Cash</p>
          <p className="text-3xl font-semibold tabular-nums">{player.bankrupt ? "Out" : formatMoney(player.cash)}</p>
        </div>
        <p className="pb-1 text-sm text-ink/60">Worth {formatMoney(books.worth)}</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {[
          ["Deeds at printed price", books.deeds],
          ["Buildings at cost", books.buildings],
          ["Mortgage principal", books.mortgages],
          ["Worth for 10% tax", books.taxable],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white px-3 py-3">
            <dt className="text-ink/55">{label}</dt>
            <dd className="mt-1 font-semibold text-ink tabular-nums">{formatMoney(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-ink/55">
        Worth is cash, plus printed prices, plus what was paid for buildings, minus mortgage principal. The old income-tax option uses worth before subtracting mortgages.
      </p>

      {player.jailCards > 0 && !player.bankrupt && (
        <button
          type="button"
          onClick={() => act((draft) => playJailCard(draft, player.id))}
          className="mt-4 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-ivory"
        >
          Use a Get Out of Jail Free card ({player.jailCards})
        </button>
      )}

      <div className="mt-5 space-y-4">
        {GROUPED.map((group) => {
          const owned = group.properties.filter((prop) => state.deeds[prop.id].ownerId === player.id);
          if (!owned.length) return null;
          return (
            <section key={group.id}>
              <h3 className="text-sm font-medium text-ink/60">{group.label}</h3>
              <div className="mt-2 space-y-1.5">
                {owned.map((prop) => {
                  const deed = state.deeds[prop.id];
                  return (
                    <button key={prop.id} type="button" onClick={() => onOpenDeed(prop.id)} className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm text-ink">
                      <span>{propName(prop)}</span>
                      <span className="text-xs text-ink/50">
                        {buildingLabel(deed.buildings)}
                        {deed.depot ? " Depot" : ""}
                        {deed.mortgaged ? " Mortgaged" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {!player.bankrupt && (
        <details className="mt-5 rounded-2xl bg-white/70 p-3">
          <summary className="cursor-pointer font-semibold text-ink">Correct a cash mistake</summary>
          <div className="mt-3">
            <MoneyField label="Set cash to" value={amount} onChange={setAmount} presets={[]} />
            <div className="mt-3">
              <GoldButton
                disabled={parsed == null}
                onClick={() => {
                  const result = act((draft) => correctCash(draft, player.id, parsed));
                  if (result.ok) setAmount("");
                }}
              >
                Set cash
              </GoldButton>
            </div>
          </div>
        </details>
      )}

      {!player.bankrupt && (
        <details className="mt-3 rounded-2xl bg-rose-50 p-3">
          <summary className="cursor-pointer font-semibold text-rose-950">Bankruptcy</summary>
          <p className="mt-2 text-sm text-rose-950/80">
            Sell buildings and mortgage first if you still want that cash in the pot. This hands over whatever is left.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" aria-pressed={creditor === "bank"} onClick={() => setCreditor("bank")} className={`rounded-full px-3 py-2 text-sm font-semibold ${creditor === "bank" ? "bg-ink text-ivory" : "bg-white text-ink"}`}>
              Owes the bank
            </button>
            {others.map((item) => (
              <button key={item.id} type="button" aria-pressed={creditor === item.id} onClick={() => setCreditor(item.id)} className={`rounded-full px-3 py-2 text-sm font-semibold ${creditor === item.id ? "bg-ink text-ivory" : "bg-white text-ink"}`}>
                Owes {item.name}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <GoldButton
              tone="danger"
              onClick={() => {
                const result = act((draft) => bankrupt(draft, player.id, creditor === "bank" ? null : creditor));
                if (result.ok) onClose();
              }}
            >
              {creditor === "bank" ? "Transfer everything to the bank" : `Transfer everything to ${others.find((item) => item.id === creditor)?.name ?? "that player"}`}
            </GoldButton>
          </div>
        </details>
      )}
    </Sheet>
  );
}
