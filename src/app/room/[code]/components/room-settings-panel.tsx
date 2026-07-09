"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// Product ceiling for room capacity — enforced at the database by migration
// 0049 (CHECK 2..50). Kept in sync with the creation slider in
// create-client.tsx; both inherit the same authoritative DB bound.
const MIN_CAPACITY = 2;
const MAX_CAPACITY = 50;

// Host-only "edit what I created" surface (ADR-007). Exposes the room's
// creation-time settings — name, capacity, visibility — plus a mirror of the
// lock toggle, for editing after creation. Deliberately excludes changing the
// game type (that wipes activity state and is its own scoped feature).
// Structurally mirrors the other host header panels (icon trigger → Dialog).
//
// name / capacity / visibility are committed together via an explicit Save
// (writing discrete `rooms` columns, which the existing rooms UPDATE realtime
// handler propagates to everyone). Lock is a live switch reusing the parent's
// `toggleLock` so its behavior — optimistic update + demo-mode broadcast —
// stays identical to the header's lock button.
export function RoomSettingsPanel({
  roomCode,
  roomName,
  isLocked,
  maxParticipantsLimit,
  onlineCount,
  toggleLock,
}: {
  roomCode: string;
  roomName: string;
  isLocked: boolean;
  maxParticipantsLimit: number | null;
  onlineCount: number;
  toggleLock: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(roomName);
  const [maxParticipants, setMaxParticipants] = useState(maxParticipantsLimit ?? 10);
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // No `rooms` table to read/write in local-only (demo) mode. Lock still works
  // through the parent's toggleLock (BroadcastChannel), but name/capacity/
  // visibility have no shared backend, so those are shown disabled with a note
  // rather than silently pretending to save.
  const isOnlineRoom = getSupabaseBrowserClient() !== null;

  // Capacity can never drop below the number of people already in the room —
  // the DB CHECK only bounds 2..50, it doesn't know the live occupancy, so
  // this floor is enforced here.
  const capacityFloor = Math.max(MIN_CAPACITY, onlineCount);

  // (Re)initialize the form from the current live values when the host opens
  // the dialog. Done here in the open handler (a user event) rather than in an
  // effect — resetting derived form state synchronously inside an effect body
  // trips the React Compiler's set-state-in-effect rule and causes cascading
  // renders.
  const openPanel = useCallback(() => {
    setName(roomName);
    setMaxParticipants(maxParticipantsLimit ?? 10);
    // is_public isn't in room state; fetched by the effect below. Show the
    // loading state only for online rooms (demo mode has nothing to fetch).
    setIsLoading(getSupabaseBrowserClient() !== null);
    setIsOpen(true);
  }, [roomName, maxParticipantsLimit]);

  // Fetch is_public (the one field not tracked in room state) whenever the
  // dialog is open. setState lives only in the async callback, never
  // synchronously in the effect body.
  useEffect(() => {
    if (!isOpen) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("rooms")
      .select("is_public")
      .eq("code", roomCode)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setIsPublic(!!data.is_public);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, roomCode]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Room name can't be empty.");
      return;
    }
    if (maxParticipants < capacityFloor) {
      toast.error(
        onlineCount > MIN_CAPACITY
          ? `Capacity can't be below the ${onlineCount} people currently in the room.`
          : `Capacity must be at least ${MIN_CAPACITY}.`
      );
      return;
    }
    if (maxParticipants > MAX_CAPACITY) {
      toast.error(`Capacity can't exceed ${MAX_CAPACITY}.`);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ name: trimmed, is_public: isPublic, max_participants: maxParticipants })
        .eq("code", roomCode);
      if (error) throw error;
      toast.success("Room settings updated.");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update room settings:", error);
      toast.error("Couldn't save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [name, maxParticipants, capacityFloor, onlineCount, isPublic, roomCode]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              onClick={openPanel}
              aria-label="Room settings"
            />
          }
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>Room settings</TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Room Settings</DialogTitle>
            <DialogDescription>
              Change your room&apos;s name, size, and visibility. Everyone in the room sees updates
              instantly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {!isOnlineRoom && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                This room only works on this device, so name, size, and visibility can&apos;t be
                changed here. You can still lock or unlock it below.
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="settings-room-name">Room name</Label>
              <Input
                id="settings-room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="My Awesome Room"
                disabled={!isOnlineRoom || isSaving}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="settings-max-participants">Max participants</Label>
                <span className="text-sm font-semibold text-purple-400">
                  {maxParticipants} people
                </span>
              </div>
              <Slider
                id="settings-max-participants"
                min={capacityFloor}
                max={MAX_CAPACITY}
                value={[maxParticipants]}
                onValueChange={(v) => setMaxParticipants(Array.isArray(v) ? v[0] : v)}
                disabled={!isOnlineRoom || isSaving}
              />
              {onlineCount > MIN_CAPACITY && (
                <p className="text-[11px] text-muted-foreground">
                  Can&apos;t go below {onlineCount} — that&apos;s how many people are here now.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="settings-public" className="flex items-center gap-2 cursor-pointer">
                <Globe className="w-4 h-4 text-muted-foreground" />
                Public room
              </Label>
              <Switch
                id="settings-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={!isOnlineRoom || isSaving || isLoading}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Label htmlFor="settings-lock" className="flex items-center gap-2 cursor-pointer">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Lock room (block new joins)
              </Label>
              <Switch
                id="settings-lock"
                checked={isLocked}
                onCheckedChange={(next) => {
                  if (next !== isLocked) toggleLock();
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isOnlineRoom || isSaving || isLoading}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
