export const BANK_HOUSES = 32;
export const BANK_HOTELS = 12;
export const BANK_SKYSCRAPERS = 8;
export const BANK_DEPOTS = 4;
export const BANK_BUS_TICKETS = 16;
export const DEPOT_COST = 100;
export const RAIL_RENT = [0, 25, 50, 100, 200];

export const COLORS = [
  { id: "red", hex: "#d7263d", name: "Red" },
  { id: "blue", hex: "#1d4ed8", name: "Blue" },
  { id: "green", hex: "#15803d", name: "Green" },
  { id: "amber", hex: "#d97706", name: "Amber" },
  { id: "violet", hex: "#7c3aed", name: "Violet" },
  { id: "teal", hex: "#0f766e", name: "Teal" },
  { id: "pink", hex: "#db2777", name: "Pink" },
  { id: "ink", hex: "#292524", name: "Black" },
];

export const TOKEN_NAMES = [
  "Top Hat",
  "Race Car",
  "Scottie Dog",
  "Battleship",
  "Wheelbarrow",
  "Boot",
  "Thimble",
  "Cat",
];

export const GROUPS = [
  { id: "brown", label: "Brown", color: "#8b4c2f", ink: "#fff8ee" },
  { id: "lightblue", label: "Light Blue", color: "#b7e3f5", ink: "#10212b" },
  { id: "pink", label: "Pink", color: "#d946a0", ink: "#fff7fb" },
  { id: "orange", label: "Orange", color: "#f08a24", ink: "#1b1208" },
  { id: "red", label: "Red", color: "#e10600", ink: "#fff7f6" },
  { id: "yellow", label: "Yellow", color: "#ffe14a", ink: "#1b1604" },
  { id: "green", label: "Green", color: "#1f9d55", ink: "#f3fff7" },
  { id: "blue", label: "Dark Blue", color: "#1463b3", ink: "#f4f8ff" },
  { id: "railroad", label: "Stations", color: "#4b4642", ink: "#fff8ee" },
  { id: "utility", label: "Utilities", color: "#d5dbe3", ink: "#17202b" },
];

function street(id, name, group, price, houseCost, rent) {
  return {
    id,
    name,
    group,
    type: "street",
    price,
    mortgage: price / 2,
    houseCost,
    rent,
  };
}

function rail(id, name) {
  return { id, name, group: "railroad", type: "railroad", price: 200, mortgage: 100 };
}

function utility(id, name) {
  return { id, name, group: "utility", type: "utility", price: 150, mortgage: 75 };
}

