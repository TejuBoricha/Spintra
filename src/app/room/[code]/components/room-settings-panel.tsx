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
import { ROOM_MIN_CAPACITY, ROOM_MAX_CAPACITY, ROOM_DEFAULT_CAPACITY } from "@/lib/room-config";
import { toast } from "sonner";

// The authoritative current values of the editable fields, read from the DB
// when the dialog opens. Save diffs the form against this so it only writes
// fields the host actually changed — never clobbering an untouched field with
// a stale/default form value.
interface RoomSettingsBaseline {
  name: string;
  isPublic: boolean;
  maxParticipants: number;
}

// Host-only "edit what I created" surface (ADR-007). Exposes the room's
// creation-time settings — name, capacity, visibility — plus a mirror of the
// lock toggle, for editing after creation. Deliberately excludes changing the
// game type (that wipes activity state and is its own scoped feature).
// Structurally mirrors the other host header panels (icon trigger → Dialog).
//
// name / capacity / visibility are committed together via an explicit Save,
// but only the fields that differ from the freshly-loaded baseline are written
// (discrete `rooms` columns, which the existing rooms UPDATE realtime handler
// propagates to everyone). Lock is a live switch reusing the parent's
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
  const [maxParticipants, setMaxParticipants] = useState(maxParticipantsLimit ?? ROOM_DEFAULT_CAPACITY);
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Set once the DB read succeeds; Save is disabled until it exists, so the
  // host can never save (and clobber) against values we never confirmed.
  const [baseline, setBaseline] = useState<RoomSettingsBaseline | null>(null);

  // No `rooms` table to read/write in local-only (demo) mode. Lock still works
  // through the parent's toggleLock (BroadcastChannel), but name/capacity/
  // visibility have no shared backend, so those are shown disabled with a note
  // rather than silently pretending to save.
  const isOnlineRoom = getSupabaseBrowserClient() !== null;

  // Capacity can never drop below the number of people already in the room —
  // the DB CHECK only bounds 2..50, it doesn't know the live occupancy, so
  // this floor is enforced here.
  const capacityFloor = Math.max(ROOM_MIN_CAPACITY, onlineCount);

  // Every editable field is disabled while the current values are loading or
  // if that load failed — editing before we know the true stored values is how
  // an untouched field gets clobbered on Save.
  const fieldsDisabled = !isOnlineRoom || isSaving || isLoading || loadError;

  // Seed the form for an instant first paint and reset transient state. The
  // real values are (re)loaded from the DB by the effect below; setState is
  // done here in the open handler (a user event) rather than in the effect
  // body, which would trip the React Compiler's set-state-in-effect rule.
  const openPanel = useCallback(() => {
    const online = getSupabaseBrowserClient() !== null;
    setName(roomName);
    setMaxParticipants(maxParticipantsLimit ?? ROOM_DEFAULT_CAPACITY);
    setBaseline(null);
    setLoadError(false);
    setIsLoading(online);
    setIsOpen(true);
  }, [roomName, maxParticipantsLimit]);

  // Load the authoritative current values (name, is_public, max_participants)
  // whenever the dialog opens. All setState happens in the async settlement
  // handlers (never synchronously in the effect body), and BOTH settlement
  // paths — resolve-with-error and outright rejection — clear isLoading, so a
  // failed read can never leave the panel stuck disabled forever.
  useEffect(() => {
    if (!isOpen) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("rooms")
      .select("name, is_public, max_participants")
      .eq("code", roomCode)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (cancelled) return;
          if (error || !data) {
            setLoadError(true);
            setIsLoading(false);
            return;
          }
          const loaded: RoomSettingsBaseline = {
            name: data.name ?? "",
            isPublic: !!data.is_public,
            maxParticipants: data.max_participants ?? ROOM_DEFAULT_CAPACITY,
          };
          setName(loaded.name);
          setIsPublic(loaded.isPublic);
          setMaxParticipants(loaded.maxParticipants);
          setBaseline(loaded);
          setIsLoading(false);
        },
        () => {
          if (cancelled) return;
          setLoadError(true);
          setIsLoading(false);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [isOpen, roomCode]);

  const handleSave = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    // No baseline means we never confirmed the current values — refuse to save
    // rather than risk overwriting a field with a stale/default form value.
    if (!supabase || !baseline) return;

    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Room name can't be empty.");
      return;
    }
    if (maxParticipants < capacityFloor) {
      toast.error(
        onlineCount > ROOM_MIN_CAPACITY
          ? `Capacity can't be below the ${onlineCount} people currently in the room.`
          : `Capacity must be at least ${ROOM_MIN_CAPACITY}.`
      );
      return;
    }
    if (maxParticipants > ROOM_MAX_CAPACITY) {
      toast.error(`Capacity can't exceed ${ROOM_MAX_CAPACITY}.`);
      return;
    }

    // Only write fields the host actually changed — an untouched field is
    // never sent, so it can't be clobbered.
    const patch: { name?: string; is_public?: boolean; max_participants?: number } = {};
    if (trimmed !== baseline.name) patch.name = trimmed;
    if (isPublic !== baseline.isPublic) patch.is_public = isPublic;
    if (maxParticipants !== baseline.maxParticipants) patch.max_participants = maxParticipants;

    if (Object.keys(patch).length === 0) {
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("rooms").update(patch).eq("code", roomCode);
      if (error) throw error;
      toast.success("Room settings updated.");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update room settings:", error);
      toast.error("Couldn't save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [name, maxParticipants, capacityFloor, onlineCount, isPublic, baseline, roomCode]);

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

            {loadError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                Couldn&apos;t load this room&apos;s current settings. Close this dialog and try again.
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
                disabled={fieldsDisabled}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="settings-max-participants">Max participants</Label>
                <span className="text-sm font-semibold text-(--brand-primary-strong)">
                  {maxParticipants} people
                </span>
              </div>
              <Slider
                id="settings-max-participants"
                min={capacityFloor}
                max={ROOM_MAX_CAPACITY}
                value={[maxParticipants]}
                onValueChange={(v) => setMaxParticipants(Array.isArray(v) ? v[0] : v)}
                disabled={fieldsDisabled}
              />
              {onlineCount > ROOM_MIN_CAPACITY && (
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
                disabled={fieldsDisabled}
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
            <Button onClick={handleSave} disabled={fieldsDisabled || !baseline}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
