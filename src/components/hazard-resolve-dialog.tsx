"use client";

import { FormEvent, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { db, storage } from "@/lib/firebase";
import { HazardDoc } from "@/lib/types";

export type HazardRow = HazardDoc & { id: string };

export function HazardResolveDialog({
  hazard,
  onClose,
}: {
  hazard: HazardRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!hazard} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{hazard && <ResolveForm hazard={hazard} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function ResolveForm({ hazard, onClose }: { hazard: HazardRow; onClose: () => void }) {
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      let resolutionPhotoUrl: string | undefined;
      if (photo) {
        const photoRef = ref(
          storage,
          `hazards/${hazard.reportId}/resolution-${Date.now()}-${photo.name}`
        );
        await uploadBytes(photoRef, photo);
        resolutionPhotoUrl = await getDownloadURL(photoRef);
      }

      await updateDoc(doc(db, "hazards", hazard.id), {
        status: "RESOLVED",
        resolvedBy: user.uid,
        resolvedAt: serverTimestamp(),
        ...(comment.trim() ? { resolutionComment: comment.trim() } : {}),
        ...(resolutionPhotoUrl ? { resolutionPhotoUrl } : {}),
      });
      toast.success("המפגע סומן כטופל");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "עדכון המפגע נכשל");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>סימון מפגע כטופל</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-lg bg-muted p-3 text-sm">{hazard.description}</div>

        <div className="space-y-1.5">
          <Label htmlFor="resolution-comment">תיאור הטיפול</Label>
          <Textarea
            id="resolution-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="מה בוצע כדי לתקן את המפגע..."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resolution-photo">תמונת הוכחת תיקון</Label>
          <Input
            id="resolution-photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>ביטול</DialogClose>
        <Button type="submit" disabled={submitting}>
          {submitting ? "שומר..." : "סימון כטופל"}
        </Button>
      </DialogFooter>
    </form>
  );
}
