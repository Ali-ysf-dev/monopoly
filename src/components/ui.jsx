import { useEffect, useId, useRef } from "react";
import { cents, formatMoney, formatTyping, pushMoneyKey } from "../game/money.js";

const BUTTON_TONES = {
  gold: "bg-gold text-ink",
  ink: "bg-ink text-ivory",
  danger: "bg-rose-800 text-white",
  ghost: "bg-ink/8 text-ink",
};

export function GoldButton({ children, onClick, disabled, tone = "gold", type = "button", testId }) {
  return (
    <button
      type={type}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-3.5 text-base leading-tight font-semibold transition disabled:opacity-40 ${BUTTON_TONES[tone]}`}
    >
      {children}
    </button>
  );
}

export function Sheet({ title, kicker, onClose, children, footer }) {
  const titleId = useId();
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-felt-deep/75" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="paper relative flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] shadow-2xl sm:rounded-[28px]"
      >
        <div className="px-5 pt-3 pb-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              {kicker && <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-deep uppercase">{kicker}</p>}
              <h2 id={titleId} className="font-display text-[1.7rem] leading-tight text-ink">{title}</h2>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink/8 text-lg text-ink">
              ×
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-ink/10 bg-ivory px-5 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function MoneyField({ label, value, onChange, presets = [50, 100, 200] }) {
  return (
    <div>
      {label && <p className="mb-2 text-sm font-medium text-ink/70">{label}</p>}
      <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
        <p className="font-display text-4xl text-ink tabular-nums">{formatTyping(value)}</p>
      </div>
      {presets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(String(preset))}
              className="min-h-11 rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm"
            >
              {formatMoney(cents(preset))}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(pushMoneyKey(value, key))}
            className="h-12 rounded-xl bg-white text-lg font-semibold text-ink shadow-sm"
          >
            {key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlayerChips({ players, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((player) => {
        const selected = value === player.id;
        return (
          <button
            key={player.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(player.id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${selected ? "bg-ink text-ivory" : "bg-white text-ink shadow-sm"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
            {player.name}
          </button>
        );
      })}
    </div>
  );
}

export function DicePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {Array.from({ length: 11 }, (_, index) => index + 2).map((roll) => (
        <button
          key={roll}
          type="button"
          onClick={() => onChange(roll)}
          className={`h-11 rounded-xl text-sm font-semibold ${value === roll ? "bg-ink text-ivory" : "bg-white text-ink shadow-sm"}`}
        >
          {roll}
        </button>
      ))}
    </div>
  );
}

export function Ledger({ entries, limit, onDark = true }) {
  const rows = limit ? entries.slice(0, limit) : entries;
  if (!rows.length) {
    return <p className={onDark ? "text-sm text-ivory/60" : "text-sm text-ink/60"}>Moves will show up here.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm leading-snug">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.tone === "in" ? "bg-emerald-500" : entry.tone === "out" ? "bg-rose-500" : "bg-gold"}`}
          />
          <span>
            <span className={onDark ? "text-ivory/45" : "text-ink/45"}>
              {new Date(entry.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" "}
            </span>
            <span className={onDark ? "text-ivory/90" : "text-ink/85"}>{entry.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/70">{label}</span>
      {children}
    </label>
  );
}

export const fieldClass = "w-full rounded-xl border border-ink/10 bg-white px-3 py-3 text-base text-ink outline-none";
