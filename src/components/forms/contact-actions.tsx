"use client";

import { useState } from "react";
import { MessageSquare, FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { buttonClasses } from "@/components/ui/button";
import { QuoteForm } from "./quote-form";
import type { Service } from "@/lib/types";

type Props = { businessId: string; businessName: string; services: Pick<Service, "id" | "name">[]; defaults?: { name?: string; email?: string } };

/** Primary (Request a quote) + secondary (Contact) CTAs, each opening a sheet. */
export function ContactActions({ variant = "header", ...props }: Props & { variant?: "header" | "sticky" }) {
  const [open, setOpen] = useState<null | "quote" | "contact">(null);
  return (
    <>
      <div className={variant === "sticky" ? "flex gap-2" : "flex flex-col gap-2 sm:flex-row"}>
        <button onClick={() => setOpen("quote")} className={buttonClasses({ size: "lg", className: variant === "sticky" ? "flex-1" : "sm:min-w-48" })}>
          <FileText className="h-5 w-5" />Request a quote
        </button>
        <button onClick={() => setOpen("contact")} className={buttonClasses({ size: "lg", variant: "outline", className: variant === "sticky" ? "" : "sm:min-w-36" })}>
          <MessageSquare className="h-5 w-5" />Contact
        </button>
      </div>
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open === "contact" ? `Contact ${props.businessName}` : `Request a quote`}>
        {open && <QuoteForm key={open} kind={open} {...props} />}
      </Modal>
    </>
  );
}
