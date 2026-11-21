import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { RESULT_LABEL } from "@/lib/coach/format";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  tone = "default",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "default" | "muted";
}) {
  return (
    <section
      className={cn(
        "coach-card overflow-hidden",
        tone === "muted" && "bg-secondary/60 shadow-none",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold leading-tight text-foreground">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  footer,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  footer?: ReactNode;
}) {
  return (
    <div className="coach-card flex flex-col gap-1 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "rupee-figure text-3xl",
          tone === "good" && "text-improved",
          tone === "warn" && "text-nochange",
          tone === "bad" && "text-worse",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-sm leading-snug text-muted-foreground">{hint}</span>}
      {footer}
    </div>
  );
}

const leverChip = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", {
  variants: {
    lever: {
      bills: "bg-teal-soft text-teal",
      baskets: "bg-marigold-soft text-marigold-ink",
      repeat: "bg-maroon-soft text-maroon",
      other: "bg-secondary text-secondary-foreground",
    },
  },
  defaultVariants: { lever: "other" },
});

function leverKey(lever: string): NonNullable<VariantProps<typeof leverChip>["lever"]> {
  const l = lever.toLowerCase();
  if (l.includes("bill")) return "bills";
  if (l.includes("basket")) return "baskets";
  if (l.includes("repeat")) return "repeat";
  return "other";
}

export function LeverChip({ lever, className }: { lever: string; className?: string }) {
  return <span className={cn(leverChip({ lever: leverKey(lever) }), className)}>{lever}</span>;
}

const resultChip = cva("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold", {
  variants: {
    result: {
      improved: "bg-improved-soft text-improved",
      no_change: "bg-nochange-soft text-nochange",
      worse: "bg-worse-soft text-worse",
      pending: "bg-secondary text-muted-foreground",
    },
  },
  defaultVariants: { result: "pending" },
});

export function ResultChip({ result, label }: { result: string | null; label?: string }) {
  const key = result === "improved" || result === "no_change" || result === "worse" ? result : "pending";
  return <span className={resultChip({ result: key })}>{label ?? (result ? RESULT_LABEL[result] : "Pending")}</span>;
}

export const resultTone: Record<string, string> = {
  improved: "border-improved/30 bg-improved-soft text-improved",
  no_change: "border-nochange/30 bg-nochange-soft text-nochange",
  worse: "border-worse/30 bg-worse-soft text-worse",
};

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-ivory px-4 py-5 text-center text-sm text-muted-foreground">{children}</p>;
}

export function KeyValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="tabular text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-xl font-extrabold tracking-tight text-foreground">{children}</h2>
      {aside}
    </div>
  );
}
