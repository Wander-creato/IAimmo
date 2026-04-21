import { ArrowDown, Building2, Flame, Ratio } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LeadCategory, WeeklyStats } from "@/lib/agent/hunterAgent";

const categoryCopy: Record<LeadCategory, string> = {
  Hot: "Fresh private owner signals",
  Warm: "Price drops worth instant outreach",
  Cold: "Agency-dominated inventory",
};

type StatsHeaderProps = {
  stats: WeeklyStats;
};

export function StatsHeader({ stats }: StatsHeaderProps) {
  const leadMix = [
    { label: "Hot", count: stats.byCategory.Hot, icon: Flame },
    { label: "Warm", count: stats.byCategory.Warm, icon: ArrowDown },
    { label: "Cold", count: stats.byCategory.Cold, icon: Building2 },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="sm:col-span-2 xl:col-span-1">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted">
          <Ratio className="h-3.5 w-3.5 text-accent" />
          Private vs Agency this week
        </p>
        <div className="mt-3 flex items-end gap-3">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {Math.round(stats.privateRatio * 100)}%
          </p>
          <p className="mb-1 text-sm text-muted">
            {stats.privateCount} private / {stats.agencyCount} agency
          </p>
        </div>
      </Card>

      {leadMix.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted">
              <Icon className="h-3.5 w-3.5 text-accent" />
              {item.label} leads
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {item.count}
            </p>
            <p className="mt-1 text-sm text-muted">{categoryCopy[item.label]}</p>
          </Card>
        );
      })}

      <Card className="sm:col-span-2 xl:col-span-1">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Data Hygiene</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          {stats.duplicatesFiltered}
        </p>
        <p className="mt-1 text-sm text-muted">Duplicates blocked (phone/surface-price)</p>
        <div className="mt-4 space-y-1.5 text-xs text-muted">
          <p>Noumea Sud: {stats.byMarketZone["Noumea Sud"]}</p>
          <p>Noumea Centre: {stats.byMarketZone["Noumea Centre"]}</p>
          <p>Noumea Nord: {stats.byMarketZone["Noumea Nord"]}</p>
          <p>Grand Noumea: {stats.byMarketZone["Grand Noumea"]}</p>
        </div>
      </Card>
    </div>
  );
}
