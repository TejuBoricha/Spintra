import { shuffleArray } from "./utils";

export interface BingoTheme {
  id: string;
  name: string;
  description: string;
  emoji: string;
  isNumbers?: boolean;
  items: string[];
}

export type BingoPatternId = "line" | "corners" | "x" | "plus" | "blackout";

export interface BingoPattern {
  id: BingoPatternId;
  name: string;
  description: string;
}

export const BINGO_PATTERNS: BingoPattern[] = [
  { id: "line", name: "Any Line", description: "Horizontal, vertical, or diagonal line (5 in a row)" },
  { id: "corners", name: "Four Corners", description: "All 4 outer corner spaces marked" },
  { id: "x", name: "X-Pattern", description: "Both full diagonals intersecting through the center" },
  { id: "plus", name: "Plus Cross", description: "Complete center column and center row" },
  { id: "blackout", name: "Full Card (Coverall)", description: "Every single square on the card marked" },
];

export const BINGO_THEMES: BingoTheme[] = [
  {
    id: "classic",
    name: "Classic Numbers (1-75)",
    description: "Traditional 75-ball bingo with B-I-N-G-O column ranges.",
    emoji: "game_die",
    isNumbers: true,
    items: Array.from({ length: 75 }, (_, i) => String(i + 1)),
  },
  {
    id: "science",
    name: "Science & Nature",
    description: "Elements, physics, astronomy, and biology for schools and curious minds.",
    emoji: "microscope",
    isNumbers: false,
    items: [
      "Gravity", "Photosynthesis", "Mitochondria", "Black Hole", "DNA Helix", "Atom",
      "Tectonic Plate", "Solar Eclipse", "Supernova", "Molecule", "Fossil", "Milky Way Galaxy",
      "Ecosystem", "Velocity", "Quantum Leap", "Nebula", "Volcanic Magma", "Microscope",
      "Telescope", "Biodiversity", "Chemical Catalyst", "Chromosome", "Exoplanet", "Nuclear Fusion",
      "Geode Crystal", "Hibernation", "Isotope", "Kinetic Energy", "Laser Beam", "Magnetism",
      "Neutron Star", "Living Organism", "Light Photon", "Symbiosis", "Thermodynamics",
      "Vacuum of Space", "Wavelength", "Atmosphere", "Metamorphosis", "Chlorophyll", "Plate Tectonics",
      "Cell Membrane", "Platelet", "Speed of Light", "Comet Tail", "Periodic Table"
    ],
  },
  {
    id: "party",
    name: "Party & Social",
    description: "Hilarious and classic moments that happen at every great gathering.",
    emoji: "party_popper",
    isNumbers: false,
    items: [
      "Spilled a drink", "Group selfie", "Group sing-along", "Lost & found phone",
      "Dad joke delivered", "Dance battle", "Outfit compliment", "Late grand entrance",
      "Ice cubes dropped", "Double-dip caught", "Unexpected deep chat", "Long bathroom line",
      "DJ song requested", "Heartfelt toast", "Snack bowl emptied", "Wearing party hat",
      "Laughing till crying", "Infectious laugh", "Secret handshake", "Spontaneous card game",
      "Pet steals the show", "Lost drink cup", "Epic high-five", "Early yawner",
      "Exaggerated story", "Surprise guest", "Food spilled on shirt", "Flashlights waved",
      "Karaoke mic grabbed", "Shoes taken off", "Spontaneous cheer", "5+ selfie retakes",
      "Playlist switched", "Dip spilled", "Voice lost", "Group hug"
    ],
  },
  {
    id: "icebreaker",
    name: "Get to Know You",
    description: "Fun personal facts for classrooms, teams, and friendly mixers.",
    emoji: "handshake",
    isNumbers: false,
    items: [
      "Has a pet cat", "Speaks 2+ languages", "Left-handed", "Born abroad",
      "Plays an instrument", "Ran a marathon", "Vegetarian / Vegan", "Never broke a bone",
      "Visited 3+ continents", "Loves spicy food", "Early bird (pre-6am)", "Night owl (post-1am)",
      "Has a twin", "Whistles loudly", "Been on TV", "Met a celebrity",
      "Loves horror films", "Drinks 3+ coffees", "Solves Rubik's cube", "Knows martial arts",
      "Lived in 3+ cities", "Home gardener", "Bakes fresh bread", "Afraid of heights",
      "Loves mountains", "Plays video games", "Drives manual shift", "Rode a horse",
      "Owns vinyl records", "Has a tattoo", "Daily journaler", "Meditates",
      "Scuba dived", "Camped outside", "Unique collection", "Knows sign language"
    ],
  },
  {
    id: "movies",
    name: "Movie Night",
    description: "Cinematic tropes, cliches, and movie moments everyone recognizes.",
    emoji: "clapper",
    isNumbers: false,
    items: [
      "Plot twist", "Jump scare", "Post-credits scene", "Training montage",
      "Villain speech", "Slow-mo explosion", "Car chase", "Wise old mentor",
      "Rain at sad moment", "Wilhelm scream", "Love triangle", "10-second hacking",
      "Fake-out death", "Inspiring speech", "Flawless disguise", "Timer at 0:01",
      "Title drop", "Product placement", "Flashback scene", "Mirror scare",
      "Phone battery dies", "Final battle", "Pet survives", "Surprise cameo",
      "Unnecessary romance", "Catchphrase said", "Sequel teaser", "Rooftop showdown",
      "Elevator music", "Whispered secret", "Key found in time", "Dramatic gasp"
    ],
  },
];

