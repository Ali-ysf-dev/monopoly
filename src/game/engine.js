import {
  BANK_HOTELS,
  BANK_HOUSES,
  GROUP_MAP,
  PROP_MAP,
  PROPERTIES,
  RAIL_RENT,
  propName,
  propsInGroup,
} from "../data/board.js";
import { cents, formatMoney } from "./money.js";

function mustPlayer(state, playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) throw new Error("Choose a player");
  if (player.bankrupt) throw new Error(`${player.name} is out of the game`);
  return player;
}

function moneyIn(amount) {
  if (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000) {
    throw new Error("Enter a valid amount");
  }
  return amount;
}

function assertBank(state) {
  if (state.bank.houses < 0 || state.bank.houses > BANK_HOUSES) {
    throw new Error("The house count does not add up");
  }
  if (state.bank.hotels < 0 || state.bank.hotels > BANK_HOTELS) {
    throw new Error("The hotel count does not add up");
  }
}

export function mortgageInterest(prop) {
  return Math.round(cents(prop.mortgage) / 10);
}

export function unmortgageCost(prop) {
  return cents(prop.mortgage) + mortgageInterest(prop);
}

export function portfolio(state, playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return { cash: 0, deeds: 0, buildings: 0, mortgages: 0, worth: 0, taxable: 0 };
  let deeds = 0;
  let buildings = 0;
  let mortgages = 0;
  for (const prop of PROPERTIES) {
    const deed = state.deeds[prop.id];
    if (deed.ownerId !== playerId) continue;
    deeds += cents(prop.price);
    if (prop.houseCost) buildings += cents(prop.houseCost) * deed.buildings;
    if (deed.mortgaged) mortgages += cents(prop.mortgage);
  }
  const taxable = player.cash + deeds + buildings;
  return {
    cash: player.cash,
    deeds,
    buildings,
    mortgages,
    worth: taxable - mortgages,
    taxable,
  };
}

export function repairBill(state, playerId, perHouse, perHotel) {
  let houses = 0;
  let hotels = 0;
  for (const prop of PROPERTIES) {
    if (prop.type !== "street") continue;
    const deed = state.deeds[prop.id];
    if (deed.ownerId !== playerId) continue;
    if (deed.buildings === 5) hotels += 1;
    else houses += deed.buildings;
  }
  return {
    houses,
    hotels,
    amount: cents(perHouse) * houses + cents(perHotel) * hotels,
  };
}

// A mortgaged railroad or utility still counts toward the rent level of the others.
// A mortgaged street collects nothing, but the rest of an undeveloped color set
// still collects double rent.
export function rentQuote(state, propId, { dice = 0, doubleRail = false, tenUtil = false } = {}) {
  const prop = PROP_MAP[propId];
  if (!prop) return { blocked: true, amount: 0, detail: "Unknown property", ownerId: null };
  const deed = state.deeds[propId];
  if (!deed.ownerId) return { blocked: true, amount: 0, detail: "The bank still owns this", ownerId: null };
  if (deed.mortgaged) {
    return { blocked: true, amount: 0, detail: "Mortgaged, so no rent is due", ownerId: deed.ownerId };
  }

  if (prop.type === "railroad") {
    const owned = PROPERTIES.filter((item) => item.type === "railroad" && state.deeds[item.id].ownerId === deed.ownerId).length;
    const amount = cents(RAIL_RENT[owned]) * (doubleRail ? 2 : 1);
    const detail = doubleRail
      ? `${owned} railroad${owned === 1 ? "" : "s"} · Chance doubles it`
      : `${owned} railroad${owned === 1 ? "" : "s"}`;
    return { amount, detail, ownerId: deed.ownerId };
  }

  if (prop.type === "utility") {
    const owned = PROPERTIES.filter((item) => item.type === "utility" && state.deeds[item.id].ownerId === deed.ownerId).length;
    const multiplier = tenUtil || owned >= 2 ? 10 : 4;
    if (!dice) {
      return { needsDice: true, amount: 0, multiplier, detail: `${multiplier}× the dice`, ownerId: deed.ownerId };
    }
    if (!Number.isInteger(dice) || dice < 2 || dice > 12) {
      return { blocked: true, amount: 0, detail: "Enter a dice total from 2 to 12", ownerId: deed.ownerId };
    }
    return {
      amount: cents(dice * multiplier),
      detail: `${multiplier}× a roll of ${dice}`,
      ownerId: deed.ownerId,
      multiplier,
    };
  }

  if (deed.buildings > 0) {
    return {
      amount: cents(prop.rent[deed.buildings]),
      detail: deed.buildings === 5 ? "Hotel" : `${deed.buildings} house${deed.buildings === 1 ? "" : "s"}`,
      ownerId: deed.ownerId,
    };
  }

  const group = propsInGroup(prop.group);
  const monopoly = group.every((item) => state.deeds[item.id].ownerId === deed.ownerId);
  const improved = group.some((item) => state.deeds[item.id].buildings > 0);
  if (monopoly && !improved) {
    return { amount: cents(prop.rent[0] * 2), detail: "Color set owned · rent doubled", ownerId: deed.ownerId };
  }
  return { amount: cents(prop.rent[0]), detail: "Base rent", ownerId: deed.ownerId };
}

