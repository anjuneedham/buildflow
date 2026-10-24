"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { createPost } from "@/app/actions/social";
import { buttonClasses } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { POST_TYPES, UPLOAD } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/types";

const ACCEPT = UPLOAD.allowedTypes.join(",");

type JobPhoto = { id: string; path: string };

export function PostForm({ projects, services, defaults, jobPhotos = [], lockedProject }: {
  projects: { id: string; name: string }[]; services: Service[]; defaults: { projectId?: string; type: string; serviceId?: string; location?: string };
  /** Photos from the job this post is published from. */
  jobPhotos?: JobPhoto[]; lockedProject?: { id: string; name: string };
}) {
  const [state, action] = useFormAction(createPost);
  const [type, setType] = useState(defaults.type);
  const [previews, setPreviews] = useState<string[]>([]);
  const [ba, setBa] = useState<{ before?: string; after?: string }>({});
  // Pre-select up to the last 4 job photos: the finished result is usually what to show.
  const [picked, setPicked] = useState<string[]>(jobPhotos.slice(-4).map((p) => p.id));
  const [baPick, setBaPick] = useState<{ before?: string; after?: string }>(jobPhotos.length >= 2 ? { before: jobPhotos[0].id, after: jobPhotos[jobPhotos.length - 1].id } : {});
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

      {isBA && jobPhotos.length >= 2 ? (
        <div className="grid grid-cols-2 gap-3">
          {(["before", "after"] as const).map((k) => (
            <fieldset key={k}>
              <legend className="mb-1 text-sm font-semibold capitalize">{k}</legend>
              <input type="hidden" name={`${k}MediaId`} value={baPick[k] ?? ""} />
              <div className="grid grid-cols-3 gap-1">
                {jobPhotos.map((p) => (
                  <button type="button" key={p.id} onClick={() => setBaPick((x) => ({ ...x, [k]: p.id }))} aria-pressed={baPick[k] === p.id} aria-label={`Use photo as ${k}`}
                    className={cn("relative aspect-square overflow-hidden rounded-md border-2", baPick[k] === p.id ? "border-action" : "border-transparent opacity-70")}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route */}
                    <img src={`/media/${p.path}`} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : isBA ? (
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
        <div className="space-y-3">
          {jobPhotos.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">Photos from this job <span className="font-normal text-ink-500">({picked.length} selected)</span></legend>
              <div className="grid grid-cols-4 gap-1.5">
                {jobPhotos.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <label key={p.id} className={cn("relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2", on ? "border-action" : "border-transparent")}>
                      <input type="checkbox" name="jobMediaIds" value={p.id} checked={on} className="sr-only"
                        onChange={() => setPicked((x) => (on ? x.filter((i) => i !== p.id) : [...x, p.id].slice(-UPLOAD.maxImagesPerPost)))} aria-label="Include this photo" />
                      {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route */}
                      <img src={`/media/${p.path}`} alt="" className={cn("h-full w-full object-cover", !on && "opacity-60")} />
                      {on && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-action text-[11px] font-bold text-white">{picked.indexOf(p.id) + 1}</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <label className={buttonClasses({ variant: "outline", block: true, size: "lg", className: "cursor-pointer border-dashed" })}>
            <ImagePlus className="h-5 w-5" />{previews.length ? "Change photos" : jobPhotos.length ? "Add more photos" : "Add photos"}
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
      {lockedProject ? <input type="hidden" name="projectId" value={lockedProject.id} /> : projects.length > 0 && (
        <Field label="Link to job" htmlFor="projectId" hint="Linked posts show as a verified job. Customers never see job details." optional>
          <Select id="projectId" name="projectId" defaultValue={defaults.projectId ?? ""} placeholder="None" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
      )}
      <SubmitButton size="lg" block pendingText="Publishing…">Publish post</SubmitButton>
      <p className="flex items-center justify-center gap-1 text-xs text-ink-500">Only post photos of work your business did, with your customer&apos;s permission.</p>
    </form>
  );
}
