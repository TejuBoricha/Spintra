"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Volume2, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTheme } from "@/components/theme-provider";
import { getOrCreateRoomUser, updateRoomUsername, clearAllLocalUserData } from "@/lib/room-user";
import { safeStorageGet, safeStorageSet } from "@/lib/utils";

const SOUND_STORAGE_KEY = "spintra-room-sound";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const username = getOrCreateRoomUser().username;
    const savedSound = safeStorageGet(SOUND_STORAGE_KEY);
    queueMicrotask(() => {
      setMounted(true);
      setDisplayName(username);
      if (savedSound !== null) setSoundEnabled(savedSound === "true");
    });
  }, []);

  const saveDisplayName = useCallback(() => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setDisplayName(getOrCreateRoomUser().username);
      return;
    }
    const updated = updateRoomUsername(trimmed);
    setDisplayName(updated.username);
    toast.success("Display name updated!", { id: "settings-username" });
  }, [displayName]);

  const handleToggleSound = useCallback((next: boolean) => {
    setSoundEnabled(next);
    safeStorageSet(SOUND_STORAGE_KEY, String(next));
    toast.info(next ? "Sound effects enabled!" : "Sound effects muted!", { id: "settings-sound" });
  }, []);

  const handleDeleteData = useCallback(() => {
    clearAllLocalUserData();
    setIsDeleteOpen(false);
    toast.success("Your local data has been deleted.", { id: "settings-delete" });
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-foreground">
          Settings
        </h1>

        {/* Profile */}
        <section className="p-6 border border-(--border-hairline) bg-(--surface-panel) rounded-2xl space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">Profile</h2>
          <div className="flex items-start gap-4">
            <Avatar size="lg" className="mt-6">
              <AvatarFallback className="bg-(image:--gradient-avatar) text-white font-display font-bold">
                {displayName.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="settings-display-name">Display name</Label>
              <Input
                id="settings-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={saveDisplayName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                maxLength={24}
                placeholder="Your name"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            No account required — this name is remembered on this device only.
          </p>
        </section>

        {/* Preferences */}
        <section className="p-6 border border-(--border-hairline) bg-(--surface-panel) rounded-2xl space-y-5">
          <h2 className="font-display text-lg font-bold text-foreground">Preferences</h2>

          <div className="flex items-center justify-between">
            <Label htmlFor="settings-sound" className="flex items-center gap-2 cursor-pointer font-normal">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              Sound effects
            </Label>
            <Switch id="settings-sound" checked={soundEnabled} onCheckedChange={handleToggleSound} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="settings-theme" className="font-normal">Theme</Label>
            {mounted ? (
              <Select value={theme} onValueChange={(v) => setTheme(v as "dark" | "light")}>
                <SelectTrigger id="settings-theme" className="w-32">
                  <SelectValue>{theme === "dark" ? "Dark" : "Light"}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} sideOffset={6}>
                  <SelectGroup>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <div className="w-32 h-10 rounded-md border border-input bg-transparent" />
            )}
          </div>
        </section>

        {/* Privacy */}
        <section className="p-6 border border-(--border-hairline) bg-(--surface-panel) rounded-2xl space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-(--brand-primary-strong)" />
            Privacy
          </h2>
          <p className="text-sm text-muted-foreground">
            Read the{" "}
            <Link href="/legal/privacy" className="text-(--brand-primary-strong) font-semibold underline underline-offset-2">
              Privacy Policy
            </Link>{" "}
            for what&apos;s stored and for how long.
          </p>
          <Button variant="destructive" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => setIsDeleteOpen(true)}>
            Delete my data
          </Button>
        </section>
      </div>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete my data?</DialogTitle>
            <DialogDescription>
              This clears your display name, preferences, and room history from this device.
              It can&apos;t be undone, and you&apos;ll be assigned a new guest name.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteData}>
              Delete data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
