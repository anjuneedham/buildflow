"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteMyAccount } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DELETE_CONFIRMATION } from "@/lib/account";

/** Delete account, inside the app (a Google Play requirement). Owners are told their business goes with it. */
export function DeleteAccount({ businessName, isOwner }: { businessName: string | null; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const ready = typed.trim() === DELETE_CONFIRMATION;
  return (
    <section aria-labelledby="delete-h" className="rounded-xl border border-red-200 bg-white p-4">
      <h2 id="delete-h" className="font-bold text-site-red">Delete my account</h2>
      <p className="mt-1 text-sm text-ink-600">
        {isOwner
          ? `This permanently deletes your account and ${businessName ?? "your business"}: its customers, leads, jobs, photos, posts and reviews. Your team members lose access. This can't be undone.`
          : "This permanently deletes your account, your saved work and your request history. This can't be undone."}
      </p>
      <Button variant="outline" className="mt-3 border-red-300 text-site-red" onClick={() => { setOpen(true); setError(undefined); }}><Trash2 className="h-4 w-4" />Delete my account</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <div className="space-y-3 text-sm text-ink-600">
          <p>{isOwner ? "Everything in your business will be erased, including photos and reviews customers wrote about you." : "Your profile, saved items and notifications will be erased."}</p>
          <Field label={`Type ${DELETE_CONFIRMATION} to confirm`} htmlFor="delete-confirm">
            <Input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </Field>
          <FormError message={error} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!ready || pending} onClick={() => start(async () => {
              try {
                const r = await deleteMyAccount(typed);
                if (!r.ok) { setError(r.error); return; }
                // Full page load so every client-side cache starts clean.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign("/account-deleted");
              } catch {
                setError("We couldn't delete your account. Check your connection and try again.");
              }
            })}>{pending ? "Deleting…" : "Delete forever"}</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
