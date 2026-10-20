import { GROUP_MAP, propName } from "../data/board.js";
import { cents, formatMoney } from "../game/money.js";

function Buildings({ count }) {
  if (count === 6) {
    return <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white">Skyscraper</span>;
  }
  if (count === 5) {
    return <span className="rounded bg-rose-800 px-1.5 py-0.5 text-[10px] font-medium text-white">Hotel</span>;
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

export default function DeedCard({ prop, deed, owner, onClick, disabled }) {
  const group = GROUP_MAP[prop.group];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={`deed-${prop.id}`}
      className="deed flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left disabled:opacity-45"
    >
      <span className="h-11 w-1.5 shrink-0 rounded-full" style={{ background: group.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{propName(prop)}</span>
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
      {deed.depot && (
        <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-medium text-ink">Depot</span>
      )}
      {deed.mortgaged && (
        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">Mortgaged</span>
      )}
    </button>
  );
}
