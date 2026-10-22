"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";
import { createPost } from "@/app/actions/social";
import { buttonClasses } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { POST_TYPES, UPLOAD } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

const ACCEPT = UPLOAD.allowedTypes.join(",");

export function PostForm({ projects, services, defaults }: { projects: { id: string; name: string }[]; services: Service[]; defaults: { projectId?: string; type: string; serviceId?: string; location?: string } }) {
  const [state, action] = useActionState(createPost, {} as ActionState);
  const [type, setType] = useState(defaults.type);
  const [previews, setPreviews] = useState<string[]>([]);
  const [ba, setBa] = useState<{ before?: string; after?: string }>({});
  const isBA = type === "before_after";

  return (
    <form action={action} className="space-y-5">
      <FormError message={state.error} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">What are you posting?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {POST_TYPES.map((t) => (
            <label key={t.value} className={cn("flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 px-2 text-center text-sm font-semibold", type === t.value ? "border-safety-500 bg-safety-50" : "border-concrete-200")}>
              <input type="radio" name="type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="sr-only" />{t.label}
            </label>
          ))}
        </div>
      </fieldset>

      {isBA ? (
        <div className="grid grid-cols-2 gap-2">
          {(["before", "after"] as const).map((k) => (
            <label key={k} className="relative flex aspect-[4/5] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-concrete-300 bg-concrete-50 text-sm font-semibold text-ink-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {ba[k] ? <img src={ba[k]} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <><ImagePlus className="h-6 w-6" />Add {k} photo</>}
              <span className="absolute left-2 top-2 rounded bg-ink/80 px-2 py-0.5 text-xs font-bold uppercase text-white">{k}</span>
              <input type="file" name={k} accept={ACCEPT} className="sr-only" required
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setBa((p) => ({ ...p, [k]: URL.createObjectURL(f) })); }} />
            </label>
          ))}
        </div>
      ) : (
        <div>
          <label className={buttonClasses({ variant: "outline", block: true, size: "lg", className: "cursor-pointer border-dashed" })}>
            <ImagePlus className="h-5 w-5" />{previews.length ? "Change photos" : "Add photos"}
            <input type="file" name="images" accept={ACCEPT} multiple className="sr-only"
              onChange={(e) => setPreviews(Array.from(e.target.files ?? []).slice(0, UPLOAD.maxImagesPerPost).map((f) => URL.createObjectURL(f)))} />
          </label>
          {previews.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previews.map((src, i) => <img key={src} src={src} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />)}
            </div>
          )}
          <p className="mt-1 text-xs text-ink-500">Up to {UPLOAD.maxImagesPerPost} photos, 10 MB each. The first photo is the cover.</p>
        </div>
      )}

      <Field label="Caption" htmlFor="caption" optional>
        <Textarea id="caption" name="caption" rows={3} maxLength={2200} placeholder="What was the job? Materials, timeline, what the client wanted…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service" htmlFor="serviceId" optional><Select id="serviceId" name="serviceId" defaultValue={defaults.serviceId ?? ""} placeholder="—" options={services.map((s) => ({ value: s.id, label: s.name }))} /></Field>
        <Field label="Location" htmlFor="locationText" optional><Input id="locationText" name="locationText" defaultValue={defaults.location} placeholder="e.g. Portmore, St Catherine" /></Field>
      </div>
      {projects.length > 0 && (
        <Field label="Link to project" htmlFor="projectId" hint="Only you see the link; customers see the post." optional>
          <Select id="projectId" name="projectId" defaultValue={defaults.projectId ?? ""} placeholder="None" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
      )}
      <SubmitButton size="lg" block pendingText="Publishing…">Publish post</SubmitButton>
      <p className="flex items-center justify-center gap-1 text-xs text-ink-500">Only post photos of work your business did, with your customer&apos;s permission.</p>
    </form>
  );
}
