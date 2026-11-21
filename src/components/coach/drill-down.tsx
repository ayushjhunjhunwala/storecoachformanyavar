import { useEffect, useState } from "react";
import type { ManagerView } from "@/lib/coach/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AmDigest } from "./am-digest";
import { StoreView } from "./store-view";

export type DrillMode = "am" | "store";

export function DrillDown({
  view,
  mode,
  onModeChange,
  amId,
  onAmChange,
  storeId,
  onStoreChange,
}: {
  view: ManagerView;
  mode: DrillMode;
  onModeChange: (m: DrillMode) => void;
  amId: string;
  onAmChange: (id: string) => void;
  storeId: string;
  onStoreChange: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-8" aria-label="Digests and stores">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-secondary p-1" role="tablist" aria-label="Show">
          {(
            [
              { key: "am", label: "Area manager digest" },
              { key: "store", label: "Store" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={mode === t.key}
              onClick={() => onModeChange(t.key)}
              className={cn(
                "rounded-full px-4 py-2 text-[0.95rem] transition-colors",
                mode === t.key ? "bg-card font-semibold text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {mode === "am" ? (
          <Select value={amId} onValueChange={onAmChange}>
            <SelectTrigger className="h-11 w-full rounded-full bg-card px-5 text-base sm:w-80" aria-label="Choose area manager">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {view.area_managers.map((a) => (
                <SelectItem key={a.area_manager_id} value={a.area_manager_id}>
                  {a.name} · {a.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={storeId} onValueChange={onStoreChange}>
            <SelectTrigger className="h-11 w-full rounded-full bg-card px-5 text-base sm:w-80" aria-label="Choose store">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {view.store_order.map((id) => (
                <SelectItem key={id} value={id}>
                  {id} · {view.stores[id]?.meta.city} · tier {view.stores[id]?.meta.tier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {mode === "am" ? <AmDigest view={view} amId={amId} showManager /> : <StoreView view={view} storeId={storeId} />}
    </section>
  );
}

/** Picker state that stays valid when the view's scope changes. */
export function useDrillState(view: ManagerView | undefined, defaults: { am?: string; store?: string } = {}) {
  const [mode, setMode] = useState<DrillMode>("am");
  const [amId, setAmId] = useState(defaults.am ?? "");
  const [storeId, setStoreId] = useState(defaults.store ?? "");
  useEffect(() => {
    if (!view) return;
    if (!view.area_managers.some((a) => a.area_manager_id === amId)) setAmId(view.area_managers[0]?.area_manager_id ?? "");
    if (!view.stores[storeId]) setStoreId(view.store_order[0] ?? "");
  }, [view, amId, storeId]);
  return { mode, setMode, amId, setAmId, storeId, setStoreId };
}
