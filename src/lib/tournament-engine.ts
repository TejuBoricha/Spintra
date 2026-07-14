import type { TournamentType } from "@/lib/types";
import { shuffleArray } from "@/lib/utils";

// Shared bracket engine used by both the standalone /tools/tournament page
// and the multiplayer room Tournament activity, so the two never drift out
// of sync on the tricky part: double-elimination round-shape and advancement.

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  player1: string | null;
  player2: string | null;
  score1: number | null;
  score2: number | null;
  winner: string | null;
  status: "pending" | "in-progress" | "completed";
}

export interface Tournament {
  type: TournamentType;
  rounds: BracketMatch[][];
  participants: string[];
  seeds: string[];
  currentRound: number;
  winner: string | null;
  losersBracket?: BracketMatch[][]; // For double elimination
  grandFinal?: BracketMatch | null; // Winners-bracket champ vs. losers-bracket champ
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/** Pad participants to next power of 2 with BYEs */
export function padWithByes(participants: string[]): string[] {
  const size = participants.length;
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(size)));
  if (size === nextPow2) return [...participants];
  const byes = Array(nextPow2 - size).fill("__BYE__");
  return [...participants, ...byes];
}

/** Seed sort: put seeded players first in tournament order, then fill rest randomly */
export function applySeeds(participants: string[], seeds: string[]): string[] {
  if (seeds.length === 0) return shuffleArray(participants);
  const seedSet = new Set(seeds.filter((s) => participants.includes(s)));
  const seeded = seeds.filter((s) => seedSet.has(s));
  const unseeded = shuffleArray(participants.filter((p) => !seedSet.has(p)));
  return [...seeded, ...unseeded];
}

/** Generate single elimination */
export function generateSingleElimination(
  participants: string[],
  seeds: string[]
): BracketMatch[][] {
  const ordered = applySeeds(participants, seeds);
  const padded = padWithByes(ordered);
  const numRounds = Math.log2(padded.length);

  const rounds: BracketMatch[][] = [];

  // Round 1
  const round1: BracketMatch[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    round1.push({
      id: generateId(),
      round: 1,
      position: i / 2,
      player1: padded[i],
      player2: padded[i + 1],
      score1: null,
      score2: null,
      winner: null,
      status: "pending",
    });
  }
  rounds.push(round1);

  // Subsequent rounds (blank, to be filled as winners advance)
  for (let r = 2; r <= numRounds; r++) {
    const matchCount = Math.pow(2, numRounds - r);
    const roundMatches: BracketMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      roundMatches.push({
        id: generateId(),
        round: r,
        position: i,
        player1: null,
        player2: null,
        score1: null,
        score2: null,
        winner: null,
        status: "pending",
      });
    }
    rounds.push(roundMatches);
  }

  return rounds;
}

/** Generate round robin – all-pairs table */
export function generateRoundRobin(participants: string[]): BracketMatch[][] {
  const ordered = shuffleArray(participants);
  const matches: BracketMatch[] = [];

  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      matches.push({
        id: generateId(),
        round: 1,
        position: matches.length,
        player1: ordered[i],
        player2: ordered[j],
        score1: null,
        score2: null,
        winner: null,
        status: "pending",
      });
    }
  }

  return [matches];
}

export function calculateStandings(rounds: BracketMatch[][], participants: string[]) {
  const points: Record<string, number> = {};
  participants.forEach(p => points[p] = 0);
  
  for (const round of rounds) {
    for (const match of round) {
      if (match.status === "completed" && match.player1 && match.player2) {
        if (match.score1 !== null && match.score2 !== null) {
          if (match.score1 > match.score2) {
            points[match.player1] = (points[match.player1] || 0) + 3;
          } else if (match.score2 > match.score1) {
            points[match.player2] = (points[match.player2] || 0) + 3;
          } else {
            points[match.player1] = (points[match.player1] || 0) + 1;
            points[match.player2] = (points[match.player2] || 0) + 1;
          }
        }
      }
    }
  }

  return participants.map(p => ({ 
    player: p, 
    points: points[p], 
    wins: rounds.flat().filter(m => m.status === "completed" && m.winner === p).length,
    draws: rounds.flat().filter(m => m.status === "completed" && m.score1 === m.score2 && m.score1 !== null && (m.player1 === p || m.player2 === p)).length,
    losses: rounds.flat().filter(m => m.status === "completed" && m.winner !== p && m.winner !== null && (m.player1 === p || m.player2 === p)).length,
  })).sort((a, b) => b.points - a.points);
}

