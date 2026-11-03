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
      "Spilled a drink", "Group selfie taken", "Song everyone sings to", "Phone lost then found",
      "Dad joke delivered", "Dance battle breaks out", "Outfit compliment given", "Late arrival grand entrance",
      "Ice cubes dropped", "Double dipping caught", "Unexpected deep chat", "Bathroom line forms",
      "Song requested to DJ", "Heartfelt toast given", "Snack bowl emptied", "Someone wearing party hat",
      "Laughing till crying", "Infectious laugh heard", "Secret handshake seen", "Spontaneous card game",
      "Pet steals attention", "Someone loses their cup", "Epic high-five", "Early yawner spotted",
      "Story wildly exaggerated", "Surprise guest arrives", "Someone spills food on shirt", "Phone flashlight waved",
      "Karaoke microphone grabbed", "Shoes taken off", "Cheering for no reason", "Selfie retaken 5 times",
      "Playlist switched", "Dip spilled on table", "Someone loses voice", "Group hug happens"
    ],
  },
  {
    id: "icebreaker",
    name: "Get to Know You",
    description: "Fun personal facts for classrooms, teams, and friendly mixers.",
    emoji: "handshake",
    isNumbers: false,
    items: [
      "Has a pet cat", "Speaks 2+ languages", "Left-handed", "Born in another country",
      "Plays musical instrument", "Has run a marathon", "Vegetarian or vegan", "Never broken a bone",
      "Visited 3+ continents", "Loves spicy food", "Early bird (up before 6am)", "Night owl (awake at 1am)",
      "Has a twin", "Can whistle loudly", "Has been on TV", "Has met a celebrity",
      "Loves horror movies", "Drinks 3+ coffees daily", "Can solve a Rubik's cube", "Knows martial arts",
      "Lived in 3+ cities", "Has a home garden", "Bakes homemade bread", "Afraid of heights",
      "Prefers mountains to beach", "Plays video games weekly", "Drives manual shift", "Has ridden a horse",
      "Owns a vinyl record", "Has a tattoo", "Keeps a daily journal", "Practices meditation",
      "Has scuba dived", "Camped under the stars", "Has a unique collection", "Knows sign language"
    ],
  },
  {
    id: "movies",
    name: "Movie Night",
    description: "Cinematic tropes, cliches, and movie moments everyone recognizes.",
    emoji: "clapper",
    isNumbers: false,
    items: [
      "Dramatic plot twist", "Jump scare", "Post-credits scene", "Training montage",
      "Villain monologues", "Slow-motion explosion", "Car chase scene", "Wise old mentor",
      "Rain during sad moment", "Wilhelm scream heard", "Love triangle introduced", "Hacking in 10 seconds",
      "Fake-out death", "Inspirational speech", "Disguise fools everyone", "Timer stopped at 0:01",
      "Character says title", "Product placement seen", "Flashback sequence", "Mirror scare",
      "Phone battery dies", "Epic final battle", "Pet survives danger", "Surprise cameo",
      "Unnecessary romance", "Catchphrase delivered", "Sequel teaser at end", "Dramatic rooftop talk",
      "Elevator music scene", "Whispering during secret", "Key found just in time", "Dramatic gasp"
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
