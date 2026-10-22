import { cn, initials } from "@/lib/utils";

const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-lg", xl: "h-24 w-24 text-2xl" };

export function Avatar({ src, name, size = "md", square, className }: { src?: string | null; name?: string | null; size?: keyof typeof sizes; square?: boolean; className?: string }) {
  const shape = square ? "rounded-xl" : "rounded-full";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? ""} className={cn(sizes[size], shape, "shrink-0 object-cover bg-concrete-100", className)} />;
  }
  return (
    <span aria-hidden className={cn(sizes[size], shape, "inline-flex shrink-0 items-center justify-center bg-ink font-bold text-safety-400", className)}>
      {initials(name)}
    </span>
  );
}