function monopolyOwner(state, groupId) {
  const props = propsInGroup(groupId);
  const ownerId = state.deeds[props[0].id]?.ownerId;
  if (!ownerId || props.some((prop) => state.deeds[prop.id].ownerId !== ownerId)) return null;
  return ownerId;
}

export function buildBlockReason(state, propId) {
  const prop = PROP_MAP[propId];
  const deed = state.deeds[propId];
  if (!prop || prop.type !== "street") return "Only color sets can take houses";
  if (!deed.ownerId) return "Buy this deed before building";
  if (deed.buildings >= 5) return "A hotel is already here";
  const props = propsInGroup(prop.group);
  if (props.some((item) => state.deeds[item.id].ownerId !== deed.ownerId)) {
    return "Own the whole color set before building";
  }
  if (props.some((item) => state.deeds[item.id].mortgaged)) {
    return "Unmortgage the whole color set before building";
  }
  const lowest = Math.min(...props.map((item) => state.deeds[item.id].buildings));
  if (deed.buildings > lowest) return "Build evenly. The other deeds in this color are behind";
  if (deed.buildings === 4) {
    if (state.bank.hotels < 1) return "The bank has no hotels left";
  } else if (state.bank.houses < 1) {
    return "The bank has no houses left";
  }
  const owner = state.players.find((player) => player.id === deed.ownerId);
  const cost = cents(prop.houseCost);
  if (!owner || owner.cash < cost) {
    return `${owner?.name ?? "The owner"} is short ${formatMoney(cost - (owner?.cash ?? 0))}`;
  }
  return null;
}

export function sellBlockReason(state, propId) {
  const prop = PROP_MAP[propId];
  const deed = state.deeds[propId];
  if (!prop || prop.type !== "street") return "There are no buildings here";
  if (!deed.ownerId || deed.buildings <= 0) return "There are no buildings to sell";
  const props = propsInGroup(prop.group);
  const highest = Math.max(...props.map((item) => state.deeds[item.id].buildings));
  if (deed.buildings < highest) return "Sell evenly. Take buildings off the fuller deeds first";
  if (deed.buildings === 5 && state.bank.houses < 4) {
    return "The bank needs 4 houses to break this hotel. Sell every building on the color instead";
  }
  return null;
}

export function mortgageBlockReason(state, propId) {
  const prop = PROP_MAP[propId];
  const deed = state.deeds[propId];
  if (!prop) return "Unknown property";
  if (!deed.ownerId) return "The bank still owns this";
  if (deed.mortgaged) return "This deed is already mortgaged";
  if (prop.type === "street") {
    const improved = propsInGroup(prop.group).some((item) => state.deeds[item.id].buildings > 0);
    if (improved) return "Sell all houses and hotels on this color first";
  }
  return null;
}

export function roundBuildQuote(state, groupId) {
  const props = propsInGroup(groupId);
  if (props[0]?.type !== "street") return null;
  const ownerId = monopolyOwner(state, groupId);
  if (!ownerId) return null;
  if (props.some((prop) => state.deeds[prop.id].mortgaged)) {
    return { blocked: "Unmortgage this color before building" };
  }
  const lowest = Math.min(...props.map((prop) => state.deeds[prop.id].buildings));
  if (lowest >= 5) return { blocked: "Hotels are already built" };
  const targets = props.filter((prop) => state.deeds[prop.id].buildings === lowest);
  const cost = targets.length * cents(props[0].houseCost);
  const hotelsNeeded = targets.filter((prop) => state.deeds[prop.id].buildings === 4).length;
  const housesNeeded = targets.length - hotelsNeeded;
  const owner = state.players.find((player) => player.id === ownerId);
  let blocked = null;
  if (state.bank.hotels < hotelsNeeded) blocked = "Not enough hotels in the bank for a full round";
  else if (state.bank.houses < housesNeeded) blocked = "Not enough houses in the bank for a full round";
  else if (!owner || owner.cash < cost) blocked = `${owner?.name ?? "The owner"} is short ${formatMoney(cost - (owner?.cash ?? 0))}`;
  const noun = lowest === 4
    ? (targets.length === 1 ? "a hotel" : `${targets.length} hotels`)
    : (targets.length === 1 ? "1 house" : `${targets.length} houses`);
  return { targets, cost, blocked, noun, ownerId };
}

