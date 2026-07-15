/**
 * Per-tool SEO content, keyed by the same tool href used by GAMES / toolMetadata.
 *
 * Why this exists: each /tools/* page renders an interactive client widget with
 * almost no crawlable body text, so the pages can't rank for the high-volume,
 * evergreen queries they're built for ("wheel spinner", "random name picker",
 * "team generator", "dice roller", ...). This registry supplies real on-page
 * content — an intro, a how-to, use cases, and an FAQ — that is rendered
 * server-side by <ToolSeoSection> (src/components/tool-seo-section.tsx) below
 * each widget, and also emitted as FAQPage structured data.
 *
 * Content is deliberately grounded in each tool's real, shipped feature set
 * (see src/lib/games.ts featureDescription) — no invented features.
 */

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolUseCase {
  title: string;
  body: string;
}

export interface ToolSeoContent {
  /** Visible, keyword-rich section H2 (the widget still owns the page H1). */
  heading: string;
  /** 2–3 sentence intro paragraph using the tool's real search terms. */
  intro: string;
  howTo: {
    title: string;
    steps: string[];
  };
  useCases: ToolUseCase[];
  faqs: ToolFaq[];
  /** Related tool hrefs for internal linking (must be /tools/* hrefs). */
  related: string[];
}

export const TOOL_SEO_CONTENT: Record<string, ToolSeoContent> = {
  "/tools/lucky-wheel": {
    heading: "A free online spinner wheel for any decision",
    intro:
      "Lucky Wheel is a free, no-signup random wheel spinner you can customize in seconds. Add your own entries, weight the odds, pick colors, and spin a physics-based wheel to pick a winner at random — perfect for giveaways, raffles, classroom picks, or settling what's for dinner.",
    howTo: {
      title: "How to use the wheel spinner",
      steps: [
        "Type your options into the entry list, or load a ready-made template (giveaway prizes, dinner picks, movie night, chores).",
        "Adjust each entry's weight to make some outcomes more or less likely, and change colors to taste.",
        "Press Spin and watch the wheel decide — the winner is announced with a celebration.",
        "Want everyone watching the same spin? Create a room and the wheel spins live and in sync for every guest.",
      ],
    },
    useCases: [
      { title: "Giveaways & raffles", body: "Draw a fair winner from your entrants with weighted odds and a spin everyone can watch." },
      { title: "Classroom picks", body: "Randomly choose a student to answer, present, or go next without anyone feeling singled out." },
      { title: "Decisions", body: "Can't agree on dinner, a movie, or who does the dishes? Let the wheel settle it." },
      { title: "Prizes & rewards", body: "Run a prize wheel at events, streams, or parties with your own custom segments." },
    ],
    faqs: [
      { q: "Is the Lucky Wheel free?", a: "Yes. Spintra's Lucky Wheel is completely free to use, with no account or sign-up required." },
      { q: "Can I make some options more likely to win?", a: "Yes. Each entry has an adjustable weight, so you can make outcomes more or less likely instead of a strictly equal chance." },
      { q: "Is the spin random and fair?", a: "Yes. The winning segment is chosen at random each spin, respecting the weights you set." },
      { q: "Can everyone spin the same wheel together?", a: "Yes. Create a room and invite friends by link or QR code — the wheel spins live and in sync for everyone in the room." },
      { q: "Are my entries saved?", a: "Your wheel is saved in your browser automatically, so your entries are still there next time you visit on the same device." },
    ],
    related: ["/tools/name-draw", "/tools/coin-flip", "/tools/dice"],
  },

  "/tools/name-draw": {
    heading: "A free random name picker for fair draws",
    intro:
      "Name Draw is a free random name picker and winner generator. Paste or import a list of names, then pull a random winner — with an elimination mode for drawing multiple names in order and a spotlight animation so every draw feels fair and exciting.",
    howTo: {
      title: "How to pick a random name",
      steps: [
        "Add names one at a time or import a whole list at once (CSV supported).",
        "Choose a single draw for one winner, or turn on elimination mode to draw several names in order.",
        "Draw — the winner is revealed with a spotlight animation everyone can see.",
        "Create a room to run the draw live so your whole group watches the same result.",
      ],
    },
    useCases: [
      { title: "Giveaway winners", body: "Pick a fair winner from your list of entrants with a draw nobody can dispute." },
      { title: "Classroom", body: "Cold-call students at random or choose today's helper without bias." },
      { title: "Secret Santa & order", body: "Draw names for gift exchanges or decide turn order for games." },
      { title: "Raffles & prizes", body: "Run raffles at events and reveal winners one at a time in elimination mode." },
    ],
    faqs: [
      { q: "Is the random name picker free?", a: "Yes. Name Draw is free to use with no sign-up required." },
      { q: "Can I import a list of names?", a: "Yes. You can add names individually or import a full list, including from CSV, instead of typing each one." },
      { q: "Can I draw more than one winner?", a: "Yes. Elimination mode lets you draw multiple names in order without repeating anyone." },
      { q: "Is the draw truly random?", a: "Yes. Each draw selects a name at random, so every remaining name has a fair chance." },
      { q: "Can my group watch the draw live?", a: "Yes. Create a room and share the link or QR code so everyone sees the same winner revealed in real time." },
    ],
    related: ["/tools/lucky-wheel", "/tools/team-maker", "/tools/tournament"],
  },

  "/tools/team-maker": {
    heading: "A free random team generator",
    intro:
      "Team Maker is a free team generator that splits any list of people into balanced, random groups in one click. Add names, choose how many teams or how big each team should be, and get fair, shuffled teams — ideal for PE class, sports, group projects, and game nights.",
    howTo: {
      title: "How to generate teams",
      steps: [
        "Add everyone's names, or import your list all at once.",
        "Pick the number of teams you want (or the size of each team).",
        "Generate — everyone is shuffled into balanced groups instantly.",
        "Create a room so the whole group sees their team assignments update live.",
      ],
    },
    useCases: [
      { title: "PE & sports", body: "Split a class or group into even sides for games and matches in seconds." },
      { title: "Group projects", body: "Randomly assign students to project groups without playground politics." },
      { title: "Game nights", body: "Divide friends into teams for trivia, charades, or party games." },
      { title: "Workshops & events", body: "Break attendees into breakout groups or tables quickly and fairly." },
    ],
    faqs: [
      { q: "Is the team generator free?", a: "Yes. Team Maker is free to use and needs no account." },
      { q: "Can I set the number of teams or the team size?", a: "Yes. You can choose how many teams to create, and the tool balances people evenly across them." },
      { q: "Are the teams random?", a: "Yes. Names are shuffled randomly each time you generate, so teams are fair and different every round." },
      { q: "Can I reuse the same list of people?", a: "Yes. Your list stays available so you can re-shuffle into new teams as often as you like." },
      { q: "Can everyone see their team at the same time?", a: "Yes. Create a room and share it so each person sees the team assignments live on their own device." },
    ],
    related: ["/tools/name-draw", "/tools/tournament", "/tools/lucky-wheel"],
  },

  "/tools/tournament": {
    heading: "A free tournament bracket generator",
    intro:
      "Tournament is a free bracket generator for single elimination, double elimination, round robin, and Swiss formats. Enter your players or teams and get a clean, shareable bracket that updates live as you record results — great for esports, sports days, office competitions, and game nights.",
    howTo: {
      title: "How to make a tournament bracket",
      steps: [
        "Add your players or teams — the bracket seeds automatically.",
        "Choose a format: single elimination, double elimination, round robin, or Swiss.",
        "Record each match result and watch winners advance through the bracket in real time.",
        "Create a room to share a live bracket everyone can follow as the tournament plays out.",
      ],
    },
    useCases: [
      { title: "Esports & gaming", body: "Run a clean competitive bracket for any game with automatic seeding and advancement." },
      { title: "Sports days", body: "Organize knockout or round-robin competitions for teams and players." },
      { title: "Office & school", body: "Host ping-pong, chess, or quiz tournaments with a bracket everyone can follow." },
      { title: "Game nights", body: "Turn any party game into a proper competition with a shareable bracket." },
    ],
    faqs: [
      { q: "Is the bracket generator free?", a: "Yes. The Tournament bracket tool is free with no sign-up required." },
      { q: "Which tournament formats are supported?", a: "Single elimination, double elimination, round robin, and Swiss formats are all supported." },
      { q: "Does the bracket update as I enter results?", a: "Yes. Winners advance automatically as you record each match, and the bracket updates live." },
      { q: "Can I share the bracket with others?", a: "Yes. Create a room and share the link so everyone can follow the bracket as it plays out." },
      { q: "How many players or teams can I add?", a: "The bracket seeds any number of entrants and generates the matchups for you." },
    ],
    related: ["/tools/team-maker", "/tools/name-draw", "/tools/rps"],
  },

  "/tools/coin-flip": {
    heading: "A free online coin flip",
    intro:
      "Coin Flip is a free virtual coin toss — flip heads or tails online in one tap to settle any debate. No coin needed, no sign-up, and you can flip together with friends in a live room so everyone sees the same result.",
    howTo: {
      title: "How to flip a coin online",
      steps: [
        "Open the tool and tap to flip.",
        "Watch the coin toss animation land on heads or tails.",
        "Flip again as many times as you need.",
        "Create a room so a whole group sees the same flip at the same time.",
      ],
    },
    useCases: [
      { title: "Settle debates", body: "Decide who goes first, who pays, or who wins with a fair 50/50 toss." },
      { title: "Sports & games", body: "Do the kickoff or coin toss when you don't have a physical coin handy." },
      { title: "Quick yes/no", body: "Turn any either-or decision into a fast, impartial call." },
      { title: "Classroom", body: "Make a fair pick between two options in front of the whole class." },
    ],
    faqs: [
      { q: "Is the coin flip free?", a: "Yes. The online coin flip is free and needs no account." },
      { q: "Is it a fair 50/50 flip?", a: "Yes. Each flip lands on heads or tails at random with equal odds." },
      { q: "Can we flip together in a group?", a: "Yes. Create a room and share it so everyone sees the same coin toss result live." },
      { q: "Do I need to install anything?", a: "No. It runs in your browser on any device — no download or sign-up required." },
    ],
    related: ["/tools/dice", "/tools/lucky-wheel", "/tools/rps"],
  },

  "/tools/dice": {
    heading: "A free online dice roller",
    intro:
      "Dice Roller is a free virtual dice roller for tabletop and party games. Roll one die or a whole custom set, get instant random results, and roll together in a live room — no physical dice required.",
    howTo: {
      title: "How to roll dice online",
      steps: [
        "Choose how many dice to roll and set your dice type.",
        "Tap roll to get an instant, random result.",
        "Re-roll as often as you like — totals are tallied for you.",
        "Create a room so everyone at the table sees the same roll live.",
      ],
    },
    useCases: [
      { title: "Tabletop games", body: "Roll for board games, D&D, and RPGs when you're missing physical dice." },
      { title: "Party games", body: "Add a random dice roll to any group game or drinking game." },
      { title: "Teaching probability", body: "Demonstrate odds and randomness in class with visible, repeatable rolls." },
      { title: "Quick decisions", body: "Assign turns or pick numbers at random with a single roll." },
    ],
    faqs: [
      { q: "Is the dice roller free?", a: "Yes. The online dice roller is free with no sign-up." },
      { q: "Can I roll multiple dice at once?", a: "Yes. You can roll a custom set of dice together and the tool tallies the total." },
      { q: "Are the rolls random?", a: "Yes. Every roll produces a fair, random result." },
      { q: "Can we all roll the same dice together?", a: "Yes. Create a room and share it so everyone at the table sees the same roll in real time." },
    ],
    related: ["/tools/coin-flip", "/tools/lucky-wheel", "/tools/guess-number"],
  },

  "/tools/guess-number": {
    heading: "A free number guessing game",
    intro:
      "Guess the Number is a free group number guessing game. One secret number is chosen, and players take turns guessing with higher/lower hints until someone nails it — a simple, fast classic that works solo or with the whole room.",
    howTo: {
      title: "How to play the guessing game",
      steps: [
        "Start a game to set a secret number within the range.",
        "Take turns entering guesses.",
        "Use the higher/lower hints and reactions to close in on the answer.",
        "Create a room to play with friends, each guessing on their own device.",
      ],
    },
    useCases: [
      { title: "Icebreakers", body: "Warm up a group or class with a quick, low-stakes guessing round." },
      { title: "Classroom", body: "Practice number sense and estimation with live hints." },
      { title: "Party filler", body: "Keep everyone engaged between bigger activities." },
      { title: "Family fun", body: "Play a screen-friendly classic that works for all ages." },
    ],
    faqs: [
      { q: "Is the number guessing game free?", a: "Yes. It's free to play with no account required." },
      { q: "Can I play with friends?", a: "Yes. Create a room and share it so everyone guesses together in real time." },
      { q: "Are there hints?", a: "Yes. After each guess you get higher/lower hints to help you close in on the secret number." },
      { q: "Can I play by myself?", a: "Yes. The game works solo as well as with a group." },
    ],
    related: ["/tools/dice", "/tools/word-scramble", "/tools/trivia"],
  },

  "/tools/rps": {
    heading: "Play Rock Paper Scissors online",
    intro:
      "Rock Paper Scissors is a free online version of the classic hand game. Play instantly against the computer, or create a room and challenge a friend to a synchronized reveal — no app and no sign-up.",
    howTo: {
      title: "How to play Rock Paper Scissors online",
      steps: [
        "Pick rock, paper, or scissors to play a round against the computer.",
        "See the result instantly — rock beats scissors, scissors beats paper, paper beats rock.",
        "Keep playing to build a win streak.",
        "Want a real opponent? Create a room and invite a friend for a synchronized reveal.",
      ],
    },
    useCases: [
      { title: "Quick solo rounds", body: "Play a fast round against the computer any time you need a random call." },
      { title: "Settle a tie", body: "Decide who goes first or break a tie with a best-of series." },
      { title: "Play a friend remotely", body: "Create a room so you and a friend can play from different devices." },
      { title: "Warm-ups", body: "Kick off a game night or class with a fast head-to-head." },
    ],
    faqs: [
      { q: "Is Rock Paper Scissors free to play?", a: "Yes. It's free online with no sign-up needed." },
      { q: "Can I play against the computer?", a: "Yes. The standalone game plays instantly against a random computer opponent, so you don't need a second player." },
      { q: "Can I play with a friend remotely?", a: "Yes. Create a room and share the link or QR code so you and a friend play from different devices, with both choices revealed at once." },
      { q: "Who wins in Rock Paper Scissors?", a: "Rock beats scissors, scissors beats paper, and paper beats rock. Matching choices are a draw." },
    ],
    related: ["/tools/coin-flip", "/tools/tournament", "/tools/dice"],
  },

  "/tools/truth-or-dare": {
    heading: "Play Truth or Dare online",
    intro:
      "Truth or Dare is a free online version of the classic party game. Draw truths and dares for your group with ready-made prompts, and play together in a live room so everyone gets a turn — great for parties, sleepovers, and friend groups.",
    howTo: {
      title: "How to play Truth or Dare",
      steps: [
        "Open the tool and choose Truth or Dare.",
        "Draw a prompt from the deck for the current player.",
        "Complete the truth or dare, then pass to the next person.",
        "Create a room so the whole group plays together with the same prompts.",
      ],
    },
    useCases: [
      { title: "Parties", body: "Get a party going with prompts that spark laughs and stories." },
      { title: "Sleepovers", body: "A go-to classic for friend groups and hangouts." },
      { title: "Icebreakers", body: "Help a new group loosen up and get to know each other." },
      { title: "Game nights", body: "Add a round of truth or dare to your regular game night lineup." },
    ],
    faqs: [
      { q: "Is Truth or Dare free?", a: "Yes. It's free to play online with no sign-up." },
      { q: "Do I need to think up prompts?", a: "No. The game comes with ready-made truths and dares, so you can start straight away." },
      { q: "Can the whole group play together?", a: "Yes. Create a room and share it so everyone plays with the same prompts in real time." },
      { q: "Is it suitable for all ages?", a: "Truth or Dare is a party game aimed at friends and social groups rather than classrooms; pick prompts appropriate for your group." },
    ],
    related: ["/tools/would-you-rather", "/tools/never-have-i-ever", "/tools/trivia"],
  },

  "/tools/would-you-rather": {
    heading: "Play Would You Rather online",
    intro:
      "Would You Rather is a free online version of the classic choice game. Vote on impossible either-or questions and instantly see what your group picked — a fun icebreaker and debate-starter for parties, classrooms, and road trips.",
    howTo: {
      title: "How to play Would You Rather",
      steps: [
        "Open the tool to see a would-you-rather question.",
        "Everyone votes for their choice.",
        "See the live split of who picked what, then argue about it.",
        "Create a room so the whole group votes on the same questions together.",
      ],
    },
    useCases: [
      { title: "Icebreakers", body: "Break the ice with a group or class using fun, revealing choices." },
      { title: "Parties", body: "Spark debates and laughs with impossible either-or questions." },
      { title: "Road trips", body: "Pass the time with a screen-friendly game everyone can join." },
      { title: "Team building", body: "Get coworkers talking with low-stakes, opinion-based prompts." },
    ],
    faqs: [
      { q: "Is Would You Rather free?", a: "Yes. It's free to play with no account required." },
      { q: "Can everyone vote at once?", a: "Yes. Create a room and share it so the whole group votes on the same question and sees the live results." },
      { q: "Do I need my own questions?", a: "No. The game includes ready-made questions so you can start immediately." },
      { q: "Can I play in a classroom?", a: "Yes. It works well as a classroom icebreaker with group-friendly prompts." },
    ],
    related: ["/tools/truth-or-dare", "/tools/never-have-i-ever", "/tools/trivia"],
  },

  "/tools/never-have-i-ever": {
    heading: "Play Never Have I Ever online",
    intro:
      "Never Have I Ever is a free online version of the classic confession game. Read out prompts and see who's done what — play together in a live room with ready-made statements that keep the whole group laughing.",
    howTo: {
      title: "How to play Never Have I Ever",
      steps: [
        "Open the tool to draw a 'Never have I ever…' prompt.",
        "Each player reacts to whether they've done it.",
        "Move to the next prompt and keep the round going.",
        "Create a room so everyone plays with the same prompts together.",
      ],
    },
    useCases: [
      { title: "Parties", body: "A classic confession game that gets everyone talking and laughing." },
      { title: "Sleepovers & hangouts", body: "Perfect for friend groups looking for an easy, no-setup game." },
      { title: "Icebreakers", body: "Help a new group get to know each other fast." },
      { title: "Game nights", body: "Add a round to your regular lineup without any prep." },
    ],
    faqs: [
      { q: "Is Never Have I Ever free?", a: "Yes. It's free to play online with no sign-up." },
      { q: "Do I need to come up with prompts?", a: "No. The game includes ready-made statements so you can start right away." },
      { q: "Can the whole group play together?", a: "Yes. Create a room and share it so everyone sees the same prompts in real time." },
      { q: "Is it a party game or classroom game?", a: "It's designed as a party game for friends and social groups rather than the classroom." },
    ],
    related: ["/tools/truth-or-dare", "/tools/would-you-rather", "/tools/trivia"],
  },

  "/tools/trivia": {
    heading: "Play free online trivia",
    intro:
      "Trivia is a free online multiplayer quiz game. Answer multiple-choice questions, race to score, and see who comes out on top — play solo to test yourself or host a live quiz for your whole group, classroom, or team.",
    howTo: {
      title: "How to play trivia",
      steps: [
        "Start a trivia game to get your first multiple-choice question.",
        "Pick your answer before the round ends.",
        "Earn points for correct answers and climb the scoreboard.",
        "Create a room to host a live quiz where everyone answers together.",
      ],
    },
    useCases: [
      { title: "Quiz nights", body: "Host a pub-style quiz for friends, family, or coworkers." },
      { title: "Classroom review", body: "Turn revision into a competitive, engaging quiz." },
      { title: "Team building", body: "Run a friendly trivia contest to break up the workday." },
      { title: "Parties", body: "Add a fast-paced quiz round to any get-together." },
    ],
    faqs: [
      { q: "Is the trivia game free?", a: "Yes. Trivia is free to play with no sign-up required." },
      { q: "Can I host a quiz for a group?", a: "Yes. Create a room and share the link or QR code so everyone answers the same questions live." },
      { q: "How is the score decided?", a: "You earn points for correct multiple-choice answers, and the scoreboard ranks players." },
      { q: "Can I play trivia solo?", a: "Yes. You can play on your own to test your knowledge, or with a group." },
    ],
    related: ["/tools/word-scramble", "/tools/would-you-rather", "/tools/guess-number"],
  },

  "/tools/bingo": {
    heading: "Play free online bingo",
    intro:
      "Bingo is a free online number bingo game. Numbers are called one by one, players mark their cards, and the first to complete a line shouts bingo — host a live game for a class, party, or family with cards that stay put even if a page reloads.",
    howTo: {
      title: "How to play bingo online",
      steps: [
        "Start a game and each player gets a bingo card.",
        "Numbers are called out one at a time.",
        "Mark the called numbers on your card.",
        "Create a room to host a live game where everyone plays on the same calls.",
      ],
    },
    useCases: [
      { title: "Classroom", body: "Run number bingo as a fun, low-prep class activity." },
      { title: "Family game night", body: "A screen-friendly classic that works for all ages." },
      { title: "Parties & events", body: "Host bingo for a group with automatic number calling." },
      { title: "Fundraisers", body: "Play a quick round of bingo at community events." },
    ],
    faqs: [
      { q: "Is online bingo free?", a: "Yes. Bingo is free to play with no account needed." },
      { q: "Can I host bingo for a group?", a: "Yes. Create a room and share it so everyone plays on the same called numbers in real time." },
      { q: "Are the numbers called automatically?", a: "Yes. Numbers are called one at a time so you can focus on marking your card." },
      { q: "What happens if my page reloads?", a: "Your bingo card is preserved so a reload or reconnect won't lose your progress in the room." },
    ],
    related: ["/tools/trivia", "/tools/lucky-wheel", "/tools/name-draw"],
  },

  "/tools/word-scramble": {
    heading: "Play free online word scramble",
    intro:
      "Word Scramble is a free online word game. Unscramble the jumbled letters to find the hidden word before anyone else, with hints to help when you're stuck — a fast, brain-teasing game for classrooms, parties, and solo play.",
    howTo: {
      title: "How to play word scramble",
      steps: [
        "Start a round to see a scrambled word.",
        "Rearrange the letters and enter your guess.",
        "Use a hint if you get stuck.",
        "Create a room to race friends to unscramble the same word first.",
      ],
    },
    useCases: [
      { title: "Classroom", body: "Build vocabulary and spelling skills with a quick word puzzle." },
      { title: "Parties", body: "Add a fast word-race round to your game night." },
      { title: "Brain warm-up", body: "A quick mental workout you can play solo any time." },
      { title: "Family fun", body: "A screen-friendly word game that works for all ages." },
    ],
    faqs: [
      { q: "Is the word scramble game free?", a: "Yes. Word Scramble is free to play with no sign-up." },
      { q: "Are there hints?", a: "Yes. You can use hints when you're stuck on a scrambled word." },
      { q: "Can I race my friends?", a: "Yes. Create a room and share it so everyone tries to unscramble the same word first." },
      { q: "Can I play by myself?", a: "Yes. Word Scramble works solo as well as with a group." },
    ],
    related: ["/tools/trivia", "/tools/guess-number", "/tools/would-you-rather"],
  },
};

export function getToolSeoContent(href: string): ToolSeoContent | undefined {
  return TOOL_SEO_CONTENT[href];
}
