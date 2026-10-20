import { GROUP_MAP, propName } from "../data/board.js";
import { cents, formatMoney } from "../game/money.js";

function Buildings({ count }) {
  if (count === 5) {
    return <span className="rounded-full bg-rose-700 px-2 py-1 text-[10px] font-bold tracking-wide text-white uppercase">Hotel</span>;
  }
  if (count > 0) {
    return (
      <span className="flex gap-1" aria-label={`${count} houses`}>
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="h-2.5 w-2.5 rounded-[3px] bg-emerald-700" />
        ))}
      </span>
    );
  }
  return null;
}

export default function DeedCard({ prop, deed, owner, edition, onClick, disabled }) {
  const group = GROUP_MAP[prop.group];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={`deed-${prop.id}`}
      className="deed flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left disabled:opacity-45"
    >
      <span className="h-11 w-1.5 shrink-0 rounded-full" style={{ background: group.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{propName(prop, edition)}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink/60">
          {owner ? (
            <>
              <span className="h-2 w-2 rounded-full" style={{ background: owner.color }} />
              {owner.name}
            </>
          ) : (
            <span>Bank · {formatMoney(cents(prop.price))}</span>
          )}
        </span>
      </span>
      <Buildings count={deed.buildings} />
      {deed.mortgaged && (
        <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold tracking-wide text-rose-800 uppercase">Mortgaged</span>
      )}
    </button>
  );
}
