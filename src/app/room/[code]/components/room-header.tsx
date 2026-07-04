import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Wifi,
  Lock,
  Unlock,
  Copy,
  Check,
  DoorClosed,
  Shuffle,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
  QrCode,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { MessageReportsPanel } from "./message-reports-panel";
import type { RoomType } from "@/lib/types";

interface RoomHeaderProps {
  roomName: string;
  realtimeStatusClass: string;
  realtimeStatusLabel: string;
  isLocalOnlyMode: boolean;
  isLocked: boolean;
  roomCode: string;
  onlineCount: number;
  maxParticipantsLimit: number | null;
  activeActivityType?: string;
  realtimeError: string | null;
  notification: string | null;
  copied: boolean;
  copyRoomLink: () => void;
  isHost: boolean;
  toggleLock: () => void;
  onOpenCloseRoomDialog: () => void;
  roomType: RoomType;
  onOpenPicker: () => void;
  onResetActivity: () => void;
  onToggleSidebar: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

export function RoomHeader({
  roomName,
  realtimeStatusClass,
  realtimeStatusLabel,
  isLocalOnlyMode,
  isLocked,
  roomCode,
  onlineCount,
  maxParticipantsLimit,
  activeActivityType,
  realtimeError,
  notification,
  copied,
  copyRoomLink,
  isHost,
  toggleLock,
  onOpenCloseRoomDialog,
  roomType,
  onOpenPicker,
  onResetActivity,
  onToggleSidebar,
  soundEnabled,
  toggleSound,
}: RoomHeaderProps) {
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const roomUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  return (
    <div className="glass border-b border-white/5 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{roomName}</h1>
            <Badge className={`text-xs ${realtimeStatusClass}`}>
              <Wifi className="w-3 h-3 mr-1" />
              {realtimeStatusLabel}
            </Badge>
            {isLocked && (
              <Badge className="text-xs bg-amber-500/10 text-amber-300">
                <Lock className="w-3 h-3 mr-1" />
                Locked
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <span>
              Code:{" "}
              <span className="font-mono text-purple-400 select-all font-semibold uppercase">
                {roomCode}
              </span>
            </span>
            <span>·</span>
            <span>
              {onlineCount}
              {maxParticipantsLimit ? ` / ${maxParticipantsLimit}` : ""} online
            </span>
            {activeActivityType && (
              <>
                <span>·</span>
                <span className="text-purple-400 capitalize">
                  {activeActivityType.replace(/-/g, " ")}
                </span>
              </>
            )}
          </div>
          {(realtimeError || notification) && (
            <div
              className={`mt-3 rounded-xl border px-3 py-2 text-sm transition-all ${
                realtimeError
                  ? "border-red-500/20 bg-red-500/10 text-red-200"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {realtimeError || notification}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyRoomLink}
                  aria-label="Copy room link"
                />
              }
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </TooltipTrigger>
            <TooltipContent>{copied ? "Link copied!" : "Copy room link"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsQrOpen(true)}
                  aria-label="Show room QR Code"
                />
              }
            >
              <QrCode className="w-4 h-4 text-purple-400" />
            </TooltipTrigger>
            <TooltipContent>Show room QR Code</TooltipContent>
          </Tooltip>
          {isHost && (
            <>
              <MessageReportsPanel roomCode={roomCode} />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleLock}
                      aria-label="Toggle room lock state"
                    />
                  }
                >
                  {isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />}
                </TooltipTrigger>
                <TooltipContent>
                  {isLocked ? "Unlock room (allow new joins)" : "Lock room (block new joins)"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onOpenCloseRoomDialog}
                      aria-label="Close room for everyone"
                      className="text-red-400 hover:text-red-300"
                    />
                  }
                >
                  <DoorClosed className="w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent>Close room for everyone</TooltipContent>
              </Tooltip>
              {(roomType === "party" || roomType === "classroom") && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenPicker}
                        aria-label="Switch game activity"
                        className="text-purple-400"
                      />
                    }
                  >
                    <Shuffle className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>Switch game activity</TooltipContent>
                </Tooltip>
              )}
              {activeActivityType && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onResetActivity}
                        aria-label="Reset current activity"
                        className="text-red-400"
                      />
                    }
                  >
                    <RotateCcw className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>End current activity</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSidebar}
                  aria-label="Toggle chat and participants sidebar"
                />
              }
            >
              <Users className="w-4 h-4" />
            </TooltipTrigger>
            <TooltipContent>Chat & participants</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSound}
                  aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
                  className="text-muted-foreground hover:text-white"
                />
              }
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-purple-400" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </TooltipTrigger>
            <TooltipContent>{soundEnabled ? "Mute sounds" : "Unmute sounds"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* QR Code Dialog Overlay - Rendered in Portal at document.body */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isQrOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsQrOpen(false)}
                className="absolute inset-0 bg-[#07050e]/60 backdrop-blur-md"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-[#f8f8fc] dark:bg-[#0c0c14] border border-black/10 dark:border-white/10 shadow-2xl relative z-10 text-center space-y-6 rounded-3xl max-w-sm w-full p-6 text-foreground"
              >
                <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-3">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-purple-400" />
                    Room QR Code
                  </h3>
                  <button
                    onClick={() => setIsQrOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isLocalOnlyMode && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 text-left">
                    This room only works on this device — whoever scans this code needs to be using this
                    same browser. It won&apos;t connect anyone joining from a different phone or computer.
                  </div>
                )}

                <div className="flex flex-col items-center justify-center space-y-4 py-2">
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    {/* Generate QR code using a high speed, reliable standard API */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(roomUrl)}&color=07050e&margin=10`}
                      alt="Room QR Code"
                      width={200}
                      height={200}
                      className="rounded-lg object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Scan to join the room</p>
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                      Room Code: {roomCode}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => setIsQrOpen(false)}
                  className="w-full h-11 bg-secondary hover:bg-secondary/85 text-secondary-foreground border border-border rounded-xl font-bold transition-colors"
                >
                  Close
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