export function roundSellQuote(state, groupId) {
  const props = propsInGroup(groupId);
  if (props[0]?.type !== "street") return null;
  const ownerId = monopolyOwner(state, groupId);
  if (!ownerId) return null;
  const highest = Math.max(...props.map((prop) => state.deeds[prop.id].buildings));
  if (highest <= 0) return null;
  const targets = props.filter((prop) => state.deeds[prop.id].buildings === highest);
  const refund = targets.length * Math.round(cents(props[0].houseCost) / 2);
  const hotels = targets.filter((prop) => state.deeds[prop.id].buildings === 5).length;
  let blocked = null;
  if (state.bank.houses < hotels * 4) {
    blocked = "The bank does not have enough houses to replace those hotels";
  }
  const noun = highest === 5
    ? (targets.length === 1 ? "1 hotel" : `${targets.length} hotels`)
    : (targets.length === 1 ? "1 house" : `${targets.length} houses`);
  return { targets, refund, blocked, noun, ownerId, clearing: false };
}

function applyBuild(state, propId) {
  const reason = buildBlockReason(state, propId);
  if (reason) throw new Error(reason);
  const prop = PROP_MAP[propId];
  const deed = state.deeds[propId];
  const owner = mustPlayer(state, deed.ownerId);
  owner.cash -= cents(prop.houseCost);
  if (deed.buildings === 4) {
    state.bank.hotels -= 1;
    state.bank.houses += 4;
    deed.buildings = 5;
  } else {
    state.bank.houses -= 1;
    deed.buildings += 1;
  }
  assertBank(state);
}

function applySell(state, propId) {
  const reason = sellBlockReason(state, propId);
  if (reason) throw new Error(reason);
  const prop = PROP_MAP[propId];
  const deed = state.deeds[propId];
  const owner = mustPlayer(state, deed.ownerId);
  owner.cash += Math.round(cents(prop.houseCost) / 2);
  if (deed.buildings === 5) {
    state.bank.hotels += 1;
    state.bank.houses -= 4;
    deed.buildings = 4;
  } else {
    state.bank.houses += 1;
    deed.buildings -= 1;
  }
  assertBank(state);
}

export function passGo(state, playerId) {
  const player = mustPlayer(state, playerId);
  player.cash += state.settings.goSalary;
  return { tone: "in", text: `${player.name} passed Go and collected ${formatMoney(state.settings.goSalary)}.` };
}

export function payBank(state, playerId, amount, note, { toPot = false } = {}) {
  const payment = moneyIn(amount);
  if (payment <= 0) throw new Error("Enter an amount");
  if (toPot && !state.settings.freeParking) throw new Error("The Free Parking pot is turned off");
  const player = mustPlayer(state, playerId);
  if (player.cash < payment) throw new Error(`${player.name} is short ${formatMoney(payment - player.cash)}`);
  player.cash -= payment;
  const suffix = note ? ` · ${note}` : "";
  if (toPot) {
    state.freeParkingPot += payment;
    return { tone: "out", text: `${player.name} put ${formatMoney(payment)} on Free Parking${suffix}.` };
  }
  return { tone: "out", text: `${player.name} paid the bank ${formatMoney(payment)}${suffix}.` };
}

export function collect(state, playerId, amount, note) {
  const payment = moneyIn(amount);
  if (payment <= 0) throw new Error("Enter an amount");
  const player = mustPlayer(state, playerId);
  player.cash += payment;
  return { tone: "in", text: `${player.name} collected ${formatMoney(payment)} from the bank${note ? ` · ${note}` : ""}.` };
}