/** Generate a 5x5 card for any theme (classic numbers or word themes) */
export function generateThemedBingoCard(theme: BingoTheme): string[][] {
  if (theme.isNumbers) {
    // Standard 75-ball numbers with column ranges:
    // B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
    const ranges: [number, number][] = [
      [1, 15],
      [16, 30],
      [31, 45],
      [46, 60],
      [61, 75],
    ];
    return ranges.map(([min, max]) => {
      const pool = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
      return shuffleArray(pool).slice(0, 5);
    });
  }

  // Word/Themed Bingo: Draw 24 unique items (and 1 free center space)
  const shuffled = shuffleArray([...theme.items]);
  const chosen = shuffled.slice(0, 25);
  // Guarantee we have at least 25 items (fallback repeat with numbers if necessary)
  while (chosen.length < 25) {
    chosen.push(`Bonus ${chosen.length + 1}`);
  }

  const card: string[][] = [[], [], [], [], []];
  let idx = 0;
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 5; r++) {
      card[c].push(chosen[idx++]);
    }
  }
  return card;
}

/** Check if marked coordinate pairs fulfill the chosen bingo pattern */
export function checkBingoPattern(
  pattern: BingoPatternId,
  isCellMarked: (col: number, row: number) => boolean,
): boolean {
  // Free center space at [2, 2] is always considered marked
  const marked = (c: number, r: number) => (c === 2 && r === 2) || isCellMarked(c, r);

  switch (pattern) {
    case "corners":
      return marked(0, 0) && marked(4, 0) && marked(0, 4) && marked(4, 4);

    case "x": {
      const diag1 = [0, 1, 2, 3, 4].every((i) => marked(i, i));
      const diag2 = [0, 1, 2, 3, 4].every((i) => marked(i, 4 - i));
      return diag1 && diag2;
    }

    case "plus": {
      const col2 = [0, 1, 2, 3, 4].every((r) => marked(2, r));
      const row2 = [0, 1, 2, 3, 4].every((c) => marked(c, 2));
      return col2 && row2;
    }

    case "blackout": {
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 5; r++) {
          if (!marked(c, r)) return false;
        }
      }
      return true;
    }

    case "line":
    default: {
      // Any row
      for (let r = 0; r < 5; r++) {
        if ([0, 1, 2, 3, 4].every((c) => marked(c, r))) return true;
      }
      // Any col
      for (let c = 0; c < 5; c++) {
        if ([0, 1, 2, 3, 4].every((r) => marked(c, r))) return true;
      }
      // Diagonals
      if ([0, 1, 2, 3, 4].every((i) => marked(i, i))) return true;
      if ([0, 1, 2, 3, 4].every((i) => marked(i, 4 - i))) return true;
      return false;
    }
  }
}
