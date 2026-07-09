"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Grid3x3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";
import { generateBingoCard as generateCard, BINGO_LINES as LINES, BINGO_COLUMNS as COLUMNS } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/** Persist the card to the database so the host can verify win claims. */
async function saveCardToDb(roomCode: string, userId: string, card: number[][]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase
    .from("room_participants")
    .update({ bingo_card: card })
    .eq("room_id", roomCode)
    .eq("user_id", userId);
}

/** Host-side verification: fetch the claimer's card from the DB and check
 *  that at least one winning line is fully covered by the called numbers.
 *  Keyed on user_id, not username — usernames aren't guaranteed unique in
 *  this app (the default "Guest" name, or two players who picked the same
 *  custom name, would otherwise let a lookup match the wrong participant's
 *  card, or error out on more than one row matching .maybeSingle()). */
async function verifyBingoWin(
  roomCode: string,
  claimerUserId: string,
  calledNumbers: number[],
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return true; // demo mode — trust the claim
  const { data } = await supabase
    .from("room_participants")
    .select("bingo_card")
    .eq("room_id", roomCode)
    .eq("user_id", claimerUserId)
    .maybeSingle();
  if (!data?.bingo_card) return false;
  const card = data.bingo_card as number[][];
  const calledSet = new Set(calledNumbers);
  return LINES.some((line) =>
    line.every(([col, row]) => (col === 2 && row === 2) || calledSet.has(card[col][row])),
  );
}

