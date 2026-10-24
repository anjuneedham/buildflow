"use client";

import { useState } from "react";
import { FileText, MessageCircle, Phone } from "lucide-react";
import { trackContact } from "@/app/actions/social";
import { Modal } from "@/components/ui/modal";
import { buttonClasses } from "@/components/ui/button";
import { whatsappLink } from "@/lib/utils";
import { QuoteForm, type QuoteReference } from "./quote-form";
import type { Service } from "@/lib/types";

type Props = {
  businessId: string; businessName: string; services: Pick<Service, "id" | "name">[]; phone?: string | null;
  defaults?: { name?: string; email?: string }; defaultOpen?: boolean; reference?: QuoteReference | null;
};

/**
 * The two ways a customer reaches a contractor (UX_ARCHITECTURE_V2.md §3.18):
 * Request a quote (primary, becomes a lead) and WhatsApp/Call (secondary,
 * counted as a contact click). One request form, no separate "contact" form.
 */
export function ContactActions({ variant = "header", phone, defaultOpen = false, reference, ...props }: Props & { variant?: "header" | "sticky" }) {
  const [open, setOpen] = useState(defaultOpen);
  const wa = whatsappLink(phone, `Hi ${props.businessName}, I found you on BuildFlow.`);
  const direct = wa ?? (phone ? `tel:${phone}` : null);
  return (
    <>
      <div className={variant === "sticky" ? "flex gap-2" : "flex flex-col gap-2 sm:flex-row"}>
        <button onClick={() => setOpen(true)} className={buttonClasses({ size: "lg", className: variant === "sticky" ? "flex-1" : "sm:min-w-48" })}>
          <FileText className="h-5 w-5" />Request a quote
        </button>
        {direct && (
          <a href={direct} target={wa ? "_blank" : undefined} rel="noreferrer" onClick={() => void trackContact(props.businessId)}
            className={buttonClasses({ size: "lg", variant: "outline", className: variant === "sticky" ? "" : "sm:min-w-36" })}>
            {wa ? <MessageCircle className="h-5 w-5" /> : <Phone className="h-5 w-5" />}{wa ? "WhatsApp" : "Call"}
          </a>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Request a quote from ${props.businessName}`}>
        {open && <QuoteForm {...props} reference={reference} />}
      </Modal>
    </>
  );
}
