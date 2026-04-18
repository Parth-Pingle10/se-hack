import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
}

export function Logo({ className, size = "md", variant = "dark" }: LogoProps) {
  const sizes = {
    sm: { icon: "h-4 w-4", text: "text-base", gap: "gap-1.5" },
    md: { icon: "h-5 w-5", text: "text-lg", gap: "gap-2" },
    lg: { icon: "h-9 w-9", text: "text-4xl", gap: "gap-3" },
  }[size];

  return (
    <div className={cn("flex items-center", sizes.gap, className)}>
      <div className={cn(
        "flex items-center justify-center rounded-xl",
        size === "lg" ? "h-14 w-14" : size === "md" ? "h-8 w-8" : "h-6 w-6",
        variant === "light"
          ? "bg-sidebar-primary/10"
          : "bg-accent/10"
      )}>
        <ShieldCheck
          className={cn(sizes.icon, variant === "light" ? "text-sidebar-primary" : "text-accent")}
          strokeWidth={2.2}
        />
      </div>
      <span
        className={cn(
          "font-bold tracking-tight",
          sizes.text,
          variant === "light" ? "text-sidebar-accent-foreground" : "text-foreground"
        )}
      >
        Ledger<span className={variant === "light" ? "text-sidebar-primary" : "text-accent"}>Spy</span>
      </span>
    </div>
  );
}