export function payPlayer(state, fromId, toId, amount, note) {
  const payment = moneyIn(amount);
  if (payment <= 0) throw new Error("Enter an amount");
  const from = mustPlayer(state, fromId);
  const to = mustPlayer(state, toId);
  if (from.id === to.id) throw new Error("Pick another player");
  if (from.cash < payment) throw new Error(`${from.name} is short ${formatMoney(payment - from.cash)}`);
  from.cash -= payment;
  to.cash += payment;
  return { tone: "move", text: `${from.name} paid ${to.name} ${formatMoney(payment)}${note ? ` · ${note}` : ""}.` };
}

export function payEach(state, fromId, amountEach, note) {
  const each = moneyIn(amountEach);
  if (each <= 0) throw new Error("Enter an amount");
  const from = mustPlayer(state, fromId);
  const others = state.players.filter((player) => !player.bankrupt && player.id !== from.id);
  if (!others.length) throw new Error("There is nobody else to pay");
  const total = each * others.length;
  if (from.cash < total) throw new Error(`${from.name} needs ${formatMoney(total)} and is short ${formatMoney(total - from.cash)}`);
  from.cash -= total;
  for (const player of others) player.cash += each;
  return { tone: "out", text: `${from.name} paid ${formatMoney(each)} to each player (${formatMoney(total)})${note ? ` · ${note}` : ""}.` };
}

export function collectEach(state, toId, amountEach, note) {
  const each = moneyIn(amountEach);
  if (each <= 0) throw new Error("Enter an amount");
  const to = mustPlayer(state, toId);
  const others = state.players.filter((player) => !player.bankrupt && player.id !== to.id);
  if (!others.length) throw new Error("There is nobody else to collect from");
  for (const player of others) {
    if (player.cash < each) throw new Error(`${player.name} cannot pay ${formatMoney(each)}. Settle ${player.name} first`);
  }
  for (const player of others) player.cash -= each;
  to.cash += each * others.length;
  return { tone: "in", text: `${to.name} collected ${formatMoney(each)} from each player${note ? ` · ${note}` : ""}.` };
}

export function collectPot(state, playerId) {
  if (!state.settings.freeParking) throw new Error("Free Parking is not collecting money in this game");
  if (state.freeParkingPot <= 0) throw new Error("Free Parking is empty");
  const player = mustPlayer(state, playerId);
  const amount = state.freeParkingPot;
  state.freeParkingPot = 0;
  player.cash += amount;
  return { tone: "in", text: `${player.name} collected ${formatMoney(amount)} from Free Parking.` };
}

export function incomeTaxTen(state, playerId, toPot = false) {
  const tax = Math.round(portfolio(state, playerId).taxable / 10);
  if (tax <= 0) throw new Error("Ten percent of worth is $0");
  return payBank(state, playerId, tax, "Income tax, 10% of worth", { toPot });
}

export function buyProperty(state, playerId, propId) {
  const prop = PROP_MAP[propId];
  if (!prop) throw new Error("Unknown property");
  const deed = state.deeds[propId];
  if (deed.ownerId) throw new Error(`${propName(prop, state.edition)} is already owned`);
  const player = mustPlayer(state, playerId);
  const price = cents(prop.price);
  if (player.cash < price) throw new Error(`${player.name} is short ${formatMoney(price - player.cash)}`);
  player.cash -= price;
  deed.ownerId = player.id;
  deed.buildings = 0;
  deed.mortgaged = false;
  return { tone: "out", text: `${player.name} bought ${propName(prop, state.edition)} for ${formatMoney(price)}.` };
}

export function auctionProperty(state, propId, winnerId, bid) {
  const prop = PROP_MAP[propId];
  if (!prop) throw new Error("Unknown property");
  const deed = state.deeds[propId];
  if (deed.ownerId) throw new Error(`${propName(prop, state.edition)} is already owned`);
  const payment = moneyIn(bid);
  if (payment < 100) throw new Error("Bid at least $1");
  const winner = mustPlayer(state, winnerId);
  if (winner.cash < payment) throw new Error(`${winner.name} is short ${formatMoney(payment - winner.cash)}`);
  winner.cash -= payment;
  deed.ownerId = winner.id;
  deed.buildings = 0;
  deed.mortgaged = false;
  return { tone: "out", text: `${winner.name} won the auction for ${propName(prop, state.edition)} at ${formatMoney(payment)}.` };
}

