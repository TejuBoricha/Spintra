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
  gridPreview: boolean[][];
}

export const BINGO_PATTERNS: BingoPattern[] = [
  {
    id: "line",
    name: "Any Line",
    description: "Horizontal, vertical, or diagonal line (5 in a row)",
    gridPreview: [
      [false, false, false, false, false],
      [false, false, false, false, false],
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ],
  },
  {
    id: "corners",
    name: "Four Corners",
    description: "All 4 outer corner spaces marked",
    gridPreview: [
      [true, false, false, false, true],
      [false, false, false, false, false],
      [false, false, true, false, false],
      [false, false, false, false, false],
      [true, false, false, false, true],
    ],
  },
  {
    id: "x",
    name: "X-Pattern",
    description: "Both full diagonals intersecting through the center",
    gridPreview: [
      [true, false, false, false, true],
      [false, true, false, true, false],
      [false, false, true, false, false],
      [false, true, false, true, false],
      [true, false, false, false, true],
    ],
  },
  {
    id: "plus",
    name: "Plus Cross",
    description: "Complete center column and center row",
    gridPreview: [
      [false, false, true, false, false],
      [false, false, true, false, false],
      [true, true, true, true, true],
      [false, false, true, false, false],
      [false, false, true, false, false],
    ],
  },
  {
    id: "blackout",
    name: "Full Card (Coverall)",
    description: "Every single square on the card marked",
    gridPreview: [
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
    ],
  },
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
      "Cell Membrane", "Platelet", "Speed of Light", "Comet Tail", "Periodic Table",
      "Superconductor", "Dark Matter", "Hadron Collider", "CRISPR Gene", "Gravitational Wave", "Antimatter",
      "Plate Boundary", "Stellar Nursery", "Hydrothermal Vent", "Absolute Zero", "Bioluminescence",
      "Geothermal Geyser", "Coral Reef", "Aurora Borealis"
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
      "Playlist switched", "Dip spilled", "Voice lost", "Group hug",
      "Cake candle blown", "Someone spilled punch", "Epic toast made", "Playlist changed mid-song",
      "Matching outfits spotted", "Loud laugh across room", "Selfie stick spotted", "Lost shoe found",
      "Surprise announcement", "Late arrival sneaks in", "Phone charger borrowed", "Balloons popped",
      "Dance circle formed", "Spontaneous karaoke", "Snack table crowded", "Someone took last slice",
      "Confetti in hair", "Group photo round 3"
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
      "Scuba dived", "Camped outside", "Unique collection", "Knows sign language",
      "Has 3+ siblings", "Never seen Star Wars", "Loves pineapple pizza", "Plays chess",
      "Can juggle 3 items", "Wears colorful socks", "Has visited 10+ states", "Morning runner",
      "Bakes sourdough bread", "Speaks 3+ languages", "Owns an acoustic guitar", "Allergic to cats",
      "Listens to podcasts daily", "Has run a half-marathon", "Can solve crossword fast", "Traveled solo abroad",
      "Collects vintage mugs", "Prefers tea over coffee"
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
      "Elevator music", "Whispered secret", "Key found in time", "Dramatic gasp",
      "Dramatic slow walk", "Unnecessary explosion", "Hacker typing furiously", "Villain monologues",
      "Kiss in pouring rain", "Breakfast left uneaten", "Car starts on last try", "Mirror reflection jump",
      "Disguise is just glasses", "Hero looks away from fire", "Cop turns in their badge", "Whispered dying words",
      "Epic sword duel", "Spit take with coffee", "Hero runs toward danger", "Red wire or blue wire",
      "Cheesy one-liner delivered", "Training sequence music"
    ],
  },
  {
    id: "gaming",
    name: "Gaming & Esports",
    description: "Classic tropes, esports hype, and moments every gamer knows.",
    emoji: "video_game",
    isNumbers: false,
    items: [
      "Boss fight entered", "Rage quit", "GG in chat", "Clutch 1v3 win", "Loot box opened",
      "Respawn delay", "Speedrun glitch", "Stealth failed", "Inventory is full", "Mana depleted",
      "Headshot landed", "Fall damage taken", "Easter egg found", "NPC dialog skipped",
      "Quick-time event failed", "Level up sound", "Side quest accepted", "Teammate went AFK",
      "Spawn camping", "Microtransaction pop-up", "Hitbox discrepancy", "Save file corrupted",
      "Character customization", "Rare drop rate", "Final boss phase 2", "Friendly fire incident",
      "Healing potion consumed", "Button mashing", "Tutorial completed", "Unskippable cutscene",
      "Lag spike spike", "Secret area unlocked", "Overpowered weapon", "Cooldown timer waiting",
      "Triple kill", "Sniper spotted", "Revive requested", "Armor durability zero",
      "Crafting recipe unlocked", "Mount summoned", "Voice chat background music", "Rank promotion match",
      "Defuse the bomb", "Checkered victory flag", "Combo streak broken", "Gamer chair reclined",
      "DLC expansion installed", "Double jump executed", "Wall run timed", "Minimap danger ping",
      "Escort mission slowed", "Title screen music chills"
    ],
  },
  {
    id: "food",
    name: "Foodie & Cuisine",
    description: "Delicious dishes, culinary terms, and gourmet obsessions.",
    emoji: "pizza",
    isNumbers: false,
    items: [
      "Truffle oil added", "Sourdough starter fed", "Al dente pasta", "Sous vide prepared",
      "Fermented kimchi", "Extra garlic added", "Caramelized onions", "Flambéed with rum",
      "Crispy bacon sizzle", "Espresso shot pulled", "Dim sum bamboo basket", "Street tacos cilantro",
      "Fresh guacamole made", "Matcha green tea whisked", "Charcuterie cheese board", "Spicy habanero kick",
      "Wood-fired crust charred", "Smoked brisket bark", "Croissant butter flaky", "Boba pearls chewy",
      "Pad Thai crushed peanuts", "Sashimi salmon fresh", "French macaron shell", "Ramen broth simmered",
      "Molten chocolate center", "Churros cinnamon sugar", "Pesto fresh basil", "Biryani saffron rice",
      "Artisan cheese aged", "Gelato scoop smooth", "Tapas small plate shared", "Brioche bun toasted",
      "Fondue cheese melted", "Falafel tahini drizzle", "Acai bowl granola", "Waffles maple syrup",
      "Dumplings dipped in soy", "Crème brûlée torch crack", "Avocado toast seeded", "Tiramisu coffee soaked",
      "Ceviche lime cured", "Gyoza pan-fried crisp", "Gouda wax rind sliced", "Pho broth star anise",
      "Chili oil crunch scooped", "Baguette crust crackle", "BBQ ribs fall off bone", "Cacio e pepe tossed",
      "Cannoli sweet ricotta", "Poke bowl sesame tuna", "Risotto stirred creamy", "Butter poached lobster"
    ],
  },
  {
    id: "travel",
    name: "Wanderlust & Travel",
    description: "Airport adventures, scenic journeys, and globetrotting milestones.",
    emoji: "airplane",
    isNumbers: false,
    items: [
      "Passport stamped", "Boarding pass scanned", "Jet lag nap", "UNESCO World Heritage site",
      "Red-eye flight survived", "Carry-on bag weighed", "Window seat view", "Foreign currency exchanged",
      "Scenic mountain overlook", "Hostel common room chat", "Train ticket validated", "Souvenir magnet bought",
      "Subway map deciphered", "Local phrase spoken", "Flight delay announced", "Walking tour completed",
      "Historic castle visited", "Street food sampled", "Ocean sunrise watched", "Lost in cobblestone streets",
      "Luggage tag attached", "Turbulence bump felt", "Overnight sleeper train", "Duty-free perfume tested",
      "Beach seashell found", "Ferry boat ride", "Rooftop terrace sunset", "Airport coffee ordered",
      "Rental car confusion", "National park trail hiked", "Museum audio guide", "Ancient ruins explored",
      "Monument selfie taken", "Border crossing crossed", "Local market bartered", "Camera roll filled",
      "Skyline viewpoint reached", "Bridge walked across", "Canyon rim admired", "Tropical waterfall dip",
      "Cathedral stained glass", "Travel adapter plugged", "Hotel breakfast buffet", "Guidebook page marked",
      "Postcard mailed home", "Desert dune climbed", "Lighthouse beacon seen", "Gondola ride taken",
      "Thermal hot spring soaked", "Tuk-tuk ride taken", "Terminal gate sprint", "Compass heading checked"
    ],
  },
  {
    id: "music",
    name: "Music & Concerts",
    description: "Gig moments, festival memories, and earworm musical tropes.",
    emoji: "musical_note",
    isNumbers: false,
    items: [
      "Epic guitar solo", "Encore called by crowd", "Bass drop shakes floor", "Drum fill solo",
      "Festival wristband worn", "Crowd singing chorus", "Acoustic song set", "Mosh pit circle opens",
      "Sound check screech", "VIP backstage pass", "Vinyl record needle drop", "Earplugs popped in",
      "Setlist paper snagged", "Opening band rocks", "Stage pyrotechnics burst", "Merch t-shirt bought",
      "Phone flashlight wave", "Headlining act enters", "Key change in bridge", "Singer high note hits",
      "Drumstick tossed to fan", "Live album recorded", "Synthesizer arpeggio", "Brass section blares",
      "Feedback squeal caught", "Guitar pick caught", "Beat drop anticipation", "Song request shouted",
      "Front row rail lean", "A cappella harmony", "Concert poster framed", "DJ scratch transition",
      "Microphone spin trick", "Saxophone solo wails", "Crowd surfer carried", "Campfire singalong",
      "Reverb vocal tail", "Jam band improvisation", "Bizarre cover song", "Ear ringing after show",
      "Stadium light sweep", "Roadie tunes guitar", "Confetti cannon blast", "Stage dive caught",
      "Autograph signed", "Bassline walking groove", "Acoustic intro silence", "Fret slide whistle",
      "Soundboard engineer mix", "Tour bus rolled up", "Metronome beat clicks", "Standing ovation roar"
    ],
  },
  {
    id: "workplace",
    name: "Office & Remote Work",
    description: "Zoom blunders, corporate jargon, and remote work hilarity.",
    emoji: "briefcase",
    isNumbers: false,
    items: [
      "'You are on mute'", "'Can everyone see my screen?'", "Unexpected dog barking", "Slack notification ding",
      "Forgot to stop screen sharing", "Cold coffee reheated", "Quick calendar sync invited", "Typing loudly on hot mic",
      "Awkward double goodbye", "Camera off for eating", "Friday afternoon deploy", "'Let us take this offline'",
      "Inbox zero achieved", "Frozen video face", "Background blur glitch", "Dual monitor envy",
      "Spontaneous virtual high-five", "Echo feedback in headphones", "Someone talking while muted", "Casual Friday outfit",
      "Coffee cup collection on desk", "Meeting could have been email", "'I was having connection issues'", "Calendar invite overlap",
      "Screen shared wrong tab", "Standing desk raised", "Keyboard mechanical clack", "Stretched during camera off",
      "Emoji reaction flood", "Sent email missing attachment", "Post-lunch productivity dip", "Sprint planning debate",
      "Water cooler gossip", "Virtual background beach", "Draft email accidentally sent", "Microphone unmuted cough",
      "Cat walks across keyboard", "Brainstorming Miro board", "Friday 4 PM meeting invite", "'Hard stop at top of hour'",
      "Screen brightness blinding", "Sticky note reminder stack", "Tab overload (30+ open)", "Ergonomic chair adjusted",
      "WiFi reboot countdown", "Shared google doc cursor dance", "Snack run mid-afternoon", "Headphones out of battery",
      "Keyboard shortcut triumph", "Presentation slide typo caught", "Virtual happy hour cheers", "Weekend plans discussed"
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