export function generateNextSwissRound(rounds: BracketMatch[][], participants: string[]): BracketMatch[] {
  const standings = calculateStandings(rounds, participants);
  const played = new Set<string>();
  for (const r of rounds) {
    for (const m of r) {
      if (m.player1 && m.player2) {
         played.add(`${m.player1}-${m.player2}`);
         played.add(`${m.player2}-${m.player1}`);
      }
    }
  }

  const nextRound: BracketMatch[] = [];
  const available = standings.map(s => s.player);

  while (available.length > 1) {
    const p1 = available.shift()!;
    let opponentIdx = -1;
    for (let i = 0; i < available.length; i++) {
       if (!played.has(`${p1}-${available[i]}`)) {
          opponentIdx = i;
          break;
       }
    }
    if (opponentIdx === -1) opponentIdx = 0;
    
    const p2 = available.splice(opponentIdx, 1)[0];
    nextRound.push({
        id: generateId(),
        round: rounds.length + 1,
        position: nextRound.length,
        player1: p1,
        player2: p2,
        score1: null,
        score2: null,
        winner: null,
        status: "pending",
    });
  }

  if (available.length === 1) {
    nextRound.push({
        id: generateId(),
        round: rounds.length + 1,
        position: nextRound.length,
        player1: available[0],
        player2: "__BYE__",
        score1: 1,
        score2: 0,
        winner: available[0],
        status: "completed",
    });
  }

  return nextRound;
}

/** Generate swiss – pair participants round by round based on records */
export function generateSwiss(
  participants: string[]
): BracketMatch[][] {
  const shuffled = shuffleArray(participants);
  const rounds: BracketMatch[][] = [];

  const roundMatches: BracketMatch[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      roundMatches.push({
        id: generateId(),
        round: 1,
        position: i / 2,
        player1: shuffled[i],
        player2: shuffled[i + 1],
        score1: null,
        score2: null,
        winner: null,
        status: "pending",
      });
    } else {
      roundMatches.push({
        id: generateId(),
        round: 1,
        position: i / 2,
        player1: shuffled[i],
        player2: "__BYE__",
        score1: 1,
        score2: 0,
        winner: shuffled[i],
        status: "completed",
      });
    }
  }
  rounds.push(roundMatches);
  return rounds;
}

/** Generate double elimination */
export function generateDoubleElimination(
  participants: string[],
  seeds: string[]
): { winners: BracketMatch[][]; losers: BracketMatch[][] } {
  const ordered = applySeeds(participants, seeds);
  const padded = padWithByes(ordered);
  const numRounds = Math.log2(padded.length);

  // Winners bracket (same as single elim)
  const winners: BracketMatch[][] = [];
  const round1: BracketMatch[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    round1.push({
      id: generateId(),
      round: 1,
      position: i / 2,
      player1: padded[i],
      player2: padded[i + 1],
      score1: null,
      score2: null,
      winner: null,
      status: "pending",
    });
  }
  winners.push(round1);

  for (let r = 2; r <= numRounds; r++) {
    const matchCount = Math.pow(2, numRounds - r);
    const roundMatches: BracketMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      roundMatches.push({
        id: generateId(),
        round: r,
        position: i,
        player1: null,
        player2: null,
        score1: null,
        score2: null,
        winner: null,
        status: "pending",
      });
    }
    winners.push(roundMatches);
  }

  // Losers bracket: standard double-elimination shape — 2*(numRounds-1) rounds.
  // Even rounds (r=2m) receive two losers "paired against each other" (from
  // winners round 1 when m===0, or from the previous losers round's winners
  // otherwise). Odd rounds (r=2m+1) receive the same-position winner from the
  // preceding even round plus the fresh loser dropping from winners round
  // (m+2). See recordMatchResult for the placement logic that feeds this bracket.
  const losersRounds = Math.max(0, numRounds - 1) * 2;
  const losers: BracketMatch[][] = [];
  for (let r = 0; r < losersRounds; r++) {
    const m = Math.floor(r / 2);
    const matchCount = Math.pow(2, Math.max(0, numRounds - 2 - m));
    const roundMatches: BracketMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      roundMatches.push({
        id: generateId(),
        round: r + 1,
        position: i,
        player1: null,
        player2: null,
        score1: null,
        score2: null,
        winner: null,
        status: "pending",
      });
    }
    losers.push(roundMatches);
  }

  return { winners, losers };
}

