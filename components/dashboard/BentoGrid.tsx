"use client";

import { Activity, MapPinned, Waves } from "lucide-react";
import type { AgentRunOutput } from "@/lib/agent/hunterAgent";
import { LeadCard } from "./LeadCard";
import { Card } from "@/components/ui/card";

type BentoGridProps = {
  report: AgentRunOutput;
};

const statusTone: Record<
  "Hot" | "Warm" | "Cold",
  "text-red-200" | "text-amber-200" | "text-slate-200"
> = {
  Hot: "text-red-200",
  Warm: "text-amber-200",
  Cold: "text-slate-200",
};

export function BentoGrid({ report }: BentoGridProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="lg:col-span-4">
        <header className="mb-4 flex items-center gap-2 text-foreground">
          <Activity className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90">
            Live Stream - New Leads
          </h2>
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          {report.leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <header className="mb-4 flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90">
            Noumea Zone Map
          </h2>
        </header>
        <div className="relative flex h-[280px] items-center justify-center rounded-xl border border-white/10 bg-slate-950/60">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(87,182,255,0.18),transparent_70%)]" />
          <svg
            viewBox="0 0 300 220"
            className="relative h-full w-full p-4 text-cyan-200/70"
            aria-label="Map placeholder of Noumea sectors"
          >
            <path
              d="M27 158 L72 123 L95 142 L140 107 L190 121 L248 85 L272 125 L224 167 L174 174 L115 193 Z"
              fill="rgba(87,182,255,0.15)"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="72" cy="123" r="5" fill="#57b6ff" />
            <circle cx="140" cy="107" r="5" fill="#57b6ff" />
            <circle cx="224" cy="167" r="5" fill="#57b6ff" />
            <text x="38" y="112" fontSize="10" fill="currentColor">
              Dumbéa
            </text>
            <text x="134" y="96" fontSize="10" fill="currentColor">
              Nouméa
            </text>
            <text x="210" y="181" fontSize="10" fill="currentColor">
              Mont-Dore
            </text>
          </svg>
        </div>
      </Card>

      <Card className="lg:col-span-6">
        <header className="mb-4 flex items-center gap-2">
          <Waves className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90">
            Lead Heatline
          </h2>
        </header>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {report.leads.map((lead) => (
            <span
              key={`${lead.id}-status`}
              className={`rounded-full border border-white/10 px-3 py-1 ${statusTone[lead.temperature]}`}
            >
              {lead.location}: {lead.temperature}
            </span>
          ))}
        </div>
      </Card>
    </section>
  );
}
