import { useState } from "react";
import { CARDS } from "../data/cards.js";
import { PROPERTIES, propName } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import {
  addNote,
  collect,
  collectEach,
  passGo,
  payBank,
  payEach,
  payRepairs,
  repairBill,
  takeJailCard,
} from "../game/engine.js";
import { cents, formatMoney } from "../game/money.js";
import { Sheet } from "./ui.jsx";

const RAILS = ["reading", "pennsylvania-rr", "bo", "short-line"];
const UTILS = ["electric", "water"];

export default function CardsSheet({ onClose, onOpenProperty }) {
  const { state, act, active } = useGame();
  const [toPot, setToPot] = useState(state.settings.freeParking);
  const [passed, setPassed] = useState({});
  if (!active) return null;
  const billFor = (card) => repairBill(state, active.id, card.house, card.hotel);

  function finish(result) {
    if (result.ok) onClose();
  }

  function play(card) {
    const pot = state.settings.freeParking && toPot;
    if (card.kind === "go") finish(act((draft) => passGo(draft, active.id)));
    if (card.kind === "collect") finish(act((draft) => collect(draft, active.id, cents(card.amount), card.title)));
    if (card.kind === "pay") finish(act((draft) => payBank(draft, active.id, cents(card.amount), card.title, { toPot: pot })));
    if (card.kind === "payEach") finish(act((draft) => payEach(draft, active.id, cents(card.amount), card.title)));
    if (card.kind === "collectEach") finish(act((draft) => collectEach(draft, active.id, cents(card.amount), card.title)));
    if (card.kind === "repairs") finish(act((draft) => payRepairs(draft, active.id, card.house, card.hotel, card.title, pot)));
    if (card.kind === "jailcard") finish(act((draft) => takeJailCard(draft, active.id)));
    if (card.kind === "note") finish(act((draft) => addNote(draft, active.id, card.note)));
  }

  function openMove(propId, cardId, bonus) {
    if (passed[cardId]) {
      const result = act((draft) => passGo(draft, active.id));
      if (!result.ok) return;
    }
    onOpenProperty(propId, bonus);
  }

  return (
    <Sheet title="Cards" kicker={`Playing as ${active.name}`} onClose={onClose}>
      <p className="text-sm text-ink/65">Classic card amounts. Use Pay or Collect if your deck prints a different figure.</p>
      {state.settings.freeParking && (
        <label className="mt-3 flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" checked={toPot} onChange={(event) => setToPot(event.target.checked)} />
          Bank payments go to Free Parking
        </label>
      )}
      <div className="mt-4 space-y-5">
        {CARDS.map((deck) => (
          <section key={deck.id}>
            <h3 className="font-display text-2xl text-ink">{deck.label}</h3>
            <div className="mt-2 space-y-2">
              {deck.cards.map((card) => {
                if (card.kind === "nearest-rail" || card.kind === "nearest-util") return null;
                const repairs = card.kind === "repairs" ? billFor(card) : null;
                const moveName = card.kind === "move" ? propName(PROPERTIES.find((prop) => prop.id === card.propId), state.edition) : "";
                return (
                  <div key={card.id} className="rounded-2xl bg-white px-3 py-3">
                    <p className="font-semibold text-ink">{card.kind === "move" ? `Advance to ${moveName}` : card.title}</p>
                    <p className="text-sm text-ink/60">
                      {repairs ? `${card.detail} · ${formatMoney(repairs.amount)}` : card.detail}
                    </p>
                    {card.kind === "move" && (
                      <label className="mt-2 flex items-center gap-2 text-sm text-ink/80">
                        <input
                          type="checkbox"
                          checked={Boolean(passed[card.id])}
                          onChange={(event) => setPassed((current) => ({ ...current, [card.id]: event.target.checked }))}
                        />
                        Also collect Go salary
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => (card.kind === "move" ? openMove(card.propId, card.id, null) : play(card))}
                      className="mt-2 min-h-10 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-ivory"
                    >
                      {card.kind === "move" ? `Open ${moveName}` : "Apply"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <section>
          <h3 className="font-display text-2xl text-ink">Nearest railroad</h3>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink/80">
            <input type="checkbox" checked={Boolean(passed.rail)} onChange={(event) => setPassed((current) => ({ ...current, rail: event.target.checked }))} />
            Also collect Go salary
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {RAILS.map((id) => (
              <button key={id} type="button" onClick={() => openMove(id, "rail", "double-rail")} className="rounded-xl bg-white px-3 py-3 text-left text-sm font-semibold text-ink">
                {propName(PROPERTIES.find((prop) => prop.id === id), state.edition)}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="font-display text-2xl text-ink">Nearest utility</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {UTILS.map((id) => (
              <button key={id} type="button" onClick={() => openMove(id, "util", "ten-util")} className="rounded-xl bg-white px-3 py-3 text-left text-sm font-semibold text-ink">
                {propName(PROPERTIES.find((prop) => prop.id === id), state.edition)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </Sheet>
  );
}