// UK Monopoly Mega. Rents are [site, 1 house, 2, 3, 4, hotel, skyscraper].
// A skyscraper is the hotel rent plus £500 on the first two sides, and plus £1,000
// on the red, yellow, green, and dark blue sides. Prices follow the UK Mega board:
// Elephant & Castle is £60, Bond Street is £300, Mayfair is £350, and Knightsbridge is £400.
export const PROPERTIES = [
  street("old-kent", "Old Kent Road", "brown", 60, 50, [2, 10, 30, 90, 160, 250, 750]),
  street("whitechapel", "Whitechapel Road", "brown", 60, 50, [4, 20, 60, 180, 320, 450, 950]),
  street("elephant", "Elephant & Castle", "brown", 60, 50, [4, 20, 60, 180, 320, 450, 950]),
  street("angel", "The Angel, Islington", "lightblue", 100, 50, [6, 30, 90, 270, 400, 550, 1050]),
  street("euston", "Euston Road", "lightblue", 100, 50, [6, 30, 90, 270, 400, 550, 1050]),
  street("pentonville", "Pentonville Road", "lightblue", 120, 50, [8, 40, 100, 300, 450, 600, 1100]),
  street("edgware", "Edgware Road", "lightblue", 120, 50, [8, 40, 100, 300, 450, 600, 1100]),
  street("pall-mall", "Pall Mall", "pink", 140, 100, [10, 50, 150, 450, 625, 750, 1250]),
  street("whitehall", "Whitehall", "pink", 140, 100, [10, 50, 150, 450, 625, 750, 1250]),
  street("northumberland", "Northumberland Avenue", "pink", 160, 100, [12, 60, 180, 500, 700, 900, 1400]),
  street("downing", "Downing Street", "pink", 160, 100, [12, 60, 180, 500, 700, 900, 1400]),
  street("bow", "Bow Street", "orange", 180, 100, [14, 70, 200, 550, 750, 950, 1450]),
  street("marlborough", "Marlborough Street", "orange", 180, 100, [14, 70, 200, 550, 750, 950, 1450]),
  street("vine", "Vine Street", "orange", 200, 100, [16, 80, 220, 600, 800, 1000, 1500]),
  street("holborn", "High Holborn", "orange", 200, 100, [16, 80, 220, 600, 800, 1000, 1500]),
  street("strand", "Strand", "red", 220, 150, [18, 90, 250, 700, 875, 1050, 2050]),
  street("fleet", "Fleet Street", "red", 220, 150, [18, 90, 250, 700, 875, 1050, 2050]),
  street("trafalgar", "Trafalgar Square", "red", 240, 150, [20, 100, 300, 750, 925, 1100, 2100]),
  street("aldwych", "Aldwych", "red", 240, 150, [20, 100, 300, 750, 925, 1100, 2100]),
  street("leicester", "Leicester Square", "yellow", 260, 150, [22, 110, 330, 800, 975, 1150, 2150]),
  street("coventry", "Coventry Street", "yellow", 260, 150, [22, 110, 330, 800, 975, 1150, 2150]),
  street("piccadilly", "Piccadilly", "yellow", 280, 150, [24, 120, 360, 850, 1025, 1200, 2200]),
  street("shaftesbury", "Shaftesbury Avenue", "yellow", 280, 150, [24, 120, 360, 850, 1025, 1200, 2200]),
  street("regent", "Regent Street", "green", 300, 200, [26, 130, 390, 900, 1100, 1275, 2275]),
  street("oxford", "Oxford Street", "green", 300, 200, [26, 130, 390, 900, 1100, 1275, 2275]),
  street("bond", "Bond Street", "green", 300, 200, [26, 130, 390, 900, 1100, 1275, 2275]),
  street("savile", "Savile Row", "green", 320, 200, [28, 150, 450, 1000, 1200, 1400, 2400]),
  street("park-lane", "Park Lane", "blue", 350, 200, [35, 175, 500, 1100, 1300, 1500, 2500]),
  street("mayfair", "Mayfair", "blue", 350, 200, [35, 175, 500, 1100, 1300, 1500, 2500]),
  street("knightsbridge", "Knightsbridge", "blue", 400, 200, [50, 200, 600, 1400, 1700, 2000, 3000]),
  rail("kings-cross", "King's Cross Station"),
  rail("marylebone", "Marylebone Station"),
  rail("fenchurch", "Fenchurch Street Station"),
  rail("liverpool", "Liverpool Street Station"),
  utility("gas", "Gas Company"),
  utility("electric", "Electric Company"),
  utility("water", "Water Works"),
];

export const PROP_MAP = Object.fromEntries(PROPERTIES.map((prop) => [prop.id, prop]));
export const GROUP_MAP = Object.fromEntries(GROUPS.map((group) => [group.id, group]));

export const GROUPED = GROUPS.map((group) => ({
  ...group,
  properties: PROPERTIES.filter((prop) => prop.group === group.id),
}));

export function propName(prop) {
  return prop?.name ?? "";
}

export function propsInGroup(groupId) {
  return PROPERTIES.filter((prop) => prop.group === groupId);
}

export function buildingLabel(count) {
  if (count === 6) return "Skyscraper";
  if (count === 5) return "Hotel";
  if (count > 0) return `${count} house${count === 1 ? "" : "s"}`;
  return "";
}
