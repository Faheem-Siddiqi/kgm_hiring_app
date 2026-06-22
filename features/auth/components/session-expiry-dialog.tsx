"use client";

import Link from "next/link";
import { ClockAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SessionExpiryDialog({ open }: { open: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-foreground sm:mx-0">
            <ClockAlert className="size-5" />
          </div>
          <DialogTitle className="pt-2 text-xl">
            Session expired
          </DialogTitle>
          <DialogDescription>
            Your admin session has ended for security. Please sign in again to
            continue managing the hiring workspace.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-stretch">
          <Button asChild className="w-full">
            <Link href="/admin/login?expired=1">Sign in again</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
