/**
 * Per-tool SEO content, keyed by the same tool href used by GAMES / toolMetadata.
 *
 * Why this exists: each /tools/* page renders an interactive client widget with
 * almost no crawlable body text, so the pages can't rank for the high-volume,
 * evergreen queries they're built for ("wheel spinner", "random name picker",
 * "team generator", "dice roller", ...). This registry supplies real on-page
 * content (an intro, a how-to, use cases, and an FAQ) that is rendered
 * server-side by <ToolSeoSection> (src/components/tool-seo-section.tsx) below
 * each widget, and also emitted as FAQPage structured data.
 *
 * Every claim here must match the tool's shipped code. Check the tool before
 * adding a feature to its copy: earlier versions described a team-size option,
 * a list import, a win streak, a trivia timer, and automatic bingo calling,
 * none of which existed.
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
  /** 2-3 sentence intro paragraph using the tool's real search terms. */
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
      "Type in your options, spin, and the wheel picks one at random. You can give some entries more weight than others, change the colors, or start from a template like giveaway prizes or dinner ideas. People use it for raffles, for picking who goes next in class, and for ending the argument about what to eat.",
    howTo: {
      title: "How to use the wheel spinner",
      steps: [
        "Type your options into the entry list, or load a template (giveaway prizes, dinner picks, movie night, chores).",
        "Raise or lower an entry's weight to make it more or less likely to come up. Change the colors if you like.",
        "Press Spin. The winner is announced when the wheel stops.",
        "If you want everyone to watch the same spin, create a room. Guests see the wheel turn and land on their own screens.",
      ],
    },
    useCases: [
      { title: "Giveaways and raffles", body: "Put your entrants on the wheel and spin where everyone can see it, so nobody can say the draw was rigged." },
      { title: "Classroom picks", body: "Pick who answers next without it looking like you chose them." },
      { title: "Everyday decisions", body: "Dinner, a movie, whose turn it is to do the dishes. Spin and move on." },
      { title: "Prize wheels", body: "Set up your own segments for an event, a stream, or a party." },
    ],
    faqs: [
      { q: "Is the Lucky Wheel free?", a: "Yes. It's free, and you don't need an account." },
      { q: "Can I make some options more likely to win?", a: "Yes. Every entry has a weight. Double an entry's weight and it's twice as likely to come up." },
      { q: "Is the spin random?", a: "Yes. Each spin picks a segment at random, taking the weights you set into account." },
      { q: "Can everyone spin the same wheel together?", a: "Yes. Create a room and send the link or QR code. Everyone in the room watches the same spin." },
      { q: "Are my entries saved?", a: "Your wheel is saved in your browser, so your entries are still there next time you open it on the same device." },
    ],
    related: ["/tools/name-draw", "/tools/coin-flip", "/tools/dice"],
  },

  "/tools/name-draw": {
    heading: "A free random name picker for fair draws",
    intro:
      "Add a list of names and draw one at random. Elimination mode draws several names in order without repeats, which is handy for a raffle with more than one prize. You can type names in, or import them from a CSV if you already have a list.",
    howTo: {
      title: "How to pick a random name",
      steps: [
        "Add names one at a time, or import a CSV.",
        "Leave it on a single draw for one winner, or switch on elimination mode to draw several in order.",
        "Press Draw and the winner is revealed on screen.",
        "Create a room if you want the whole group to watch the same draw.",
      ],
    },
    useCases: [
      { title: "Giveaway winners", body: "Draw from your list of entrants in front of everyone, so the result can't be disputed." },
      { title: "Classroom", body: "Cold-call at random, or pick today's helper without favoring anyone." },
      { title: "Secret Santa and turn order", body: "Draw names for a gift exchange, or decide who goes first in a game." },
      { title: "Raffles with several prizes", body: "Use elimination mode to reveal winners one at a time." },
    ],
    faqs: [
      { q: "Is the random name picker free?", a: "Yes. It's free and there's nothing to sign up for." },
      { q: "Can I import a list of names?", a: "Yes. You can import names from a CSV instead of typing each one." },
      { q: "Can I draw more than one winner?", a: "Yes. Elimination mode draws names in order and never picks the same person twice." },
      { q: "Is the draw random?", a: "Yes. Every name still in the list has the same chance of being picked." },
      { q: "Can my group watch the draw live?", a: "Yes. Create a room and share the link or QR code. Everyone sees the winner at the same moment." },
    ],
    related: ["/tools/lucky-wheel", "/tools/team-maker", "/tools/tournament"],
  },

  "/tools/team-maker": {
    heading: "A free random team generator",
    intro:
      "Add everyone's names, choose how many teams you want, and Team Maker shuffles people into groups whose sizes differ by one at most. Shuffle again if you don't like the result. Teachers use it for PE and group projects, and friends use it to pick sides at game night.",
    howTo: {
      title: "How to generate teams",
      steps: [
        "Add everyone's names.",
        "Choose how many teams you want.",
        "Press Generate. Names are shuffled and dealt out as evenly as possible.",
        "Create a room if you want each person to see their team on their own phone.",
      ],
    },
    useCases: [
      { title: "PE and sports", body: "Split a class into even sides before a match, without captains picking." },
      { title: "Group projects", body: "Assign project groups at random so nobody can complain about who they got." },
      { title: "Game nights", body: "Sort friends into teams for trivia, charades, or anything else." },
      { title: "Workshops and events", body: "Break a room into tables or breakout groups quickly." },
    ],
    faqs: [
      { q: "Is the team generator free?", a: "Yes. It's free and needs no account." },
      { q: "Can I choose how many teams there are?", a: "Yes. Pick the number of teams and people are spread across them as evenly as possible." },
      { q: "Are the teams random?", a: "Yes. Names are shuffled every time you generate, so you get a different split each round." },
      { q: "Can I shuffle the same list again?", a: "Yes. Keep your list and generate as many times as you like." },
      { q: "Can everyone see their team at the same time?", a: "Yes. Create a room and share it. Everyone sees the team list on their own device." },
    ],
    related: ["/tools/name-draw", "/tools/tournament", "/tools/lucky-wheel"],
  },

  "/tools/tournament": {
    heading: "A free tournament bracket generator",
    intro:
      "Enter your players or teams and pick a format: single elimination, double elimination, round robin, or Swiss. Record each result and winners move on to their next match. Open it in a room and everyone following along sees the same bracket as it fills in.",
    howTo: {
      title: "How to make a tournament bracket",
      steps: [
        "Add your players or teams. The bracket is seeded for you.",
        "Choose single elimination, double elimination, round robin, or Swiss.",
        "Record each match result. Winners advance to their next match.",
        "Create a room so players can follow the bracket from their own phones.",
      ],
    },
    useCases: [
      { title: "Esports and gaming", body: "Run a bracket for any game, with seeding and advancement handled for you." },
      { title: "Sports days", body: "Set up a knockout or a round robin for teams or individual players." },
      { title: "Office and school", body: "Ping-pong, chess, or a quiz league, with a bracket everyone can check." },
      { title: "Game nights", body: "Turn a casual party game into a proper competition." },
    ],
    faqs: [
      { q: "Is the bracket generator free?", a: "Yes. It's free, with nothing to sign up for." },
      { q: "Which formats are supported?", a: "Single elimination, double elimination, round robin, and Swiss." },
      { q: "Does the bracket update as I enter results?", a: "Yes. Record a result and the winner moves on straight away." },
      { q: "Can I share the bracket?", a: "Yes. Create a room and share the link, and everyone can follow along." },
      { q: "How many players can I add?", a: "As many as you need. The matchups are generated for you." },
    ],
    related: ["/tools/team-maker", "/tools/name-draw", "/tools/rps"],
  },

  "/tools/coin-flip": {
    heading: "A free online coin flip",
    intro:
      "Tap once and the coin lands on heads or tails, 50/50. Use it when you don't have a coin on you, or open a room so a whole group sees the same flip and nobody can claim it landed the other way.",
    howTo: {
      title: "How to flip a coin online",
      steps: [
        "Tap to flip.",
        "The coin lands on heads or tails.",
        "Flip again as many times as you need.",
        "Create a room so everyone sees the same flip at the same time.",
      ],
    },
    useCases: [
      { title: "Settling arguments", body: "Who goes first, who pays, who gets the last slice." },
      { title: "Sports", body: "The kickoff toss, when nobody has a coin." },
      { title: "Yes or no", body: "Any decision with two options." },
      { title: "Classroom", body: "Pick between two options with the whole class watching." },
    ],
    faqs: [
      { q: "Is the coin flip free?", a: "Yes, and there's no account needed." },
      { q: "Is it really 50/50?", a: "Yes. Each flip is heads or tails at random with equal odds." },
      { q: "Can we flip together as a group?", a: "Yes. Create a room and share it, and everyone sees the same result." },
      { q: "Do I need to install anything?", a: "No. It works in any browser, on a phone or a computer." },
    ],
    related: ["/tools/dice", "/tools/lucky-wheel", "/tools/rps"],
  },

  "/tools/dice": {
    heading: "A free online dice roller",
    intro:
      "Roll anything from a D4 to a D100, one die at a time or a handful at once, and the total is added up for you. It covers board games when a die has gone missing, and tabletop RPG sessions where everyone wants to see the roll.",
    howTo: {
      title: "How to roll dice online",
      steps: [
        "Choose a die type (D4, D6, D8, D10, D12, D20, or D100) and how many to roll.",
        "Tap Roll.",
        "Roll again whenever you like. The total is shown each time.",
        "Create a room so everyone at the table sees the same roll.",
      ],
    },
    useCases: [
      { title: "Tabletop RPGs", body: "D20s for D&D, or whatever mix your system uses." },
      { title: "Board games", body: "A stand-in when the dice have gone missing from the box." },
      { title: "Teaching probability", body: "Roll a few hundred times in front of a class and look at the results." },
      { title: "Picking a number", body: "Decide turn order or pick a number at random." },
    ],
    faqs: [
      { q: "Is the dice roller free?", a: "Yes, with no sign-up." },
      { q: "Can I roll several dice at once?", a: "Yes. Roll a set together and the total is added up for you." },
      { q: "Which dice are available?", a: "D4, D6, D8, D10, D12, D20, and D100." },
      { q: "Can we all see the same roll?", a: "Yes. Create a room and share it, and everyone at the table sees the same result." },
    ],
    related: ["/tools/coin-flip", "/tools/lucky-wheel", "/tools/guess-number"],
  },

  "/tools/guess-number": {
    heading: "A free number guessing game",
    intro:
      "A secret number is picked and you guess. After each guess you're told whether to go higher or lower, and the aim is to get there in as few tries as possible. Play on your own, or open a room and see who in the group finds it first.",
    howTo: {
      title: "How to play the guessing game",
      steps: [
        "Start a game and a secret number is set within the range.",
        "Enter a guess.",
        "Follow the higher or lower hint and guess again.",
        "Create a room to play with friends, each guessing from their own device.",
      ],
    },
    useCases: [
      { title: "Warm-ups", body: "A quick round to get a group or a class going." },
      { title: "Classroom", body: "Practice estimation and number sense." },
      { title: "Between games", body: "Something short to play while you decide what's next." },
      { title: "Kids", body: "Easy to explain and quick to play." },
    ],
    faqs: [
      { q: "Is the number guessing game free?", a: "Yes, and you don't need an account." },
      { q: "Can I play with friends?", a: "Yes. Create a room and share it, and everyone guesses from their own device." },
      { q: "Are there hints?", a: "Yes. Every guess tells you whether the number is higher or lower." },
      { q: "Can I play on my own?", a: "Yes. It works solo or with a group." },
    ],
    related: ["/tools/dice", "/tools/word-scramble", "/tools/trivia"],
  },

  "/tools/rps": {
    heading: "Play Rock Paper Scissors online",
    intro:
      "Pick rock, paper, or scissors and play a round against the computer. To play a real person, open a room and invite them. Both picks stay hidden until you've each chosen, then they're shown at the same time.",
    howTo: {
      title: "How to play Rock Paper Scissors online",
      steps: [
        "Pick rock, paper, or scissors.",
        "The computer picks too, and you see who won.",
        "Play as many rounds as you like.",
        "For a real opponent, create a room and invite a friend. Both picks are revealed together.",
      ],
    },
    useCases: [
      { title: "A quick round", body: "Play the computer whenever you have a minute." },
      { title: "Breaking a tie", body: "Settle who goes first, or play best of three." },
      { title: "Playing a friend remotely", body: "Create a room and play from different devices." },
      { title: "Warm-ups", body: "Start a game night or a lesson with something quick." },
    ],
    faqs: [
      { q: "Is Rock Paper Scissors free to play?", a: "Yes, with nothing to sign up for." },
      { q: "Can I play against the computer?", a: "Yes. The computer picks at random, so you don't need a second player." },
      { q: "Can I play with a friend remotely?", a: "Yes. Create a room and share the link or QR code. Both of your picks are revealed at the same moment." },
      { q: "What beats what?", a: "Rock beats scissors, scissors beats paper, and paper beats rock. The same pick is a draw." },
    ],
    related: ["/tools/coin-flip", "/tools/tournament", "/tools/dice"],
  },

  "/tools/truth-or-dare": {
    heading: "Play Truth or Dare online",
    intro:
      "Choose truth or dare and draw a prompt from the deck, so nobody has to think them up on the spot. In a room, everyone sees the same prompt on their own phone, which helps when the group is spread out.",
    howTo: {
      title: "How to play Truth or Dare",
      steps: [
        "Choose truth or dare.",
        "Draw a prompt for whoever's turn it is.",
        "They answer or do the dare, then it's the next person's turn.",
        "Create a room so the whole group sees the same prompts.",
      ],
    },
    useCases: [
      { title: "Parties", body: "Get people talking once the party has settled in." },
      { title: "Sleepovers", body: "The usual late-night game, with a deck ready to go." },
      { title: "New groups", body: "A way for people who've just met to learn a bit about each other." },
      { title: "Game nights", body: "Something different to slot between other games." },
    ],
    faqs: [
      { q: "Is Truth or Dare free?", a: "Yes, with no sign-up." },
      { q: "Do I need to come up with prompts?", a: "No. The deck is already written, so you can start right away." },
      { q: "Can the whole group play together?", a: "Yes. Create a room and share it, and everyone gets the same prompts." },
      { q: "Is it suitable for all ages?", a: "It's a party game for friends rather than a classroom game. Use your judgment about who's playing." },
    ],
    related: ["/tools/would-you-rather", "/tools/never-have-i-ever", "/tools/trivia"],
  },

  "/tools/would-you-rather": {
    heading: "Play Would You Rather online",
    intro:
      "You get two options and have to pick one. Everyone votes, then you see how the group split. The questions are already written, and the arguing afterwards is usually the best part.",
    howTo: {
      title: "How to play Would You Rather",
      steps: [
        "Open the game to see a question.",
        "Everyone votes for one side.",
        "See who picked what, then argue about it.",
        "Create a room so the whole group votes on the same question.",
      ],
    },
    useCases: [
      { title: "Icebreakers", body: "You learn a lot about someone from what they'd rather do." },
      { title: "Parties", body: "Good for starting a friendly argument." },
      { title: "Road trips", body: "Pass the phone around, or have everyone vote from their own." },
      { title: "Team meetings", body: "A low-stakes opener before the real agenda." },
    ],
    faqs: [
      { q: "Is Would You Rather free?", a: "Yes, and you don't need an account." },
      { q: "Can everyone vote at once?", a: "Yes. Create a room and share it. Everyone votes on the same question and sees the split." },
      { q: "Do I need my own questions?", a: "No. The questions are already written." },
      { q: "Can I use it in a classroom?", a: "Yes. It works as a class warm-up." },
    ],
    related: ["/tools/truth-or-dare", "/tools/never-have-i-ever", "/tools/trivia"],
  },

  "/tools/never-have-i-ever": {
    heading: "Play Never Have I Ever online",
    intro:
      "Read out a \"Never have I ever...\" prompt and find out who has done it. The prompts are already written, so you can start right away, and in a room the whole group sees the same one at the same time.",
    howTo: {
      title: "How to play Never Have I Ever",
      steps: [
        "Draw a \"Never have I ever...\" prompt.",
        "Anyone who has done it owns up.",
        "Move on to the next prompt.",
        "Create a room so everyone sees the same prompts.",
      ],
    },
    useCases: [
      { title: "Parties", body: "Usually ends with someone telling a story they didn't plan to tell." },
      { title: "Sleepovers and hangouts", body: "Nothing to set up and no cards to lose." },
      { title: "New groups", body: "A quick way to find out what people have in common." },
      { title: "Game nights", body: "An easy round to add between other games." },
    ],
    faqs: [
      { q: "Is Never Have I Ever free?", a: "Yes, with no sign-up." },
      { q: "Do I need to come up with prompts?", a: "No. The prompts are already written." },
      { q: "Can the whole group play together?", a: "Yes. Create a room and share it, and everyone sees the same prompt." },
      { q: "Is it a party game or a classroom game?", a: "It's a party game for friends, not something for the classroom." },
    ],
    related: ["/tools/truth-or-dare", "/tools/would-you-rather", "/tools/trivia"],
  },

  "/tools/trivia": {
    heading: "Play free online trivia",
    intro:
      "Answer multiple-choice questions and score points for each one you get right. Play on your own to see how you do, or host a quiz in a room where everyone answers the same questions and the scoreboard shows who's ahead.",
    howTo: {
      title: "How to play trivia",
      steps: [
        "Start a game to get your first question.",
        "Pick one of the answers.",
        "Get it right and you score points.",
        "Create a room to host a quiz where everyone answers together.",
      ],
    },
    useCases: [
      { title: "Quiz nights", body: "A pub-style quiz for friends, family, or coworkers." },
      { title: "Classroom review", body: "A bit of competition makes revision go faster." },
      { title: "At work", body: "A short quiz to break up the afternoon." },
      { title: "Parties", body: "A quiz round in the middle of the evening." },
    ],
    faqs: [
      { q: "Is the trivia game free?", a: "Yes, with no sign-up." },
      { q: "Can I host a quiz for a group?", a: "Yes. Create a room and share the link or QR code, and everyone answers the same questions." },
      { q: "How does scoring work?", a: "You get points for correct answers, and the scoreboard ranks everyone in the room." },
      { q: "Can I play on my own?", a: "Yes. Play solo, or with a group." },
    ],
    related: ["/tools/word-scramble", "/tools/would-you-rather", "/tools/guess-number"],
  },

  "/tools/bingo": {
    heading: "Play free online bingo",
    intro:
      "Everyone gets a card, numbers are called one at a time, and the first person to complete a line wins. Press Call and the next number is drawn at random, with no repeats. In a room, your card stays the same even if your page reloads.",
    howTo: {
      title: "How to play bingo online",
      steps: [
        "Start a game and every player gets a card.",
        "Press Call to draw the next number.",
        "Called numbers are marked on your card.",
        "Create a room to host a game where everyone plays the same calls.",
      ],
    },
    useCases: [
      { title: "Classroom", body: "Number bingo with no printing and no counters to hand out." },
      { title: "Family game night", body: "Grandparents and kids can play the same game." },
      { title: "Parties and events", body: "Host a round for a big group without a caller's cage." },
      { title: "Fundraisers", body: "A quick bingo round at a community event." },
    ],
    faqs: [
      { q: "Is online bingo free?", a: "Yes, and you don't need an account." },
      { q: "Can I host bingo for a group?", a: "Yes. Create a room and share it, and everyone plays on the same called numbers." },
      { q: "How are numbers called?", a: "Press Call and the next number is drawn at random from the ones not called yet." },
      { q: "What happens if my page reloads?", a: "In a room, your card is kept, so a reload or a dropped connection won't lose your progress." },
    ],
    related: ["/tools/trivia", "/tools/lucky-wheel", "/tools/name-draw"],
  },

  "/tools/word-scramble": {
    heading: "Play free online word scramble",
    intro:
      "The letters of a word are jumbled up, and you have to work out what it was. Ask for a hint if you're stuck. Play on your own, or in a room where everyone gets the same word and the first correct answer wins.",
    howTo: {
      title: "How to play word scramble",
      steps: [
        "Start a round to get a scrambled word.",
        "Work out the word and type your guess.",
        "Ask for a hint if you're stuck.",
        "Create a room to race friends on the same word.",
      ],
    },
    useCases: [
      { title: "Classroom", body: "Spelling and vocabulary practice that feels like a game." },
      { title: "Parties", body: "A quick word race for a game night." },
      { title: "Solo", body: "A few rounds while you wait for something." },
      { title: "With kids", body: "Good spelling practice that doesn't feel like homework." },
    ],
    faqs: [
      { q: "Is the word scramble game free?", a: "Yes, with no sign-up." },
      { q: "Are there hints?", a: "Yes. Ask for one when you're stuck." },
      { q: "Can I race my friends?", a: "Yes. Create a room and share it. Everyone gets the same word, and the first right answer wins." },
      { q: "Can I play on my own?", a: "Yes. It works solo or with a group." },
    ],
    related: ["/tools/trivia", "/tools/guess-number", "/tools/would-you-rather"],
  },
};

export function getToolSeoContent(href: string): ToolSeoContent | undefined {
  return TOOL_SEO_CONTENT[href];
}
