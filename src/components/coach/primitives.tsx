import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { RESULT_LABEL } from "@/lib/coach/format";

/** White rounded card with an optional title row. */
export function Card({
  title,
  aside,
  subtitle,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
}: {
  title?: ReactNode;
  aside?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "article" | "div" | "aside";
}) {
  return (
    <Tag className={cn("surface p-6 sm:p-7", className)}>
      {(title || aside) && (
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {title && <h2 className="text-xl font-semibold leading-tight text-foreground">{title}</h2>}
          {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
          {subtitle && <p className="w-full text-sm leading-snug text-muted-foreground">{subtitle}</p>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}

/** Small grey line above a page headline: "Week of Mon, 26 Oct · LKO-01, LKO-02". */
export function PageHeader({
  kicker,
  title,
  sub,
  actions,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && <p className="text-[0.95rem] text-muted-foreground sm:text-lg">{kicker}</p>}
        <h1 className="headline mt-1 text-4xl text-foreground sm:text-5xl lg:text-[3.4rem]">{title}</h1>
        {sub && <p className="mt-2 text-base text-muted-foreground sm:text-lg">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const deltaTone = {
  good: "text-good",
  bad: "text-bad",
  neutral: "text-muted-foreground",
} as const;

/** KPI tile: label, big figure, and a comparison line (▲ green / ▼ red / grey). */
export function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
  arrow,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  tone?: keyof typeof deltaTone;
  arrow?: "up" | "down";
}) {
  return (
    <div className="surface flex flex-col gap-2 p-5 sm:p-6">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="figure text-[2.1rem] text-foreground sm:text-[2.5rem]">{value}</span>
      {delta && (
        <span className={cn("text-sm leading-snug", deltaTone[tone])}>
          {arrow && <span aria-hidden>{arrow === "up" ? "▲ " : "▼ "}</span>}
          {delta}
        </span>
      )}
    </div>
  );
}

const chip = cva("inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold", {
  variants: {
    tone: {
      info: "bg-info-soft text-info",
      warn: "bg-warn-soft text-warn",
      good: "bg-good-soft text-good",
      bad: "bg-bad-soft text-bad",
      neutral: "bg-secondary text-foreground",
      outline: "bg-card text-foreground ring-1 ring-border",
    },
    size: {
      default: "",
      sm: "px-2.5 py-0.5 text-xs",
    },
  },
  defaultVariants: { tone: "neutral", size: "default" },
});

export type ChipTone = NonNullable<VariantProps<typeof chip>["tone"]>;

export function Chip({
  tone,
  size,
  className,
  children,
}: VariantProps<typeof chip> & { className?: string; children: ReactNode }) {
  return <span className={cn(chip({ tone, size }), className)}>{children}</span>;
}

export function leverTone(lever: string): ChipTone {
  const l = lever.toLowerCase();
  if (l.includes("bill")) return "info";
  if (l.includes("basket")) return "warn";
  if (l.includes("repeat")) return "good";
  return "neutral";
}

export function LeverChip({ lever, size }: { lever: string; size?: "default" | "sm" }) {
  return (
    <Chip tone={leverTone(lever)} size={size}>
      {lever}
    </Chip>
  );
}

export const resultText: Record<string, string> = {
  improved: "text-good",
  no_change: "text-warn",
  worse: "text-bad",
};

export function ResultChip({ result, label }: { result: string | null; label?: string }) {
  const tone: ChipTone = result === "improved" ? "good" : result === "no_change" ? "warn" : result === "worse" ? "bad" : "neutral";
  return (
    <Chip tone={tone} size="sm">
      {label ?? (result ? RESULT_LABEL[result] : "Pending")}
    </Chip>
  );
}

export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("rounded-2xl bg-secondary px-4 py-5 text-center text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function KeyValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-0">
      <span className="text-[0.95rem] text-muted-foreground">{label}</span>
      <span className="tabular text-[0.95rem] font-semibold text-foreground">{value}</span>
    </div>
  );
}

/** Grey rounded box, e.g. "Do this · Today · Rakesh Srivastava → Jitendra V." */
export function Callout({ label, children, className }: { label?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-secondary px-5 py-4", className)}>
      {label && <p className="text-sm font-semibold text-muted-foreground">{label}</p>}
      <div className={cn("text-[1.05rem] leading-relaxed text-foreground", label && "mt-1")}>{children}</div>
    </div>
  );
}

/** Simple data table in the design's style: grey header labels, hairline rows. */
export function DataTable({
  columns,
  children,
  className,
  minWidth = 560,
}: {
  columns: { label: ReactNode; align?: "left" | "right" | "center"; className?: string }[];
  children: ReactNode;
  className?: string;
  minWidth?: number;
}) {
  return (
    <div className={cn("-mx-2 overflow-x-auto px-2", className)}>
      <table className="w-full text-[0.95rem]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {columns.map((c, i) => (
              <th
                key={i}
                className={cn(
                  "px-3 pb-3 font-normal",
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  c.className,
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular [&>tr]:border-b [&>tr]:border-border [&>tr:last-child]:border-0 [&_td]:px-3 [&_td]:py-3">
          {children}
        </tbody>
      </table>
    </div>
  );
}
