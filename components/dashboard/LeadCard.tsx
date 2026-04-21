"use client";

import { useState } from "react";
import { Clock3, MapPin, MessageSquareShare, ShieldCheck, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Lead } from "@/lib/agent/hunterAgent";

const leadTone: Record<Lead["temperature"], string> = {
  Hot: "border-red-400/40 bg-red-500/10 text-red-100",
  Warm: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  Cold: "border-blue-300/40 bg-blue-500/10 text-blue-100",
};

export function LeadCard({ lead }: { lead: Lead }) {
  const [copied, setCopied] = useState(false);
  const confidencePct = Math.round(lead.confidenceScore * 100);

  const handleGenerateSms = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(lead.approachSms);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="border-white/10 bg-glass shadow-glass backdrop-blur-xl">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{lead.source}</p>
            <h3 className="text-lg font-semibold text-foreground">{lead.title}</h3>
            <p className="mt-1 text-xs text-muted">
              {lead.district} - {lead.marketZone}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={leadTone[lead.temperature]}>{lead.temperature}</Badge>
            <Badge className="border-cyan-300/40 bg-cyan-500/10 text-cyan-100">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Confidence {confidencePct}%
            </Badge>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-muted md:grid-cols-3">
          <p className="inline-flex items-center gap-1.5">
            <MapPin size={14} />
            {lead.location}
          </p>
          <p className="inline-flex items-center gap-1.5">
            <Tag size={14} />
            {lead.priceXpf.toLocaleString("fr-FR")} XPF
          </p>
          <p className="inline-flex items-center gap-1.5">
            <Clock3 size={14} />
            {new Date(lead.discoveredAt).toLocaleString("fr-FR")}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted">Sales Pitch</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-foreground/90">
            {lead.salesPitch.map((pitch) => (
              <li key={pitch}>{pitch}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <button
            type="button"
            onClick={handleGenerateSms}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <MessageSquareShare className="h-4 w-4" />
            Generer SMS d&apos;approche
          </button>
          <p className="text-xs text-muted">
            {copied ? "SMS copie dans le presse-papiers." : lead.approachSms}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
