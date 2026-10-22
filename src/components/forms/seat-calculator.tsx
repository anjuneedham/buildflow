"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatMoney, seatPriceBreakdown, type Plan } from "@/lib/plans";

export function SeatCalculator({ plan }: { plan: Plan }) {
  const [seats, setSeats] = useState(1);
  const b = seatPriceBreakdown(plan, seats);
  return (
    <div className="rounded-xl bg-concrete-50 p-4">
      <p className="text-sm font-semibold">How many people will use BuildFlow?</p>
      <div className="mt-3 flex items-center gap-3">
        <button aria-label="Fewer users" onClick={() => setSeats((s) => Math.max(1, s - 1))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-concrete-300 bg-white"><Minus className="h-4 w-4" /></button>
        <span className="w-16 text-center text-2xl font-extrabold" aria-live="polite">{b.seats}</span>
        <button aria-label="More users" onClick={() => setSeats((s) => Math.min(50, s + 1))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-concrete-300 bg-white"><Plus className="h-4 w-4" /></button>
        <span className="text-sm text-ink-500">user{b.seats > 1 ? "s" : ""}</span>
      </div>
      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Base ({plan.includedSeats} user included)</dt><dd>{formatMoney(b.baseCents, plan.currency)}</dd></div>
        <div className="flex justify-between"><dt>{b.extraSeats} additional user{b.extraSeats === 1 ? "" : "s"} × {formatMoney(plan.additionalSeatPriceCents, plan.currency)}</dt><dd>{formatMoney(b.extraCents, plan.currency)}</dd></div>
        <div className="flex justify-between border-t border-concrete-200 pt-2 text-base font-extrabold"><dt>Total</dt><dd>{formatMoney(b.totalCents, plan.currency)}/{plan.interval}</dd></div>
      </dl>
    </div>
  );
}