export function BingoActivity() {
  const { roomCode, isHost, sendActivityEvent, registerEventListener, currentUser, flushActivityState, awardScore } = useRoomActivity();

  const [bingoCalled, setBingoCalled] = useState<number[]>([]);
  const [bingoWinner, setBingoWinner] = useState<string | null>(null);
  // Disables "Call Next Number" between click and the corresponding
  // bingo_call event round-tripping back — unlike Lucky Wheel/Word Scramble,
  // this button previously had no in-flight lock at all: a fast double-click
  // could read the same "remaining numbers" snapshot twice and call a
  // number twice, or otherwise race win-detection.
  const [isCalling, setIsCalling] = useState(false);

  const [card, setCard] = useState<number[][]>(() => generateCard());
  const hasCalledBingoRef = useRef(false);
  // Scoreboard/XP (ADR-008/009): guards this client's own award_score('bingo')
  // call against firing again on a later replay of its own already-verified
  // win (e.g. a reconnect within the same round) — award_score's own
  // idempotency is the real correctness backstop, this just avoids a
  // redundant RPC call. Separate from hasCalledBingoRef, which guards the
  // bingo_win CLAIM broadcast, not the award call.
  const hasAwardedBingoRef = useRef(false);
  const prevCalledLenRef = useRef(0);

  // registerEventListener replays the full event log on every call — the
  // listener effect below must stay registered exactly once per mount
  // (matching every other activity's identical effect), not re-run when
  // isHost/bingoWinner/bingoCalled change, or each state change would
  // re-subscribe, replay every past bingo_call event again, grow
  // bingoCalled again, and trigger another re-run — an infinite loop that
  // crashes the tab the moment a host calls the first number. Refs let the
  // listener closure read current values without being a dependency;
  // synced via effect (not assigned during render) per this project's
  // React Compiler rules.
  const isHostRef = useRef(isHost);
  const bingoWinnerRef = useRef(bingoWinner);
  const bingoCalledRef = useRef(bingoCalled);
  const currentUserIdRef = useRef(currentUser.id);
  const flushActivityStateRef = useRef(flushActivityState);
  const awardScoreRef = useRef(awardScore);
  useEffect(() => {
    isHostRef.current = isHost;
    bingoWinnerRef.current = bingoWinner;
    bingoCalledRef.current = bingoCalled;
    currentUserIdRef.current = currentUser.id;
    flushActivityStateRef.current = flushActivityState;
    awardScoreRef.current = awardScore;
  }, [isHost, bingoWinner, bingoCalled, currentUser.id, flushActivityState, awardScore]);

  // Load card from localStorage to handle reconnect stability
  useEffect(() => {
    if (typeof window !== "undefined" && roomCode) {
      const key = `spintra-bingo-card-${roomCode}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as number[][];
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCard(parsed);
          saveCardToDb(roomCode, currentUser.id, parsed);
          return;
        } catch (e) {
          console.error("Failed to parse stored bingo card:", e);
        }
      }
      const newCard = generateCard();
      localStorage.setItem(key, JSON.stringify(newCard));
      setCard(newCard);
      saveCardToDb(roomCode, currentUser.id, newCard);
    }
  }, [roomCode, currentUser.id]);

  useEffect(() => {
    return registerEventListener((event) => {
      switch (event.kind) {
        case "bingo_call": {
          setBingoCalled((prev) => [...prev, event.number]);
          setIsCalling(false);
          break;
        }
        case "bingo_win": {
          // Two players can each independently detect their own win and
          // broadcast it before either has seen the other's event (no
          // server-side arbitration). Keeping only the first one received
          // per client — instead of always overwriting with whichever
          // arrived most recently — stops a client from flip-flopping which
          // name it shows as more of these events trickle in.
          if (isHostRef.current && !bingoWinnerRef.current) {
            // Host verifies the claim before accepting it
            verifyBingoWin(roomCode, event.userId, bingoCalledRef.current).then((valid) => {
              if (valid) {
                setBingoWinner((prev) => prev ?? event.username);
                sendActivityEvent({ kind: "bingo_verified", username: event.username, userId: event.userId });
              } else {
                toast.info(`${event.username}'s Bingo claim could not be verified.`);
              }
            });
          }
          break;
        }
        case "bingo_verified": {
          setBingoWinner((prev) => prev ?? event.username);
          // Scoreboard/XP (ADR-008/009): the winning client's own award call,
          // triggered once it sees its OWN win named here — the host's
          // verification above is only a client-side trigger point, not a
          // security boundary; award_score() independently re-verifies the
          // claim server-side regardless of who calls it or why. Flush first
          // since that server-side check reads the persisted call log
          // directly (see flushActivityState's doc comment).
          if (event.userId && event.userId === currentUserIdRef.current && !hasAwardedBingoRef.current) {
            hasAwardedBingoRef.current = true;
            flushActivityStateRef.current()
              .then((flushed) => {
                // A failed flush means the persisted called-numbers state
                // this win's server-side verification would read may be
                // stale — don't award against it. Reset the guard so a
                // later bingo_verified replay (e.g. on reconnect) gets
                // another chance, rather than permanently skipping this win.
                if (!flushed) {
                  hasAwardedBingoRef.current = false;
                  return;
                }
                return awardScoreRef.current("bingo");
              })
              .catch((err) => {
                console.error("Failed to award Bingo score:", err);
                hasAwardedBingoRef.current = false;
              });
          }
          break;
        }
        case "bingo_reset":
          setBingoCalled([]);
          setBingoWinner(null);
          setIsCalling(false);
          hasAwardedBingoRef.current = false;
          break;
        case "activity_reset":
          setBingoCalled([]);
          setBingoWinner(null);
          setIsCalling(false);
          hasAwardedBingoRef.current = false;
          break;
      }
    });
    // roomCode/sendActivityEvent deliberately excluded — see the comment on
    // isHostRef/bingoWinnerRef/bingoCalledRef above for why this effect
    // must not re-run on every state change; both are stable for this
    // component's lifetime, so the closure captured at mount stays valid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerEventListener]);

  useEffect(() => {
    if (bingoCalled.length === 0 && prevCalledLenRef.current > 0) {
      const newCard = generateCard();
      if (typeof window !== "undefined" && roomCode) {
        localStorage.setItem(`spintra-bingo-card-${roomCode}`, JSON.stringify(newCard));
      }
      setCard(newCard);
      saveCardToDb(roomCode, currentUser.id, newCard);
      hasCalledBingoRef.current = false;
    }
    prevCalledLenRef.current = bingoCalled.length;
  }, [bingoCalled, roomCode, currentUser.id]);

  const isMarked = useCallback(
    (col: number, row: number) => (col === 2 && row === 2) || bingoCalled.includes(card[col][row]),
    [card, bingoCalled]
  );

  useEffect(() => {
    if (hasCalledBingoRef.current || bingoWinner) return;
    const gotBingo = LINES.some((line) => line.every(([col, row]) => isMarked(col, row)));
    if (gotBingo) {
      hasCalledBingoRef.current = true;
      sendActivityEvent({ kind: "bingo_win", username: currentUser.username, userId: currentUser.id });
    }
  }, [bingoCalled, bingoWinner, isMarked, sendActivityEvent, currentUser.username, currentUser.id]);

  const lastCalled = bingoCalled[bingoCalled.length - 1];
  const columnFor = (n: number) => COLUMNS[Math.floor((n - 1) / 15)];

  return (
    <motion.div
      key="bingo"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-xl mx-auto pt-8 w-full"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Grid3x3 className="w-6 h-6 text-cyan-400" /> Bingo
      </h2>
      {bingoWinner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl w-full max-w-xs"
        >
          <p className="text-sm text-emerald-300 font-semibold uppercase tracking-wider mb-1">Bingo Winner!</p>
          <p className="text-2xl font-black text-emerald-400 flex items-center justify-center gap-2">
            {bingoWinner} <Emoji name="party_popper" size={26} pop />
          </p>
        </motion.div>
      )}
      {/* Same "waiting for host" cue 11 of 14 activities already show —
          without it a guest just sees an inert card with no hint that only
          the host can call numbers. */}
      {!isHost && bingoCalled.length === 0 && !bingoWinner && (
        <EmptyState icon={<Emoji name="bullseye" size={48} />} description="Waiting for host to call the first number…" />
      )}
      {lastCalled && !bingoWinner && (
        <motion.div
          key={lastCalled}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          role="status"
          aria-live="polite"
          className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 border border-cyan-400/40 shadow-xl shadow-cyan-500/10 text-white select-none"
        >
          <span className="text-[10px] uppercase font-bold tracking-widest leading-none text-cyan-200/80 mb-0.5">Called</span>
          <span className="text-2xl font-black">{columnFor(lastCalled)}-{lastCalled}</span>
        </motion.div>
      )}

      {/* Bingo card layout matching standalone premium grid style */}
      <div className="glass-card p-5 rounded-3xl border border-border shadow-2xl bg-gradient-to-br from-white/[0.01] to-white/[0.03]">
        <div className="grid grid-cols-5 gap-2 mb-2">
          {COLUMNS.map((col) => (
            <div
              key={col}
              className="w-12 h-8 flex items-center justify-center font-black text-cyan-400 text-base tracking-wider uppercase select-none"
            >
              {col}
            </div>
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-5 gap-2">
            {COLUMNS.map((_, col) => {
              const marked = isMarked(col, row);
              const isFree = col === 2 && row === 2;

              let styleClass = "border-border text-muted-foreground bg-muted/30";
              if (marked) {
                styleClass = isFree
                  ? "bg-amber-500/20 border-amber-500 text-amber-200 shadow-amber-500/10"
                  : "bg-cyan-500/20 border-cyan-500 text-cyan-200 shadow-cyan-500/10";
              }

              return (
                <div
                  key={col}
                  className={`w-12 h-12 flex items-center justify-center rounded-xl text-sm font-bold border transition-all duration-300 select-none ${styleClass}`}
                >
                  {isFree ? (
                    <Emoji name="trophy" size={20} animated={false} />
                  ) : (
                    card[col][row]
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isHost && (
        <div className="flex flex-col items-center gap-2 w-full">
          {bingoCalled.length === 0 && !bingoWinner && (
            <p className="text-xs text-muted-foreground">Press Call Next Number to start the game</p>
          )}
          <div className="flex gap-4 w-full justify-center">
          <Button
            disabled={isCalling || bingoCalled.length >= 75 || !!bingoWinner}
            onClick={() => {
              const remaining = Array.from({ length: 75 }, (_, i) => i + 1).filter(
                (n) => !bingoCalled.includes(n)
              );
              if (remaining.length === 0) return;
              setIsCalling(true);
              const number = remaining[Math.floor(Math.random() * remaining.length)];
              sendActivityEvent({ kind: "bingo_call", number });
            }}
            className="h-11 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border-0 rounded-full font-bold shadow-lg shadow-cyan-500/10"
          >
            Call Next Number
          </Button>

          {bingoCalled.length > 0 && (
            <Button
              onClick={() => {
                sendActivityEvent({ kind: "bingo_reset" });
              }}
              variant="outline"
              className="h-11 px-5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 rounded-full transition-all"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
          )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
