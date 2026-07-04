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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this room?</DialogTitle>
          <DialogDescription>
            {`Everyone still here will be disconnected and sent back to Explore, and the chat history for this room will be permanently deleted. The room code ${roomCode} will stop working. This can't be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? "Closing..." : "Close room for everyone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
