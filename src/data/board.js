export const BANK_HOUSES = 32;
export const BANK_HOTELS = 12;
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
  "Car",
  "Dog",
  "Ship",
  "Wheelbarrow",
  "Boot",
  "Thimble",
  "Iron",
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
  { id: "railroad", label: "Railroads", color: "#4b4642", ink: "#fff8ee" },
  { id: "utility", label: "Utilities", color: "#d5dbe3", ink: "#17202b" },
];

function street(id, name, nameUk, group, price, mortgage, houseCost, rent) {
  return { id, name, nameUk, group, type: "street", price, mortgage, houseCost, rent };
}

function rail(id, name, nameUk) {
  return { id, name, nameUk, group: "railroad", type: "railroad", price: 200, mortgage: 100 };
}

function utility(id, name) {
  return { id, name, nameUk: name, group: "utility", type: "utility", price: 150, mortgage: 75 };
}

// Classic Monopoly prices are the same on the US and UK boards. Rents are
// [base, 1 house, 2 houses, 3 houses, 4 houses, hotel].
export const PROPERTIES = [
  street("mediterranean", "Mediterranean Avenue", "Old Kent Road", "brown", 60, 30, 50, [2, 10, 30, 90, 160, 250]),
  street("baltic", "Baltic Avenue", "Whitechapel Road", "brown", 60, 30, 50, [4, 20, 60, 180, 320, 450]),
  street("oriental", "Oriental Avenue", "The Angel, Islington", "lightblue", 100, 50, 50, [6, 30, 90, 270, 400, 550]),
  street("vermont", "Vermont Avenue", "Euston Road", "lightblue", 100, 50, 50, [6, 30, 90, 270, 400, 550]),
  street("connecticut", "Connecticut Avenue", "Pentonville Road", "lightblue", 120, 60, 50, [8, 40, 100, 300, 450, 600]),
  street("st-charles", "St. Charles Place", "Pall Mall", "pink", 140, 70, 100, [10, 50, 150, 450, 625, 750]),
  street("states", "States Avenue", "Whitehall", "pink", 140, 70, 100, [10, 50, 150, 450, 625, 750]),
  street("virginia", "Virginia Avenue", "Northumberland Avenue", "pink", 160, 80, 100, [12, 60, 180, 500, 700, 900]),
  street("st-james", "St. James Place", "Bow Street", "orange", 180, 90, 100, [14, 70, 200, 550, 750, 950]),
  street("tennessee", "Tennessee Avenue", "Marlborough Street", "orange", 180, 90, 100, [14, 70, 200, 550, 750, 950]),
  street("new-york", "New York Avenue", "Vine Street", "orange", 200, 100, 100, [16, 80, 220, 600, 800, 1000]),
  street("kentucky", "Kentucky Avenue", "Strand", "red", 220, 110, 150, [18, 90, 250, 700, 875, 1050]),
  street("indiana", "Indiana Avenue", "Fleet Street", "red", 220, 110, 150, [18, 90, 250, 700, 875, 1050]),
  street("illinois", "Illinois Avenue", "Trafalgar Square", "red", 240, 120, 150, [20, 100, 300, 750, 925, 1100]),
  street("atlantic", "Atlantic Avenue", "Leicester Square", "yellow", 260, 130, 150, [22, 110, 330, 800, 975, 1150]),
  street("ventnor", "Ventnor Avenue", "Coventry Street", "yellow", 260, 130, 150, [22, 110, 330, 800, 975, 1150]),
  street("marvin", "Marvin Gardens", "Piccadilly", "yellow", 280, 140, 150, [24, 120, 360, 850, 1025, 1200]),
  street("pacific", "Pacific Avenue", "Regent Street", "green", 300, 150, 200, [26, 130, 390, 900, 1100, 1275]),
  street("north-carolina", "North Carolina Avenue", "Oxford Street", "green", 300, 150, 200, [26, 130, 390, 900, 1100, 1275]),
  street("pennsylvania-ave", "Pennsylvania Avenue", "Bond Street", "green", 320, 160, 200, [28, 150, 450, 1000, 1200, 1400]),
  street("park-place", "Park Place", "Park Lane", "blue", 350, 175, 200, [35, 175, 500, 1100, 1300, 1500]),
  street("boardwalk", "Boardwalk", "Mayfair", "blue", 400, 200, 200, [50, 200, 600, 1400, 1700, 2000]),
  rail("reading", "Reading Railroad", "King's Cross Station"),
  rail("pennsylvania-rr", "Pennsylvania Railroad", "Marylebone Station"),
  rail("bo", "B. & O. Railroad", "Fenchurch Street Station"),
  rail("short-line", "Short Line", "Liverpool Street Station"),
  utility("electric", "Electric Company"),
  utility("water", "Water Works"),
];

export const PROP_MAP = Object.fromEntries(PROPERTIES.map((prop) => [prop.id, prop]));
export const GROUP_MAP = Object.fromEntries(GROUPS.map((group) => [group.id, group]));

export const GROUPED = GROUPS.map((group) => ({
  ...group,
  properties: PROPERTIES.filter((prop) => prop.group === group.id),
}));

export function propName(prop, edition = "us") {
  if (!prop) return "";
  return edition === "uk" ? prop.nameUk : prop.name;
}

export function propsInGroup(groupId) {
  return PROPERTIES.filter((prop) => prop.group === groupId);
}