/** Helper to advance winners within the losers bracket, handling recursive BYE auto-completion */
export function advanceInLosersBracket(
  lb: BracketMatch[][],
  roundIdx: number,
  position: number,
  winner: string
) {
  const isEvenRound = roundIdx % 2 === 0;
  const nextRoundIdx = roundIdx + 1;
  if (nextRoundIdx < lb.length) {
    if (isEvenRound) {
      lb[nextRoundIdx] = lb[nextRoundIdx].map((m) =>
        m.position === position
          ? {
              ...m,
              player1: winner,
              status: m.player1 && m.player2 && m.status === "pending" ? ("in-progress" as const) : m.status,
            }
          : m
      );
    } else {
      const nextPos = Math.floor(position / 2);
      const slot = position % 2 === 0 ? "player1" : "player2";
      lb[nextRoundIdx] = lb[nextRoundIdx].map((m) =>
        m.position === nextPos
          ? {
              ...m,
              [slot]: winner,
              status: m.player1 && m.player2 && m.status === "pending" ? ("in-progress" as const) : m.status,
            }
          : m
      );
    }

    // Check if the next match target is now fully populated and has a BYE
    const targetPos = isEvenRound ? position : Math.floor(position / 2);
    const updatedNextMatch = lb[nextRoundIdx].find((m) => m.position === targetPos);
    if (
      updatedNextMatch &&
      updatedNextMatch.player1 &&
      updatedNextMatch.player2 &&
      (updatedNextMatch.player1 === "__BYE__" || updatedNextMatch.player2 === "__BYE__")
    ) {
      const nonBye = updatedNextMatch.player1 === "__BYE__" ? updatedNextMatch.player2 : updatedNextMatch.player1;
      lb[nextRoundIdx] = lb[nextRoundIdx].map((m) =>
        m.position === targetPos
          ? {
              ...m,
              score1: m.player1 === "__BYE__" ? 0 : 1,
              score2: m.player1 === "__BYE__" ? 1 : 0,
              winner: nonBye,
              status: "completed" as const,
            }
          : m
      );
      // Recursively advance
      advanceInLosersBracket(lb, nextRoundIdx, targetPos, nonBye);
    }
  }
}

export function generateBracketForType(
  type: TournamentType,
  participants: string[],
  seeds: string[]
): { type: TournamentType; rounds: BracketMatch[][]; losersBracket?: BracketMatch[][] } {
  let tournament: Tournament;

  // With fewer than 3 players, a real losers bracket is degenerate (the
  // same 2 players would just replay each other), so this silently
  // downgrades to single-elimination. That adjustment MUST be returned to
  // the caller (not just used internally) — every caller constructs its
  // own Tournament.type from its ORIGINAL UI selection, and
  // recordMatchResult trusts tournament.type to pick its double- vs.
  // single-elimination branch. A caller that kept using the stale
  // "double-elimination" selection against this function's actual
  // single-elim-shaped output (no losers bracket at all) would take the
  // double-elimination branch, wait forever for a losers-bracket champion
  // that can never exist, and never declare an overall winner — exactly
  // the "2-player double elimination never shows a champion" bug this
  // comment is here because of.
  if (type === "double-elimination" && participants.length < 3) {
    type = "single-elimination";
  }

  switch (type) {
    case "single-elimination":
      tournament = { type, rounds: generateSingleElimination(participants, seeds), participants, seeds, currentRound: 1, winner: null };
      break;
    case "double-elimination": {
      const { winners, losers } = generateDoubleElimination(participants, seeds);
      tournament = { type, rounds: winners, losersBracket: losers, participants, seeds, currentRound: 1, winner: null };
      break;
    }
    case "round-robin":
      tournament = { type, rounds: generateRoundRobin(participants), participants, seeds, currentRound: 1, winner: null };
      break;
    case "swiss": {
      tournament = { type, rounds: generateSwiss(participants), participants, seeds, currentRound: 1, winner: null };
      break;
    }
  }

  // Auto-resolve any __BYE__ matches immediately for elimination brackets
  if (type === "single-elimination" || type === "double-elimination") {
    let resolved = true;
    while (resolved) {
      resolved = false;
      const allMatches = [
        ...tournament.rounds.flatMap((r, roundIdx) => r.map((match, position) => ({ match, roundIdx, position, bracketKey: "rounds" as const }))),
        ...(tournament.losersBracket || []).flatMap((r, roundIdx) => r.map((match, position) => ({ match, roundIdx, position, bracketKey: "losersBracket" as const }))),
      ];

      for (const { match, roundIdx, position, bracketKey } of allMatches) {
        if (match.status !== "completed" && match.player1 && match.player2 && (match.player1 === "__BYE__" || match.player2 === "__BYE__")) {
          const s1 = match.player1 === "__BYE__" ? 0 : 1;
          const s2 = match.player2 === "__BYE__" ? 0 : 1;
          const outcome = recordMatchResult(tournament, { match, roundIdx, position, bracketKey }, s1, s2);
          if (outcome.kind !== "invalid") {
            tournament = outcome.tournament;
            resolved = true;
            break; // Restart loop to capture newly cascaded BYE matches
          }
        }
      }
    }
  }

  return { type, rounds: tournament.rounds, losersBracket: tournament.losersBracket };
}

