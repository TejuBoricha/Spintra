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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { RoomType } from "@/lib/types";

interface RoomHeaderProps {
  roomName: string;
  realtimeStatusClass: string;
  realtimeStatusLabel: string;
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
          {isHost && (
            <>
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
    </div>
  );
}
