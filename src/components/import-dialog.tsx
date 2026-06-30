"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { createImport } from "@/app/(app)/import/actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createImport(new FormData(e.currentTarget));
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
    if (result.warning) {
      // Soft note: stored but processing didn't trigger.
      window.alert(result.warning);
    }
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Upload />
        Upload file
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import a file</DialogTitle>
            <DialogDescription>
              Upload an Excel or PDF a label shared (e.g. via a private link).
              It&apos;s stored and sent to n8n for extraction into the catalog.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="import-file">
                File<span className="ml-0.5 text-accent">*</span>
              </Label>
              <input
                id="import-file"
                name="file"
                type="file"
                required
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="block w-full cursor-pointer rounded-md border border-border bg-background/60 text-sm text-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hover"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-sender">Sender email</Label>
              <Input
                id="import-sender"
                name="sender_email"
                type="email"
                placeholder="label@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-context">Context / notes</Label>
              <textarea
                id="import-context"
                name="context"
                rows={4}
                placeholder="Anything useful for extraction — which label, what the file contains, special instructions…"
                className="flex w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
              />
            </div>

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Uploading…" : "Upload & process"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
