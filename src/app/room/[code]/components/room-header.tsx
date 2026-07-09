import { useState, useEffect, memo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  currentUserId: string;
  toggleLock: () => void;
  onOpenCloseRoomDialog: () => void;
  roomType: RoomType;
  onOpenPicker: () => void;
  onResetActivity: () => void;
  onToggleSidebar: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const RoomHeader = memo(function RoomHeader({
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
  currentUserId,
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
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const roomUrl = typeof window !== "undefined" ? window.location.href : "";

  // Generated client-side (dynamically imported so the ~30KB library only
  // loads for someone who actually opens this dialog) instead of the
  // previous third-party API call — that sent every viewed room's URL,
  // including private/locked ones, to an external service with every QR
  // code request.
  useEffect(() => {
    if (!isQrOpen || !roomUrl) return;
    let cancelled = false;
    setQrLoadFailed(false);
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(roomUrl, {
          width: 200,
          margin: 1,
          color: { dark: "#07050e", light: "#ffffff" },
        })
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isQrOpen, roomUrl]);

  return (
    <div className="glass border-b border-white/5 px-6 py-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl font-bold truncate">{roomName}</h1>
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
              role="status"
              aria-live="polite"
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

        <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end shrink-0">
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
              <MessageReportsPanel roomCode={roomCode} currentUserId={currentUserId} />
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
                        onClick={() => setIsResetConfirmOpen(true)}
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

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-purple-400" />
              Room QR Code
            </DialogTitle>
          </DialogHeader>

          {isLocalOnlyMode && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 text-left">
              This room only works on this device — whoever scans this code needs to be using this
              same browser. It won&apos;t connect anyone joining from a different phone or computer.
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-4 py-2">
            {qrLoadFailed ? (
              <div className="w-[200px] h-[200px] rounded-2xl bg-muted flex flex-col items-center justify-center gap-2 text-center px-4">
                <p className="text-xs text-muted-foreground">
                  Couldn&apos;t generate the QR code. Use the room code or copied link instead.
                </p>
              </div>
            ) : qrDataUrl ? (
              <div className="p-3 bg-white rounded-2xl shadow-xl">
                {/* Generated client-side (see the useEffect above) — no
                    third party ever sees the room URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="Room QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="w-[200px] h-[200px] rounded-2xl bg-muted animate-pulse" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Scan to join the room</p>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                Room Code: {roomCode}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the current activity?</DialogTitle>
            <DialogDescription>
              This wipes the in-progress game state for everyone in the room right now — scores,
              answers, and votes so far will be lost. Everyone will see it reset immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onResetActivity();
                setIsResetConfirmOpen(false);
              }}
            >
              Reset activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
