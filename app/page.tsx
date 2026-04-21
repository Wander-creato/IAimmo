import { BentoGrid } from "@/components/dashboard/BentoGrid";
import { StatsHeader } from "@/components/dashboard/StatsHeader";
import { runHunterAgent } from "@/lib/agent/hunterAgent";

export default async function Home() {
  const report = await runHunterAgent({
    maxPriceXpf: 55_000_000,
    minPriceXpf: 12_000_000,
    locations: ["Nouméa", "Dumbéa", "Païta", "Mont-Dore"],
    requiredKeywords: ["particulier", "urgent", "pas d'agence", "agence"],
  });

  return (
    <main className="container mx-auto space-y-6 px-4 py-8 md:px-8">
      <section className="space-y-1">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">CaledoWatch Immo 2026</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          AI sourcing dashboard for private leads in Nouméa
        </h1>
      </section>
      <StatsHeader stats={report.stats} />
      <BentoGrid report={report} />
    </main>
  );
}
