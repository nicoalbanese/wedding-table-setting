import type { Guest } from "@/planner/types";

export type SeatingGenderHint = "female" | "male" | "unknown";

const femaleNames = new Set([
  "abigail",
  "ada",
  "adele",
  "adriana",
  "agata",
  "agnese",
  "alessandra",
  "alexandra",
  "alice",
  "alicia",
  "alison",
  "amanda",
  "amelia",
  "amy",
  "angelica",
  "anna",
  "annabel",
  "anne",
  "annette",
  "annika",
  "arianna",
  "audrey",
  "aurora",
  "ava",
  "barbara",
  "beatrice",
  "benedetta",
  "bianca",
  "bridget",
  "camilla",
  "carla",
  "carlotta",
  "carol",
  "carolina",
  "casey",
  "caterina",
  "cecilia",
  "charlotte",
  "chiara",
  "chloe",
  "claudia",
  "claire",
  "constance",
  "costanza",
  "daisy",
  "daniela",
  "debora",
  "deborah",
  "diana",
  "elena",
  "eleonora",
  "elisa",
  "elizabeth",
  "ella",
  "ellie",
  "emilia",
  "emily",
  "emma",
  "erica",
  "erika",
  "eva",
  "evelyn",
  "federica",
  "francesca",
  "gabriella",
  "gaia",
  "georgia",
  "giada",
  "gina",
  "ginevra",
  "giorgia",
  "giovanna",
  "giulia",
  "grace",
  "greta",
  "hannah",
  "helen",
  "helle",
  "isabella",
  "isabelle",
  "jane",
  "jennifer",
  "jessica",
  "julia",
  "julie",
  "katherine",
  "laura",
  "lauren",
  "lia",
  "liliana",
  "linda",
  "lisa",
  "lorenza",
  "lucia",
  "lucy",
  "luisa",
  "maddalena",
  "margherita",
  "maria",
  "marina",
  "martina",
  "mary",
  "matilde",
  "melissa",
  "michelle",
  "mirah",
  "molly",
  "morena",
  "naomi",
  "niamh",
  "nicole",
  "olivia",
  "paola",
  "paolina",
  "patrizia",
  "rachel",
  "raffaella",
  "rebecca",
  "ruth",
  "samantha",
  "sara",
  "sarah",
  "silvia",
  "simonetta",
  "sofia",
  "sophia",
  "stefania",
  "stephanie",
  "susan",
  "tari",
  "tiffany",
  "valentina",
  "veronica",
  "victoria",
  "virginia",
]);

const maleNames = new Set([
  "adam",
  "alessandro",
  "alex",
  "andrea",
  "andrew",
  "angelo",
  "anthony",
  "antonio",
  "ben",
  "benjamin",
  "bradley",
  "brian",
  "carlo",
  "charles",
  "christian",
  "christopher",
  "daniel",
  "david",
  "diego",
  "domenico",
  "edoardo",
  "eduardo",
  "elia",
  "emilio",
  "evan",
  "fabio",
  "fabrizio",
  "federico",
  "filippo",
  "francesco",
  "franco",
  "gabriel",
  "george",
  "giacomo",
  "gianluca",
  "gianni",
  "gio",
  "giovanni",
  "giuseppe",
  "gonzalo",
  "gregory",
  "habib",
  "hardy",
  "harry",
  "henry",
  "hugh",
  "jack",
  "jackson",
  "james",
  "joao",
  "john",
  "jon",
  "joseph",
  "leonardo",
  "lorenzo",
  "luca",
  "luigi",
  "manfredi",
  "marco",
  "matteo",
  "matthew",
  "max",
  "maximilian",
  "michael",
  "michele",
  "mitch",
  "nathan",
  "nicholas",
  "nick",
  "nico",
  "nicola",
  "oliver",
  "paddy",
  "paolo",
  "paul",
  "peter",
  "pierluigi",
  "piero",
  "ravi",
  "robert",
  "roberto",
  "rocco",
  "salvatore",
  "samuel",
  "sebastian",
  "simone",
  "stefano",
  "stephan",
  "stephen",
  "theo",
  "tom",
  "vincenzo",
  "vincent",
  "vittorio",
  "walter",
  "will",
  "william",
]);

const ignoredNamePrefixes = new Set(["dr", "miss", "mr", "mrs", "ms", "prof", "sir", "zia", "zio"]);

export function inferSeatingGenderHint(name: string): SeatingGenderHint {
  const firstName = getFirstNameToken(name);
  if (!firstName) return "unknown";
  if (femaleNames.has(firstName)) return "female";
  if (maleNames.has(firstName)) return "male";
  return "unknown";
}

export function orderGuestsForAlternatingSeating(guests: Guest[]) {
  const sortedGuests = [...guests].sort((a, b) => a.name.localeCompare(b.name));
  const female = sortedGuests.filter((guest) => inferSeatingGenderHint(guest.name) === "female");
  const male = sortedGuests.filter((guest) => inferSeatingGenderHint(guest.name) === "male");
  const unknown = sortedGuests.filter((guest) => inferSeatingGenderHint(guest.name) === "unknown");
  const firstHint: Exclude<SeatingGenderHint, "unknown"> = female.length > male.length ? "female" : "male";
  const ordered: Guest[] = [];
  let nextHint = firstHint;

  while (female.length > 0 || male.length > 0) {
    const primary = nextHint === "female" ? female : male;
    const fallback = nextHint === "female" ? male : female;
    const nextGuest = primary.shift() ?? fallback.shift();
    if (!nextGuest) break;

    ordered.push(nextGuest);
    nextHint = nextHint === "female" ? "male" : "female";
  }

  return [...ordered, ...unknown];
}

function getFirstNameToken(name: string) {
  const tokens = normalizeName(name)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

  return tokens.find((token) => !ignoredNamePrefixes.has(token)) ?? "";
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
