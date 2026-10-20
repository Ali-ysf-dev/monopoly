import { useEffect, useId, useRef } from "react";
import { cents, formatMoney, formatTyping, pushMoneyKey } from "../game/money.js";

const BUTTON_TONES = {
  gold: "bg-ink text-white",
  ink: "border border-ink/20 bg-white text-ink",
  danger: "bg-rose-800 text-white",
  ghost: "border border-ink/15 bg-white text-ink",
};

export function GoldButton({ children, onClick, disabled, tone = "gold", type = "button", testId }) {
  return (
    <button
      type={type}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-lg px-4 py-3 text-base leading-tight font-medium disabled:opacity-40 ${BUTTON_TONES[tone]}`}
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
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="paper relative flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-ink/10 sm:rounded-xl"
      >
        <div className="border-b border-ink/10 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              {kicker && <p className="text-sm text-ink/50">{kicker}</p>}
              <h2 id={titleId} className="text-xl font-semibold leading-tight text-ink">{title}</h2>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink/15 text-lg text-ink">
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
      <div className="rounded-lg border border-ink/10 bg-white px-4 py-3 text-center">
        <p className="text-3xl font-semibold text-ink tabular-nums">{formatTyping(value)}</p>
      </div>
      {presets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(String(preset))}
              className="min-h-10 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink"
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
            className="h-11 rounded-lg border border-ink/10 bg-white text-lg font-medium text-ink"
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
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${selected ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink"}`}
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
          className={`h-10 rounded-lg border text-sm font-medium ${value === roll ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink"}`}
        >
          {roll}
        </button>
      ))}
    </div>
  );
}

export function Ledger({ entries, limit, onDark = false }) {
  const rows = limit ? entries.slice(0, limit) : entries;
  if (!rows.length) {
    return <p className={onDark ? "text-sm text-ivory/60" : "text-sm text-ink/60"}>Moves will show up here.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm leading-snug">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.tone === "in" ? "bg-emerald-600" : entry.tone === "out" ? "bg-rose-600" : "bg-ink/40"}`}
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

export const fieldClass = "w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-base text-ink outline-none";