export function chargeRent(state, { propId, payerId, dice = 0, doubleRail = false, tenUtil = false }) {
  const quote = rentQuote(state, propId, { dice, doubleRail, tenUtil });
  if (quote.blocked) throw new Error(quote.detail);
  if (quote.needsDice) throw new Error("Enter the dice total first");
  if (quote.amount <= 0) throw new Error("There is no rent to collect");
  const payer = mustPlayer(state, payerId);
  const owner = mustPlayer(state, quote.ownerId);
  if (payer.id === owner.id) throw new Error("A player cannot pay rent to themselves");
  if (payer.cash < quote.amount) throw new Error(`${payer.name} is short ${formatMoney(quote.amount - payer.cash)}`);
  payer.cash -= quote.amount;
  owner.cash += quote.amount;
  const name = propName(PROP_MAP[propId], state.edition);
  return { tone: "move", text: `${payer.name} paid ${owner.name} ${formatMoney(quote.amount)} rent for ${name} · ${quote.detail}.` };
}

export function buildHouse(state, propId) {
  const before = state.deeds[propId].buildings;
  applyBuild(state, propId);
  const prop = PROP_MAP[propId];
  const owner = mustPlayer(state, state.deeds[propId].ownerId);
  const name = propName(prop, state.edition);
  const cost = formatMoney(cents(prop.houseCost));
  if (before === 4) {
    return { tone: "out", text: `${owner.name} built a hotel on ${name} for ${cost}. Four houses went back to the bank.` };
  }
  return { tone: "out", text: `${owner.name} built a house on ${name} for ${cost}.` };
}

export function sellBuilding(state, propId) {
  const before = state.deeds[propId].buildings;
  const prop = PROP_MAP[propId];
  applySell(state, propId);
  const owner = mustPlayer(state, state.deeds[propId].ownerId);
  const name = propName(prop, state.edition);
  const refund = formatMoney(Math.round(cents(prop.houseCost) / 2));
  if (before === 5) {
    return { tone: "in", text: `${owner.name} sold the hotel on ${name} for ${refund} and put 4 houses back.` };
  }
  return { tone: "in", text: `${owner.name} sold a house on ${name} for ${refund}.` };
}

export function buildRound(state, groupId) {
  const quote = roundBuildQuote(state, groupId);
  if (!quote) throw new Error("Own the whole color set before building");
  if (quote.blocked) throw new Error(quote.blocked);
  for (const prop of quote.targets) applyBuild(state, prop.id);
  const owner = mustPlayer(state, quote.ownerId);
  const names = quote.targets.map((prop) => propName(prop, state.edition)).join(", ");
  return { tone: "out", text: `${owner.name} built ${quote.noun} on ${names} for ${formatMoney(quote.cost)}.` };
}

export function sellRound(state, groupId) {
  const quote = roundSellQuote(state, groupId);
  if (!quote) throw new Error("There are no buildings to sell");
  if (quote.blocked) throw new Error(quote.blocked);
  for (const prop of quote.targets) applySell(state, prop.id);
  const owner = mustPlayer(state, quote.ownerId);
  const names = quote.targets.map((prop) => propName(prop, state.edition)).join(", ");
  return { tone: "in", text: `${owner.name} sold ${quote.noun} on ${names} for ${formatMoney(quote.refund)}.` };
}

export function sellAllQuote(state, groupId) {
  const props = propsInGroup(groupId);
  if (props[0]?.type !== "street") return null;
  const ownerId = monopolyOwner(state, groupId);
  if (!ownerId) return null;
  let refund = 0;
  for (const prop of props) {
    const buildings = state.deeds[prop.id].buildings;
    if (buildings > 0) refund += Math.round(cents(prop.houseCost) / 2) * buildings;
  }
  return refund > 0 ? { refund, ownerId } : null;
}

export function sellAllBuildings(state, groupId) {
  const props = propsInGroup(groupId);
  if (props[0]?.type !== "street") throw new Error("This set has no buildings");
  const ownerId = monopolyOwner(state, groupId);
  if (!ownerId) throw new Error("One player must own the whole color set");
  const owner = mustPlayer(state, ownerId);
  let refund = 0;
  let housesBack = 0;
  let hotelsBack = 0;
  for (const prop of props) {
    const deed = state.deeds[prop.id];
    if (deed.buildings <= 0) continue;
    refund += Math.round(cents(prop.houseCost) / 2) * deed.buildings;
    if (deed.buildings === 5) hotelsBack += 1;
    else housesBack += deed.buildings;
    deed.buildings = 0;
  }
  if (refund <= 0) throw new Error("There are no buildings to sell");
  state.bank.houses += housesBack;
  state.bank.hotels += hotelsBack;
  assertBank(state);
  owner.cash += refund;
  const label = GROUP_MAP[groupId]?.label ?? "this";
  return { tone: "in", text: `${owner.name} sold every building on the ${label} set for ${formatMoney(refund)}.` };
}

