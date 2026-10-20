import assert from "node:assert/strict";
import { cents } from "./money.js";
import { gameReducer } from "./reducer.js";
import {
  bankrupt,
  buildDepot,
  buildHouse,
  buildRound,
  buyProperty,
  collectPot,
  createGame,
  incomeTaxTen,
  mortgageProperty,
  payBank,
  portfolio,
  rentQuote,
  sellAllBuildings,
  trade,
  unmortgageProperty,
} from "./engine.js";

function fresh(cash = 1500, extra = {}) {
  return createGame({
    players: [
      { id: "a", name: "Alex", color: "#d7263d", cash },
      { id: "b", name: "Sam", color: "#1d4ed8", cash },
      ...(extra.third ? [{ id: "c", name: "Jo", color: "#15803d", cash }] : []),
    ],
    goSalary: 200,
    freeParking: true,
    edition: "us",
  });
}

function cashOf(state, id) {
  return state.players.find((player) => player.id === id).cash;
}

const med = fresh();
buyProperty(med, "a", "old-kent");
buyProperty(med, "a", "whitechapel");
assert.equal(rentQuote(med, "whitechapel").amount, cents(8), "undeveloped monopoly doubles Baltic");
mortgageProperty(med, "old-kent");
assert.equal(rentQuote(med, "old-kent").amount, 0, "mortgaged deed collects nothing");
assert.equal(rentQuote(med, "whitechapel").amount, cents(8), "sister deed still doubles");

const houses = fresh(5000);
buyProperty(houses, "a", "old-kent");
buyProperty(houses, "a", "whitechapel");
buildHouse(houses, "old-kent");
assert.throws(() => buildHouse(houses, "old-kent"), /evenly/);
buildHouse(houses, "whitechapel");
assert.equal(rentQuote(houses, "whitechapel").amount, cents(20), "one house replaces the doubled rent");
assert.equal(houses.bank.houses, 30);
assert.throws(() => mortgageProperty(houses, "whitechapel"), /Sell all houses/);

const developed = fresh(5000);
buyProperty(developed, "a", "old-kent");
buyProperty(developed, "a", "whitechapel");
for (let round = 0; round < 4; round += 1) buildRound(developed, "brown");
assert.equal(developed.deeds["old-kent"].buildings, 4);
assert.equal(developed.bank.houses, 24);
buildRound(developed, "brown");
assert.equal(developed.deeds["old-kent"].buildings, 5);
assert.equal(developed.deeds.whitechapel.buildings, 5);
assert.equal(developed.bank.houses, 32);
assert.equal(developed.bank.hotels, 10);
assert.throws(() => buildRound(developed, "brown"), /skyscraper/);
sellAllBuildings(developed, "brown");
assert.equal(developed.bank.houses, 32);
assert.equal(developed.bank.hotels, 12);
assert.equal(developed.deeds["old-kent"].buildings, 0);
assert.equal(cashOf(developed, "a"), cents(5000 - 120 - 500 + 250));

const rails = fresh();
buyProperty(rails, "a", "kings-cross");
buyProperty(rails, "a", "marylebone");
buyProperty(rails, "a", "fenchurch");
mortgageProperty(rails, "kings-cross");
assert.equal(rentQuote(rails, "marylebone").amount, cents(100));
assert.equal(rentQuote(rails, "kings-cross").blocked, true);
const chance = rentQuote(rails, "marylebone", { doubleRail: true });
assert.equal(chance.amount, cents(200));
buildDepot(rails, "marylebone");
assert.equal(rentQuote(rails, "marylebone").amount, cents(200), "a depot doubles station rent");
assert.equal(rentQuote(rails, "marylebone", { doubleRail: true }).amount, cents(400), "Chance doubles the depot again");
assert.throws(() => mortgageProperty(rails, "marylebone"), /depot/);

const utils = fresh();
buyProperty(utils, "a", "electric");
buyProperty(utils, "a", "water");
mortgageProperty(utils, "electric");
assert.equal(rentQuote(utils, "water", { dice: 7 }).amount, cents(70));
assert.equal(rentQuote(utils, "water").needsDice, true);
const oneUtil = fresh();
buyProperty(oneUtil, "a", "electric");
assert.equal(rentQuote(oneUtil, "electric", { dice: 5, tenUtil: true }).amount, cents(50));
const allUtils = fresh();
buyProperty(allUtils, "a", "gas");
buyProperty(allUtils, "a", "electric");
buyProperty(allUtils, "a", "water");
assert.equal(rentQuote(allUtils, "gas", { dice: 5 }).amount, cents(100), "three utilities are 20×");
assert.equal(rentQuote(allUtils, "gas", { dice: 5, tenUtil: true }).amount, cents(50), "Chance stays at 10×");

