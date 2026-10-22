import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "block w-full rounded-lg border border-concrete-300 bg-white px-3 text-base text-ink placeholder:text-ink-500/60 focus:border-safety-500 focus:outline-none focus:ring-2 focus:ring-safety-500/25 disabled:bg-concrete-100 aria-[invalid=true]:border-site-red";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "min-h-11 py-2", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, "py-2.5", className)} {...props} />;
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { options: readonly { value: string; label: string }[]; placeholder?: string };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, options, placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, "select-chevron min-h-11 appearance-none py-2 pr-9", className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
});

export function Field({ label, htmlFor, hint, error, children, className, optional }: {
  label: string; htmlFor?: string; hint?: ReactNode; error?: string | string[]; children: ReactNode; className?: string; optional?: boolean;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label} {optional && <span className="font-normal text-ink-500">(optional)</span>}
      </label>
      {children}
      {msg ? <p className="text-sm text-site-red" role="alert">{msg}</p> : hint ? <p className="text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-site-red">{message}</div>;
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-site-green">{message}</div>;
}