export function mortgageProperty(state, propId) {
  const reason = mortgageBlockReason(state, propId);
  if (reason) throw new Error(reason);
  const prop = PROP_MAP[propId];
  const deed = state.deeds[propId];
  const owner = mustPlayer(state, deed.ownerId);
  deed.mortgaged = true;
  owner.cash += cents(prop.mortgage);
  return { tone: "in", text: `${owner.name} mortgaged ${propName(prop, state.edition)} and collected ${formatMoney(cents(prop.mortgage))}.` };
}

export function unmortgageProperty(state, propId) {
  const prop = PROP_MAP[propId];
  const deed = state.deeds[propId];
  if (!prop || !deed?.ownerId) throw new Error("Nobody owns this deed");
  if (!deed.mortgaged) throw new Error("This deed is not mortgaged");
  const owner = mustPlayer(state, deed.ownerId);
  const cost = unmortgageCost(prop);
  if (owner.cash < cost) throw new Error(`${owner.name} is short ${formatMoney(cost - owner.cash)}`);
  owner.cash -= cost;
  deed.mortgaged = false;
  return { tone: "out", text: `${owner.name} paid ${formatMoney(cost)} and lifted the mortgage on ${propName(prop, state.edition)}.` };
}

function receiveCost(state, propId, plan) {
  const deed = state.deeds[propId];
  if (!deed.mortgaged) return 0;
  const prop = PROP_MAP[propId];
  return plan[propId] === "unmortgage" ? unmortgageCost(prop) : mortgageInterest(prop);
}

function buildingsStayLegal(state, nextOwner) {
  for (const prop of PROPERTIES) {
    if (prop.type !== "street" || state.deeds[prop.id].buildings <= 0) continue;
    const group = propsInGroup(prop.group);
    const owners = new Set(group.map((item) => nextOwner[item.id]));
    if (owners.size !== 1 || owners.has(null) || owners.has(undefined)) {
      throw new Error(`Sell the buildings on the ${GROUP_MAP[prop.group].label} set before splitting it`);
    }
  }
}

