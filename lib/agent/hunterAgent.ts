import type { Listing, Zone } from "@/lib/scraper/mockScraper";
import { crawlLocalListings } from "@/lib/scraper/mockScraper";

const TARGET_ZONES: readonly Zone[] = ["Nouméa", "Dumbéa", "Païta", "Mont-Dore"];
const PRIVATE_KEYWORDS = ["particulier", "urgent", "pas d'agence"];
const AGENCY_KEYWORDS = ["agence", "exclusivité agence", "mandat"];

export type LeadCategory = "Hot" | "Warm" | "Cold";

export interface LeadFilters {
  minPriceXpf?: number;
  maxPriceXpf?: number;
  locations?: Zone[];
  requiredKeywords?: string[];
  provider?: "mock" | "firecrawl" | "apify";
}

export interface Lead {
  id: string;
  source: Listing["source"];
  title: string;
  description: string;
  location: Zone;
  priceXpf: number;
  previousPriceXpf?: number;
  discoveredAt: string;
  isAgency: boolean;
  latitude: number;
  longitude: number;
  matchedKeywords: string[];
  privateSignal: boolean;
  temperature: LeadCategory;
  score: number;
  salesPitch: [string, string, string];
}

export interface WeeklyStats {
  privateCount: number;
  agencyCount: number;
  privateRatio: number;
  byCategory: Record<LeadCategory, number>;
  scanned: number;
  matched: number;
}

// PydanticAI-like structured response contract used by the UI.
export interface AgentRunOutput {
  generatedAt: string;
  providerNote: string;
  stats: WeeklyStats;
  leads: Lead[];
}

function findKeywords(text: string, keywords: readonly string[]) {
  const normalized = text.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword));
}

function normalizeLocation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function summarizeToPitch(listing: Listing): [string, string, string] {
  const compactDescription = listing.description
    .replace(/\s+/g, " ")
    .replace(/[.!?]+/g, ".")
    .trim();

  const previousPriceCopy =
    typeof listing.previousPriceXpf === "number"
      ? `Baisse depuis ${listing.previousPriceXpf.toLocaleString("fr-FR")} XPF.`
      : "Prix aligne marche local.";

  return [
    `${listing.title} a ${listing.location} pour ${listing.priceXpf.toLocaleString("fr-FR")} XPF.`,
    compactDescription.length > 110
      ? `${compactDescription.slice(0, 107)}...`
      : compactDescription,
    `${previousPriceCopy} Priorite a la prise de contact rapide.`,
  ];
}

function computeTemperature(listing: Listing, privateSignal: boolean): LeadCategory {
  if (privateSignal) {
    return "Hot";
  }

  if (
    typeof listing.previousPriceXpf === "number" &&
    listing.previousPriceXpf > listing.priceXpf
  ) {
    return "Warm";
  }

  return "Cold";
}

function scoreLead(listing: Listing, privateSignal: boolean): number {
  const ageHours = (Date.now() - new Date(listing.postedAt).getTime()) / 3_600_000;
  const freshness = Math.max(0, 50 - ageHours);
  const privateBoost = privateSignal ? 30 : 0;
  const dropBoost =
    typeof listing.previousPriceXpf === "number" && listing.previousPriceXpf > listing.priceXpf
      ? 15
      : 0;
  const agencyPenalty = listing.isAgency ? -10 : 0;

  return Math.round(freshness + privateBoost + dropBoost + agencyPenalty);
}

function applyFilters(listing: Listing, filters: LeadFilters): boolean {
  const selectedLocations =
    filters.locations && filters.locations.length > 0 ? filters.locations : [...TARGET_ZONES];

  const listingLocation = normalizeLocation(listing.location);
  const withinLocation = selectedLocations
    .map((zone) => normalizeLocation(zone))
    .includes(listingLocation);
  const aboveMin =
    typeof filters.minPriceXpf === "number" ? listing.priceXpf >= filters.minPriceXpf : true;
  const belowMax =
    typeof filters.maxPriceXpf === "number" ? listing.priceXpf <= filters.maxPriceXpf : true;

  if (filters.requiredKeywords && filters.requiredKeywords.length > 0) {
    const text = `${listing.title} ${listing.description}`.toLowerCase();
    const required = filters.requiredKeywords.map((keyword) => keyword.toLowerCase());
    const hasAnyRequiredKeyword = required.some((keyword) => text.includes(keyword));
    return withinLocation && aboveMin && belowMax && hasAnyRequiredKeyword;
  }

  return withinLocation && aboveMin && belowMax;
}

export async function runHunterAgent(filters: LeadFilters = {}): Promise<AgentRunOutput> {
  const { listings, providerNote } = await crawlLocalListings({
    provider: filters.provider ?? "mock",
  });

  const leads = listings
    .filter((listing) => applyFilters(listing, filters))
    .map((listing) => {
      const corpus = `${listing.title} ${listing.description}`.toLowerCase();
      const privateMatches = findKeywords(corpus, PRIVATE_KEYWORDS);
      const agencyMatches = findKeywords(corpus, AGENCY_KEYWORDS);
      const privateSignal = !listing.isAgency && privateMatches.length > 0;
      const temperature = computeTemperature(listing, privateSignal);

      return {
        id: listing.id,
        source: listing.source,
        title: listing.title,
        description: listing.description,
        location: listing.location,
        priceXpf: listing.priceXpf,
        previousPriceXpf: listing.previousPriceXpf,
        discoveredAt: listing.postedAt,
        isAgency: listing.isAgency,
        latitude: listing.latitude,
        longitude: listing.longitude,
        matchedKeywords: [...privateMatches, ...agencyMatches],
        privateSignal,
        temperature,
        score: scoreLead(listing, privateSignal),
        salesPitch: summarizeToPitch(listing),
      } satisfies Lead;
    })
    .sort((a, b) => b.score - a.score);

  const byCategory: Record<LeadCategory, number> = {
    Hot: leads.filter((lead) => lead.temperature === "Hot").length,
    Warm: leads.filter((lead) => lead.temperature === "Warm").length,
    Cold: leads.filter((lead) => lead.temperature === "Cold").length,
  };

  const privateCount = leads.filter((lead) => !lead.isAgency).length;
  const agencyCount = leads.filter((lead) => lead.isAgency).length;
  const denominator = leads.length > 0 ? leads.length : 1;

  return {
    generatedAt: new Date().toISOString(),
    providerNote,
    stats: {
      privateCount,
      agencyCount,
      privateRatio: privateCount / denominator,
      byCategory,
      scanned: listings.length,
      matched: leads.length,
    },
    leads,
  };
}
