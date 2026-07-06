import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CloseRoomDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isConfirming: boolean;
  roomCode: string;
}

export function CloseRoomDialog({
  isOpen,
  onOpenChange,
  onClose,
  onConfirm,
  isConfirming,
  roomCode,
}: CloseRoomDialogProps) {
  const [typedCode, setTypedCode] = useState("");

  const handleConfirm = () => {
    if (typedCode.toUpperCase() !== roomCode) return;
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) setTypedCode(""); onOpenChange(open); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this room?</DialogTitle>
          <DialogDescription>
            {`Everyone still here will be disconnected and sent back to Explore, and the chat history for this room will be permanently deleted. The room code ${roomCode} will stop working. This can't be undone.`}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <label htmlFor="close-room-confirm" className="text-sm font-medium text-muted-foreground">
            {`Type ${roomCode} to confirm:`}
          </label>
          <Input
            id="close-room-confirm"
            value={typedCode}
            onChange={(e) => setTypedCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder={roomCode}
            maxLength={6}
            className="mt-2"
            aria-label={`Type ${roomCode} to confirm closing this room`}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isConfirming || typedCode.toUpperCase() !== roomCode}
          >
            {isConfirming ? "Closing..." : "Close room for everyone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