export function trade(state, deal) {
  const left = mustPlayer(state, deal.leftId);
  const right = mustPlayer(state, deal.rightId);
  if (left.id === right.id) throw new Error("Pick two different players");
  const leftDeedIds = [...new Set(deal.leftDeedIds || [])];
  const rightDeedIds = [...new Set(deal.rightDeedIds || [])];
  const leftCash = moneyIn(deal.leftCash || 0);
  const rightCash = moneyIn(deal.rightCash || 0);
  const leftCards = deal.leftCards || 0;
  const rightCards = deal.rightCards || 0;
  if (!Number.isInteger(leftCards) || leftCards < 0 || leftCards > left.jailCards) {
    throw new Error(`${left.name} does not have that many Get Out of Jail Free cards`);
  }
  if (!Number.isInteger(rightCards) || rightCards < 0 || rightCards > right.jailCards) {
    throw new Error(`${right.name} does not have that many Get Out of Jail Free cards`);
  }
  if (leftDeedIds.some((id) => rightDeedIds.includes(id))) throw new Error("A deed cannot be on both sides of the trade");
  for (const id of leftDeedIds) {
    if (!PROP_MAP[id] || state.deeds[id].ownerId !== left.id) {
      throw new Error(`${propName(PROP_MAP[id], state.edition) || "That deed"} is not owned by ${left.name}`);
    }
  }
  for (const id of rightDeedIds) {
    if (!PROP_MAP[id] || state.deeds[id].ownerId !== right.id) {
      throw new Error(`${propName(PROP_MAP[id], state.edition) || "That deed"} is not owned by ${right.name}`);
    }
  }
  if (!leftDeedIds.length && !rightDeedIds.length && !leftCash && !rightCash && !leftCards && !rightCards) {
    throw new Error("Add cash, a deed, or a jail card to the trade");
  }
  const plan = deal.mortgagePlan || {};
  let leftFee = 0;
  let rightFee = 0;
  for (const id of rightDeedIds) leftFee += receiveCost(state, id, plan);
  for (const id of leftDeedIds) rightFee += receiveCost(state, id, plan);
  if (left.cash < leftCash + leftFee) {
    throw new Error(`${left.name} is short ${formatMoney(leftCash + leftFee - left.cash)}`);
  }
  if (right.cash < rightCash + rightFee) {
    throw new Error(`${right.name} is short ${formatMoney(rightCash + rightFee - right.cash)}`);
  }
  const nextOwner = Object.fromEntries(PROPERTIES.map((prop) => [prop.id, state.deeds[prop.id].ownerId]));
  for (const id of leftDeedIds) nextOwner[id] = right.id;
  for (const id of rightDeedIds) nextOwner[id] = left.id;
  buildingsStayLegal(state, nextOwner);

  const notes = [];
  const describe = (id, receiver) => {
    if (!state.deeds[id].mortgaged) return;
    const prop = PROP_MAP[id];
    const name = propName(prop, state.edition);
    if (plan[id] === "unmortgage") notes.push(`${receiver.name} unmortgaged ${name}`);
    else notes.push(`${receiver.name} paid ${formatMoney(mortgageInterest(prop))} interest and kept ${name} mortgaged`);
  };
  for (const id of leftDeedIds) describe(id, right);
  for (const id of rightDeedIds) describe(id, left);

  left.cash = left.cash - leftCash - leftFee + rightCash;
  right.cash = right.cash - rightCash - rightFee + leftCash;
  left.jailCards = left.jailCards - leftCards + rightCards;
  right.jailCards = right.jailCards - rightCards + leftCards;
  for (const id of leftDeedIds) {
    state.deeds[id].ownerId = right.id;
    if (state.deeds[id].mortgaged && plan[id] === "unmortgage") state.deeds[id].mortgaged = false;
  }
  for (const id of rightDeedIds) {
    state.deeds[id].ownerId = left.id;
    if (state.deeds[id].mortgaged && plan[id] === "unmortgage") state.deeds[id].mortgaged = false;
  }

  const side = (name, deedIds, cash, cards) => {
    const parts = [];
    if (deedIds.length) parts.push(deedIds.map((id) => propName(PROP_MAP[id], state.edition)).join(", "));
    if (cash) parts.push(formatMoney(cash));
    if (cards) parts.push(cards === 1 ? "a Get Out of Jail Free card" : `${cards} Get Out of Jail Free cards`);
    return `${name} gave ${parts.length ? parts.join(" and ") : "nothing"}`;
  };
  const extra = notes.length ? ` ${notes.join(". ")}.` : "";
  return { tone: "move", text: `Trade. ${side(left.name, leftDeedIds, leftCash, leftCards)}. ${side(right.name, rightDeedIds, rightCash, rightCards)}.${extra}` };
}

export function tradeError(state, deal) {
  try {
    trade(structuredClone(state), deal);
    return null;
  } catch (error) {
    return error.message;
  }
}

function retarget(state, goneId) {
  if (state.activePlayerId !== goneId) return;
  const next = state.players.find((player) => !player.bankrupt);
  state.activePlayerId = next ? next.id : null;
}

export function bankrupt(state, playerId, creditorId) {
  const player = mustPlayer(state, playerId);
  if (creditorId === playerId) throw new Error("Pick the player who is owed, or the bank");
  const owned = PROPERTIES.filter((prop) => state.deeds[prop.id].ownerId === player.id);
  if (!creditorId) {
    let resale = 0;
    for (const prop of owned) {
      const deed = state.deeds[prop.id];
      if (prop.houseCost && deed.buildings > 0) {
        resale += Math.round(cents(prop.houseCost) / 2) * deed.buildings;
        if (deed.buildings === 5) state.bank.hotels += 1;
        else state.bank.houses += deed.buildings;
      }
      deed.ownerId = null;
      deed.buildings = 0;
      deed.mortgaged = false;
    }
    assertBank(state);
    const cash = player.cash;
    player.cash = 0;
    player.jailCards = 0;
    player.bankrupt = true;
    retarget(state, player.id);
    const buildingText = resale ? ` Buildings worth ${formatMoney(resale)} at resale were cleared.` : "";
    return { tone: "out", text: `${player.name} went bankrupt to the bank. ${formatMoney(cash)} in cash was taken.${buildingText} Auction the returned deeds.` };
  }

  const creditor = mustPlayer(state, creditorId);
  const interest = owned
    .filter((prop) => state.deeds[prop.id].mortgaged)
    .reduce((sum, prop) => sum + mortgageInterest(prop), 0);
  if (creditor.cash + player.cash < interest) {
    throw new Error(`${creditor.name} needs ${formatMoney(interest)} for mortgage interest and is short ${formatMoney(interest - creditor.cash - player.cash)}`);
  }
  creditor.cash = creditor.cash + player.cash - interest;
  creditor.jailCards += player.jailCards;
  for (const prop of owned) state.deeds[prop.id].ownerId = creditor.id;
  player.cash = 0;
  player.jailCards = 0;
  player.bankrupt = true;
  state.activePlayerId = creditor.id;
  const interestText = interest ? ` and paid the bank ${formatMoney(interest)} in mortgage interest` : "";
  return { tone: "out", text: `${player.name} went bankrupt. ${creditor.name} received the cash and deeds${interestText}.` };
}

