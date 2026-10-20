export function cents(dollars) {
  const amount = Number(dollars);
  if (!Number.isFinite(amount)) throw new Error("Enter a valid amount");
  return Math.round(amount * 100);
}

export function formatMoney(amount) {
  const value = Math.round(Number(amount) || 0);
  const negative = value < 0;
  const absolute = Math.abs(value);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  const body = remainder === 0
    ? dollars.toLocaleString("en-GB")
    : `${dollars.toLocaleString("en-GB")}.${String(remainder).padStart(2, "0")}`;
  return `${negative ? "-£" : "£"}${body}`;
}

export function formatTyping(value) {
  if (!value) return "£0";
  const [dollars, fraction] = String(value).split(".");
  const amount = Number(dollars || 0);
  if (!Number.isFinite(amount)) return "£0";
  const withCommas = amount.toLocaleString("en-GB");
  return fraction !== undefined ? `£${withCommas}.${fraction}` : `£${withCommas}`;
}

export function parseMoney(value, { emptyIsZero = false } = {}) {
  if (value == null || value === "") return emptyIsZero ? 0 : null;
  const text = String(value);
  if (!/^\d+(\.\d{0,2})?$/.test(text) || text.endsWith(".")) return null;
  const [dollars, fraction = ""] = text.split(".");
  const amount = Number(dollars) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(amount) || amount > 100_000_000) return null;
  return amount;
}

export function pushMoneyKey(value, key) {
  const current = value || "";
  if (key === "back") return current.slice(0, -1);
  if (key === ".") {
    if (current.includes(".")) return current;
    return `${current || "0"}.`;
  }
  if (!/^\d$/.test(key)) return current;
  if (current === "0") return key;
  const next = current + key;
  const fraction = next.split(".")[1];
  if (fraction && fraction.length > 2) return current;
  if (next.replace(".", "").length > 8) return current;
  return next;
}
