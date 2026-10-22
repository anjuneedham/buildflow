import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "outlineLight" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-safety-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none";
const variants: Record<Variant, string> = {
  primary: "bg-safety-500 text-white hover:bg-safety-600 active:bg-safety-700 shadow-sm",
  dark: "bg-ink text-white hover:bg-ink-700",
  secondary: "bg-concrete-100 text-ink hover:bg-concrete-200",
  outline: "border border-concrete-300 bg-white text-ink hover:bg-concrete-50",
  outlineLight: "border border-white/30 bg-transparent text-white hover:bg-white/10",
  ghost: "text-ink-600 hover:bg-concrete-100 hover:text-ink",
  danger: "bg-site-red text-white hover:bg-red-800",
};
// min-h-11 = 44px touch target on mobile.
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export function buttonClasses({ variant = "primary", size = "md", block, className }: { variant?: Variant; size?: Size; block?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, className, type = "button", ...props }, ref,
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, block, className })} {...props} />;
});

export function ButtonLink({ variant, size, block, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <Link className={buttonClasses({ variant, size, block, className })} {...props} />;
}