export interface MatchRef {
  match: BracketMatch;
  roundIdx: number;
  position: number;
  bracketKey: "rounds" | "losersBracket" | "grandFinal";
}

export type MatchResultOutcome =
  | { kind: "invalid"; message: string }
  | { kind: "champion"; winner: string; tournament: Tournament }
  | { kind: "grand-final-set"; tournament: Tournament }
  | { kind: "advanced"; winner: string | null; tournament: Tournament };

/**
 * Pure state transition for recording a match's score: updates the match,
 * advances the winner (and, for double elimination, drops the loser into the
 * losers bracket), and detects tournament/grand-final completion. Ported
 * verbatim from the standalone tournament tool's handleScoreSave so both the
 * standalone tool and the room activity share one implementation of the part
 * that's easy to get subtly wrong (losers-bracket round shape/advancement).
 */
export function recordMatchResult(
  tournament: Tournament,
  editingMatch: MatchRef,
  s1: number,
  s2: number
): MatchResultOutcome {
  const { match, roundIdx, position, bracketKey } = editingMatch;
  const winner = s1 > s2 ? match.player1 : s2 > s1 ? match.player2 : null;

  if (bracketKey === "grandFinal") {
    if (!winner) {
      return { kind: "invalid", message: "The Grand Final needs a decisive winner — scores must not be tied." };
    }
    return {
      kind: "champion",
      winner,
      tournament: {
        ...tournament,
        grandFinal: { ...match, score1: s1, score2: s2, winner, status: "completed" },
        winner,
      },
    };
  }

  // Ties in single or double elimination leave the bracket permanently stuck
  // because no winner can advance. Require a decisive score before proceeding.
  if (
    !winner &&
    (tournament.type === "single-elimination" || tournament.type === "double-elimination")
  ) {
    return {
      kind: "invalid",
      message: "Elimination brackets require a decisive winner — scores must not be tied.",
    };
  }

  const bracket = bracketKey === "losersBracket" ? tournament.losersBracket! : tournament.rounds;

  const updatedBracket = bracket.map((round) =>
    round.map((m) => {
      if (m.id === match.id) {
        return { ...m, score1: s1, score2: s2, winner, status: "completed" as const };
      }
      return m;
    })
  );

  if (winner && tournament.type === "single-elimination") {
    const nextRoundIdx = roundIdx + 1;
    if (nextRoundIdx < updatedBracket.length) {
      const nextPos = Math.floor(position / 2);
      updatedBracket[nextRoundIdx] = updatedBracket[nextRoundIdx].map((m) =>
        m.position === nextPos
          ? {
              ...m,
              [position % 2 === 0 ? "player1" : "player2"]: winner,
              status: m.player1 && m.player2 && m.status === "pending" ? ("in-progress" as const) : m.status,
            }
          : m
      );
    }

    const finalMatch = updatedBracket[updatedBracket.length - 1]?.[0];
    if (finalMatch?.winner) {
      return {
        kind: "champion",
        winner: finalMatch.winner,
        tournament: { ...tournament, rounds: updatedBracket, winner: finalMatch.winner },
      };
    }

    return { kind: "advanced", winner, tournament: { ...tournament, rounds: updatedBracket } };
  }

  if (winner && tournament.type === "double-elimination") {
    const loser = winner === match.player1 ? match.player2 : match.player1;
    let updatedLosersBracket = tournament.losersBracket;

    if (bracketKey === "rounds") {
      // Advance the winner within the winners bracket (unchanged shape).
      const nextRoundIdx = roundIdx + 1;
      if (nextRoundIdx < updatedBracket.length) {
        const nextPos = Math.floor(position / 2);
        updatedBracket[nextRoundIdx] = updatedBracket[nextRoundIdx].map((m) =>
          m.position === nextPos
            ? {
                ...m,
                [position % 2 === 0 ? "player1" : "player2"]: winner,
                status: m.player1 && m.player2 && m.status === "pending" ? ("in-progress" as const) : m.status,
              }
            : m
        );
      }

      // Drop the loser into the losers bracket. Round 1 losers are paired
      // against each other; later-round losers join the winner advancing
      // through the losers bracket at the same position (see
      // generateDoubleElimination for the round-shape this relies on).
      if (loser && updatedLosersBracket) {
        const rw = roundIdx + 1;
        const lb = updatedLosersBracket.map((round) => round.map((m) => ({ ...m })));
        const targetRound = rw === 1 ? 0 : 2 * rw - 3;
        const targetPos = rw === 1 ? Math.floor(position / 2) : position;
        const slot = rw === 1 ? (position % 2 === 0 ? "player1" : "player2") : "player2";

        if (lb[targetRound]?.[targetPos]) {
          lb[targetRound][targetPos] = { ...lb[targetRound][targetPos], [slot]: loser };

          // Check if the target match is now fully populated and has a BYE
          const m = lb[targetRound][targetPos];
          if (m.player1 && m.player2 && (m.player1 === "__BYE__" || m.player2 === "__BYE__")) {
            const nonBye = m.player1 === "__BYE__" ? m.player2 : m.player1;
            lb[targetRound][targetPos] = {
              ...m,
              score1: m.player1 === "__BYE__" ? 0 : 1,
              score2: m.player1 === "__BYE__" ? 1 : 0,
              winner: nonBye,
              status: "completed" as const,
            };
            // Advance the winner recursively
            advanceInLosersBracket(lb, targetRound, targetPos, nonBye);
          } else {
            // Set status if in-progress
            const m2 = lb[targetRound][targetPos];
            if (m2.player1 && m2.player2 && m2.status === "pending") {
              lb[targetRound][targetPos] = { ...m2, status: "in-progress" };
            }
          }
        }
        updatedLosersBracket = lb;
      }
    } else {
      // bracketKey === "losersBracket": advance the winner within the
      // losers bracket. Even rounds preserve position (paired against a
      // fresh drop-in from the winners bracket); odd rounds halve
      // position like a normal single-elimination advance.
      // Must build on `updatedBracket` (= the losers bracket with this
      // match already marked completed above), not a fresh copy of the
      // stale pre-update `tournament.losersBracket` — otherwise the
      // just-played match's own completed status is discarded and it
      // stays playable forever, even though its winner still advances.
      const lb = updatedBracket.map((round) => round.map((m) => ({ ...m })));
      advanceInLosersBracket(lb, roundIdx, position, winner);
      updatedLosersBracket = lb;
    }

    const winnersFinal =
      bracketKey === "rounds"
        ? updatedBracket[updatedBracket.length - 1]?.[0]
        : tournament.rounds[tournament.rounds.length - 1]?.[0];
    const losersFinal = updatedLosersBracket?.[updatedLosersBracket.length - 1]?.[0];

    if (winnersFinal?.winner && losersFinal?.winner && !tournament.grandFinal) {
      return {
        kind: "grand-final-set",
        tournament: {
          ...tournament,
          rounds: bracketKey === "rounds" ? updatedBracket : tournament.rounds,
          losersBracket: updatedLosersBracket,
          grandFinal: {
            id: generateId(),
            round: 1,
            position: 0,
            player1: winnersFinal.winner,
            player2: losersFinal.winner,
            score1: null,
            score2: null,
            winner: null,
            status: "in-progress",
          },
        },
      };
    }

    return {
      kind: "advanced",
      winner,
      tournament: {
        ...tournament,
        rounds: bracketKey === "rounds" ? updatedBracket : tournament.rounds,
        losersBracket: updatedLosersBracket,
      },
    };
  }

  if (tournament.type === "swiss" || tournament.type === "round-robin") {
    const isComplete = updatedBracket.every(r => r.every(m => m.status === "completed"));
    if (isComplete) {
      if (tournament.type === "swiss") {
        const expectedRounds = Math.min(Math.ceil(Math.log2(tournament.participants.length)), 5);
        if (updatedBracket.length < expectedRounds) {
          const nextRound = generateNextSwissRound(updatedBracket, tournament.participants);
          updatedBracket.push(nextRound);
          return { kind: "advanced", winner, tournament: { ...tournament, rounds: updatedBracket } };
        }
      }

      const standings = calculateStandings(updatedBracket, tournament.participants);
      const champion = standings[0].player;
      return {
        kind: "champion",
        winner: champion,
        tournament: { ...tournament, rounds: updatedBracket, winner: champion }
      };
    }
  }

  return { kind: "advanced", winner, tournament: { ...tournament, rounds: updatedBracket } };
}