const colour = fresh();
buyProperty(colour, "a", "old-kent");
buyProperty(colour, "a", "whitechapel");
buyProperty(colour, "a", "elephant");
assert.equal(rentQuote(colour, "whitechapel").amount, cents(12), "the whole colour triples rent");
mortgageProperty(colour, "elephant");
assert.equal(rentQuote(colour, "whitechapel").amount, cents(12), "a mortgaged sister still leaves triple rent");

const park = fresh(500);
buyProperty(park, "a", "mayfair");
mortgageProperty(park, "mayfair");
assert.equal(cashOf(park, "a"), cents(500 - 350 + 175));
unmortgageProperty(park, "mayfair");
assert.equal(cashOf(park, "a"), cents(325 - 192.5));
assert.equal(park.deeds["mayfair"].mortgaged, false);

const pot = fresh();
payBank(pot, "a", cents(100), "Luxury tax", { toPot: true });
assert.equal(pot.freeParkingPot, cents(100));
collectPot(pot, "b");
assert.equal(cashOf(pot, "b"), cents(1600));
assert.equal(pot.freeParkingPot, 0);

const bare = fresh();
buyProperty(bare, "a", "old-kent");
assert.throws(() => buildHouse(bare, "old-kent"), /colour/);

const tax = fresh();
buyProperty(tax, "a", "old-kent");
buyProperty(tax, "a", "whitechapel");
buildHouse(tax, "old-kent");
const worth = portfolio(tax, "a");
assert.equal(worth.taxable, cents(1500));
incomeTaxTen(tax, "a");
assert.equal(cashOf(tax, "a"), worth.cash - Math.round(worth.taxable / 10));

const deal = fresh();
buyProperty(deal, "a", "old-kent");
buyProperty(deal, "a", "whitechapel");
buildRound(deal, "brown");
assert.throws(() => trade(structuredClone(deal), {
  leftId: "a",
  rightId: "b",
  leftDeedIds: ["old-kent"],
  rightDeedIds: [],
  leftCash: 0,
  rightCash: cents(100),
  mortgagePlan: {},
}), /Sell the buildings/);
trade(deal, {
  leftId: "a",
  rightId: "b",
  leftDeedIds: ["old-kent", "whitechapel"],
  rightDeedIds: [],
  leftCash: 0,
  rightCash: cents(200),
  mortgagePlan: {},
});
assert.equal(deal.deeds["old-kent"].ownerId, "b");
assert.equal(deal.deeds["old-kent"].buildings, 1);
assert.equal(cashOf(deal, "a"), cents(1500 - 120 - 100 + 200));

const broke = fresh();
buyProperty(broke, "a", "kings-cross");
mortgageProperty(broke, "kings-cross");
const beforeCreditor = cashOf(broke, "b");
bankrupt(broke, "a", "b");
assert.equal(broke.players[0].bankrupt, true);
assert.equal(broke.deeds["kings-cross"].ownerId, "b");
assert.equal(broke.deeds["kings-cross"].mortgaged, true);
assert.equal(cashOf(broke, "a"), 0);
assert.equal(cashOf(broke, "b"), beforeCreditor + cents(1400) - cents(10));
assert.equal(broke.activePlayerId, "b");

let undone = fresh();
undone = gameReducer(undone, { type: "ACT", exec: (draft) => buyProperty(draft, "a", "knightsbridge") });
assert.equal(cashOf(undone, "a"), cents(1100));
undone = gameReducer(undone, { type: "UNDO" });
assert.equal(cashOf(undone, "a"), cents(1500));
assert.equal(undone.deeds.knightsbridge.ownerId, null);
assert.equal(undone.history.length, 0);

const poor = fresh(50);
const failed = gameReducer(poor, { type: "ACT", exec: (draft) => buyProperty(draft, "a", "knightsbridge") });
assert.equal(cashOf(failed, "a"), cents(50));
assert.equal(failed.deeds.knightsbridge.ownerId, null);
assert.equal(failed.toast.tone, "err");
assert.equal(failed.history.length, 0);

assert.throws(() => createGame({
  players: [{ id: "a", name: "Alex", color: "#d7263d", cash: 1500 }],
  goSalary: 200,
  edition: "us",
}), /2 to 8/);

console.log("engine tests passed");