export function correctCash(state, playerId, nextAmount) {
  const amount = moneyIn(nextAmount);
  const player = mustPlayer(state, playerId);
  if (player.cash === amount) throw new Error("That is already the cash on hand");
  const previous = player.cash;
  player.cash = amount;
  return { tone: "move", text: `Corrected ${player.name}'s cash from ${formatMoney(previous)} to ${formatMoney(amount)}.` };
}

export function takeJailCard(state, playerId) {
  const held = state.players.reduce((sum, player) => sum + player.jailCards, 0);
  if (held >= 2) throw new Error("Both Get Out of Jail Free cards are already held");
  const player = mustPlayer(state, playerId);
  player.jailCards += 1;
  return { tone: "move", text: `${player.name} kept a Get Out of Jail Free card.` };
}

export function playJailCard(state, playerId) {
  const player = mustPlayer(state, playerId);
  if (player.jailCards <= 0) throw new Error(`${player.name} does not have a Get Out of Jail Free card`);
  player.jailCards -= 1;
  return { tone: "move", text: `${player.name} used a Get Out of Jail Free card.` };
}

export function addNote(state, playerId, text) {
  const player = mustPlayer(state, playerId);
  return { tone: "move", text: `${player.name} ${text}.` };
}

export function payRepairs(state, playerId, perHouse, perHotel, note, toPot = false) {
  const bill = repairBill(state, playerId, perHouse, perHotel);
  const player = mustPlayer(state, playerId);
  if (bill.amount <= 0) {
    return { tone: "move", text: `${player.name} drew ${note}, but has no buildings.` };
  }
  const parts = [];
  if (bill.houses) parts.push(`${bill.houses} house${bill.houses === 1 ? "" : "s"}`);
  if (bill.hotels) parts.push(`${bill.hotels} hotel${bill.hotels === 1 ? "" : "s"}`);
  return payBank(state, playerId, bill.amount, `${note} (${parts.join(", ")})`, { toPot });
}

export function createGame({ players, goSalary = 200, freeParking = false, edition = "us" }) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 8) {
    throw new Error("Choose 2 to 8 players");
  }
  if (edition !== "us" && edition !== "uk") throw new Error("Choose a US or UK board");
  if (goSalary < 0 || goSalary > 10000) throw new Error("Go salary must be between $0 and $10,000");
  const colors = new Set();
  const ready = players.map((player) => {
    const name = String(player.name || "").trim();
    if (!name) throw new Error("Give every player a name");
    if (name.length > 18) throw new Error("Keep names to 18 characters");
    if (player.cash < 0 || player.cash > 1_000_000) throw new Error("Starting cash must be between $0 and $1,000,000");
    if (!player.color || colors.has(player.color)) throw new Error("Give each player a different color");
    colors.add(player.color);
    return {
      id: player.id || crypto.randomUUID(),
      name,
      color: player.color,
      cash: cents(player.cash),
      jailCards: 0,
      bankrupt: false,
    };
  });
  const sameCash = ready.every((player) => player.cash === ready[0].cash);
  const names = ready.map((player) => player.name).join(", ");
  const text = sameCash
    ? `Game started. ${names} each have ${formatMoney(ready[0].cash)}.`
    : `Game started for ${names}.`;
  return {
    version: 1,
    edition,
    startedAt: Date.now(),
    settings: { goSalary: cents(goSalary), freeParking: Boolean(freeParking) },
    freeParkingPot: 0,
    bank: { houses: BANK_HOUSES, hotels: BANK_HOTELS },
    players: ready,
    activePlayerId: ready[0].id,
    deeds: Object.fromEntries(PROPERTIES.map((prop) => [prop.id, { ownerId: null, buildings: 0, mortgaged: false }])),
    log: [{ id: crypto.randomUUID(), at: Date.now(), tone: "move", text }],
    history: [],
    toast: null,
  };
}
