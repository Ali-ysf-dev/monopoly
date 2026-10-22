import { useMemo, useState } from "react";
import { COLORS, TOKEN_NAMES } from "../data/board.js";
import { useGame } from "../context/GameContext.jsx";
import { PhoneLinks } from "./PlayerDashboard.jsx";
import { Field, fieldClass, GoldButton } from "./ui.jsx";

function makePlayer(index, cash) {
  return {
    id: crypto.randomUUID(),
    name: `Player ${index + 1}`,
    color: COLORS[index].hex,
    cash: String(cash),
  };
}

function wholeDollars(value, max) {
  if (!/^\d+$/.test(String(value))) return null;
  const amount = Number(value);
  if (amount > max) return null;
  return amount;
}

export default function SetupScreen() {
  const { start, watchAsPlayer } = useGame();
  const [players, setPlayers] = useState(() => [makePlayer(0, 2500), makePlayer(1, 2500)]);
  const [defaultCash, setDefaultCash] = useState("2500");
  const [goSalary, setGoSalary] = useState("200");
  const [freeParking, setFreeParking] = useState(false);
  const [error, setError] = useState("");

  const taken = useMemo(() => new Set(players.map((player) => player.color)), [players]);

  function setCount(next) {
    setPlayers((current) => {
      if (next === current.length) return current;
      if (next < current.length) return current.slice(0, next);
      const cash = wholeDollars(defaultCash, 1_000_000);
      const extra = Array.from({ length: next - current.length }, (_, index) => (
        makePlayer(current.length + index, cash ?? 2500)
      ));
      return [...current, ...extra];
    });
  }

  function update(id, patch) {
    setPlayers((current) => current.map((player) => (player.id === id ? { ...player, ...patch } : player)));
  }

  function applyCash() {
    if (wholeDollars(defaultCash, 1_000_000) == null) {
      setError("Starting cash has to be a whole number of pounds, up to £1,000,000.");
      return;
    }
    setError("");
    setPlayers((current) => current.map((player) => ({ ...player, cash: String(Number(defaultCash)) })));
  }

  function useTokens() {
    setPlayers((current) => current.map((player, index) => ({ ...player, name: TOKEN_NAMES[index] })));
  }

  function onSubmit(event) {
    event.preventDefault();
    const salary = wholeDollars(goSalary, 10000);
    if (salary == null) {
      setError("Go salary has to be a whole number of pounds, up to £10,000.");
      return;
    }
    const ready = [];
    for (const player of players) {
      const cash = wholeDollars(player.cash, 1_000_000);
      if (!player.name.trim()) {
        setError("Give every player a name.");
        return;
      }
      if (ready.some((item) => item.name.toLowerCase() === player.name.trim().toLowerCase())) {
        setError("Give each player a different name.");
        return;
      }
      if (cash == null) {
        setError(`Enter a whole number of pounds for ${player.name.trim() || "each player"}.`);
        return;
      }
      ready.push({ id: player.id, name: player.name.trim(), color: player.color, cash });
    }
    const result = start({ players: ready, goSalary: salary, freeParking });
    if (!result.ok) setError(result.error);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-ink">Monopoly Banker</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/70">
        UK Mega Edition. Each player usually starts with £2,500.
      </p>
      <PhoneLinks />
      <button type="button" onClick={watchAsPlayer} className="mt-3 self-start text-sm font-medium text-ink/70 underline-offset-2 hover:underline">
        This phone is a player, not the banker
      </button>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <section className="deed rounded-lg p-4 text-ink">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Players</h2>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Fewer players" onClick={() => setCount(Math.max(2, players.length - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-ink text-xl text-ivory">−</button>
              <span className="w-6 text-center text-lg font-semibold tabular-nums">{players.length}</span>
              <button type="button" aria-label="More players" onClick={() => setCount(Math.min(8, players.length + 1))} className="grid h-11 w-11 place-items-center rounded-full bg-ink text-xl text-ivory">+</button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Starting cash for everyone">
              <input className={fieldClass} inputMode="numeric" value={defaultCash} onChange={(event) => setDefaultCash(event.target.value.replace(/[^\d]/g, "").slice(0, 7))} />
            </Field>
            <button type="button" onClick={applyCash} className="self-end rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-ivory">
              Apply to all
            </button>
          </div>
          <button type="button" onClick={useTokens} className="mt-3 text-sm font-medium text-ink underline">
            Use the classic tokens as names
          </button>

          <div className="mt-4 space-y-3">
            {players.map((player, index) => (
              <div key={player.id} className="rounded-2xl bg-white/70 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <Field label={`Player ${index + 1} name`}>
                    <input
                      className={fieldClass}
                      maxLength={18}
                      value={player.name}
                      placeholder="Name"
                      data-testid={`player-name-${index}`}
                      onChange={(event) => update(player.id, { name: event.target.value })}
                    />
                  </Field>
                  <Field label="Cash">
                    <input
                      className={fieldClass}
                      inputMode="numeric"
                      value={player.cash}
                      data-testid={`player-cash-${index}`}
                      onChange={(event) => update(player.id, { cash: event.target.value.replace(/[^\d]/g, "").slice(0, 7) })}
                    />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Color for ${player.name}`}>
                  {COLORS.map((color) => {
                    const selected = player.color === color.hex;
                    const unavailable = taken.has(color.hex) && !selected;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        aria-label={color.name}
                        aria-pressed={selected}
                        disabled={unavailable}
                        onClick={() => update(player.id, { color: color.hex })}
                        className={`h-8 w-8 rounded-full disabled:opacity-25 ${selected ? "ring-2 ring-ink ring-offset-2" : ""}`}
                        style={{ background: color.hex }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="deed rounded-lg p-4 text-ink">
          <h2 className="text-base font-semibold">Table rules</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Go salary">
              <input className={fieldClass} inputMode="numeric" value={goSalary} onChange={(event) => setGoSalary(event.target.value.replace(/[^\d]/g, "").slice(0, 5))} />
            </Field>
            <p className="self-end pb-3 text-sm text-ink/60">The board is the UK Mega Edition: 30 streets, 4 stations, and 3 utilities.</p>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm leading-snug">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={freeParking} onChange={(event) => setFreeParking(event.target.checked)} />
            <span>Free Parking pot. Fees can be dropped on Free Parking, and a player can collect the pile.</span>
          </label>
        </section>

        {error && <p className="rounded-2xl bg-rose-900/80 px-4 py-3 text-sm text-white">{error}</p>}
        <GoldButton type="submit" testId="start-game">Start the game</GoldButton>
      </form>
    </main>
  );
}
