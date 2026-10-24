"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { submitReview } from "@/app/actions/reviews";
import { Field, FormError, Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ReviewForm({ token, defaultName, existing }: { token: string; defaultName: string; existing: { rating: number; body: string } | null }) {
  const [state, action] = useFormAction(submitReview.bind(null, token), {} as ActionState, { refresh: false });
  const [rating, setRating] = useState(existing?.rating ?? 0);
  if (state.ok) {
    return (
      <div className="flex flex-col items-center py-4 text-center" role="status">
        <CheckCircle2 className="h-12 w-12 text-site-green" />
        <p className="mt-3 text-lg font-bold">{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Your rating</legend>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-1" title={LABELS[n]}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" aria-label={`${n} star${n > 1 ? "s" : ""}: ${LABELS[n]}`} />
              <Star className={cn("h-9 w-9", n <= rating ? "fill-safety-500 text-safety-500" : "text-concrete-300")} aria-hidden />
            </label>
          ))}
          <span className="ml-2 text-sm font-semibold text-ink-600">{LABELS[rating]}</span>
        </div>
        {state.fieldErrors?.rating && <p role="alert" className="mt-1 text-sm text-site-red">{state.fieldErrors.rating[0]}</p>}
      </fieldset>
      <Field label="What went well? Anything they could improve?" htmlFor="review-body" optional>
        <Textarea id="review-body" name="body" rows={4} maxLength={2000} defaultValue={existing?.body} placeholder="On time, clean site, good communication…" />
      </Field>
      <Field label="Your name" htmlFor="review-name" error={state.fieldErrors?.name} hint="Shown as first name and last initial">
        <Input id="review-name" name="name" defaultValue={defaultName} autoComplete="name" required />
      </Field>
      <SubmitButton block size="lg" pendingText="Posting…">{existing ? "Update review" : "Post review"}</SubmitButton>
    </form>
  );
}
