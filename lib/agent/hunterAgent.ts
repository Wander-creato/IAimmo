import existingLeadIndex from "@/lib/data/existingLeadIndex.json";
import { notifyHotLeads } from "@/lib/notifications/webhookService";
import type { ChargesType, Listing, Zone } from "@/lib/scraper/mockScraper";
import { crawlLocalListings } from "@/lib/scraper/mockScraper";

const TARGET_LOCATIONS: readonly Zone[] = ["Nouméa", "Dumbéa", "Païta", "Mont-Dore"];
const PRIVATE_KEYWORDS = [
  "particulier",
  "urgent",
  "pas d'agence",
  "sans agence",
  "proprietaire",
];
const AGENCY_KEYWORDS = ["agence", "mandat", "honoraires", "exclusivite"];
const NC_JARGON = [
  "f1",
  "f2",
  "f3",
  "f4",
  "t2",
  "t3",
  "vdc",
  "vdt",
  "pk4",
  "pk6",
  "pk7",
  "hors charges",
  "housings",
  "charges comprises",
  "cc",
  "hc",
];

export type LeadCategory = "Hot" | "Warm" | "Cold";
export type MarketZone =
  | "Noumea Sud"
  | "Noumea Centre"
  | "Noumea Nord"
  | "Grand Noumea"
  | "Hors Cible";

type ExistingIndexEntry = {
  id: string;
  phoneNumber?: string;
  surfaceM2?: number;
  priceXpf: number;
};

export interface LeadFilters {
  minPriceXpf?: number;
  maxPriceXpf?: number;
  locations?: Zone[];
  requiredKeywords?: string[];
  provider?: "mock" | "firecrawl" | "apify";
  rateLimitMs?: number;
  notifyHotLeads?: boolean;
}

export interface Lead {
  id: string;
  source: Listing["source"];
  title: string;
  description: string;
  location: Zone;
  district: string;
  marketZone: MarketZone;
  priceXpf: number;
  previousPriceXpf?: number;
  discoveredAt: string;
  isAgency: boolean;
  url: string;
  surfaceM2?: number;
  phoneNumber?: string;
  chargesType?: ChargesType;
  latitude: number;
  longitude: number;
  matchedKeywords: string[];
  localVocabulary: string[];
  privateSignal: boolean;
  temperature: LeadCategory;
  confidenceScore: number;
  score: number;
  salesPitch: [string, string, string];
  approachSms: string;
}

export interface WeeklyStats {
  privateCount: number;
  agencyCount: number;
  privateRatio: number;
  byCategory: Record<LeadCategory, number>;
  byMarketZone: Record<MarketZone, number>;
  scanned: number;
  matched: number;
  duplicatesFiltered: number;
}

// PydanticAI-like structured response contract used by the UI.
export interface AgentRunOutput {
  generatedAt: string;
  providerNote: string;
  notifications: {
    enabled: boolean;
    attempted: number;
    sent: number;
  };
  stats: WeeklyStats;
  leads: Lead[];
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizePhone(phone?: string) {
  if (!phone) return "";
  const digitsOnly = phone.replace(/[^\d+]/g, "");
  return digitsOnly.startsWith("+") ? digitsOnly : digitsOnly.replace(/\D/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function findKeywords(text: string, keywords: readonly string[]) {
  const normalized = normalizeText(text);
  return keywords.filter((keyword) => normalized.includes(normalizeText(keyword)));
}

function classifyMarketZone(listing: Listing): MarketZone {
  const location = normalizeText(listing.location);
  const district = normalizeText(listing.district);

  if (["dumbea", "paita", "mont-dore"].includes(location)) {
    return "Grand Noumea";
  }

  if (location.includes("noumea")) {
    if (district.includes("anse vata") || district.includes("baie des citrons")) {
      return "Noumea Sud";
    }
    if (
      district.includes("riviere salee") ||
      district.includes("ducos") ||
      district.includes("pk4")
    ) {
      return "Noumea Nord";
    }
    if (district.includes("pk6") || district.includes("pk7")) {
      return "Grand Noumea";
    }
    if (district.includes("vdc") || district.includes("vdt") || district.includes("centre")) {
      return "Noumea Centre";
    }
    return "Noumea Centre";
  }

  return "Hors Cible";
}

function buildSurfacePriceKey(surfaceM2: number | undefined, priceXpf: number) {
  return typeof surfaceM2 === "number" ? `${surfaceM2}|${priceXpf}` : "";
}

function deduplicateListings(listings: Listing[]) {
  const existingEntries = existingLeadIndex as ExistingIndexEntry[];
  const knownPhones = new Set(existingEntries.map((entry) => normalizePhone(entry.phoneNumber)));
  const knownSurfacePrice = new Set(
    existingEntries.map((entry) => buildSurfacePriceKey(entry.surfaceM2, entry.priceXpf)),
  );
  const seenPhones = new Set<string>();
  const seenSurfacePrice = new Set<string>();

  let duplicatesFiltered = 0;
  const uniqueListings = listings.filter((listing) => {
    const phone = normalizePhone(listing.phoneNumber);
    const surfacePrice = buildSurfacePriceKey(listing.surfaceM2, listing.priceXpf);
    const isDuplicate =
      (phone && (knownPhones.has(phone) || seenPhones.has(phone))) ||
      (surfacePrice && (knownSurfacePrice.has(surfacePrice) || seenSurfacePrice.has(surfacePrice)));

    if (isDuplicate) {
      duplicatesFiltered += 1;
      return false;
    }

    if (phone) seenPhones.add(phone);
    if (surfacePrice) seenSurfacePrice.add(surfacePrice);
    return true;
  });

  return { uniqueListings, duplicatesFiltered };
}

function extractLocalVocabulary(listing: Listing) {
  const corpus = normalizeText(
    `${listing.title} ${listing.description} ${listing.district} ${listing.chargesType ?? ""}`,
  );
  return NC_JARGON.filter((token) => corpus.includes(token));
}

function computeConfidenceScore(
  listing: Listing,
  privateMatches: string[],
  agencyMatches: string[],
  localVocabulary: string[],
) {
  let confidence = 0.22;

  if (listing.source === "Le Gratuit" || listing.source === "Facebook Groups") {
    confidence += 0.12;
  }
  if (privateMatches.includes("particulier") || privateMatches.includes("proprietaire")) {
    confidence += 0.24;
  }
  if (privateMatches.includes("pas d'agence") || privateMatches.includes("sans agence")) {
    confidence += 0.16;
  }
  if (privateMatches.includes("urgent")) {
    confidence += 0.08;
  }
  if (listing.phoneNumber) {
    confidence += 0.06;
  }
  if (localVocabulary.some((keyword) => ["f1", "f2", "f3", "f4", "t2", "t3"].includes(keyword))) {
    confidence += 0.06;
  }
  if (listing.isAgency) {
    confidence -= 0.42;
  }
  if (agencyMatches.length > 0) {
    confidence -= 0.22;
  }
  if (agencyMatches.includes("mandat")) {
    confidence -= 0.14;
  }
  if (privateMatches.length > 0 && agencyMatches.length > 0) {
    confidence -= 0.1;
  }

  return clamp(confidence, 0, 1);
}

function computeLeadScore(listing: Listing, confidenceScore: number) {
  const ageHours = (Date.now() - new Date(listing.postedAt).getTime()) / 3_600_000;
  const freshness = clamp(1 - ageHours / 72, 0, 1);
  const priceDropSignal =
    typeof listing.previousPriceXpf === "number" && listing.previousPriceXpf > listing.priceXpf
      ? clamp((listing.previousPriceXpf - listing.priceXpf) / listing.previousPriceXpf, 0, 1)
      : 0;

  return clamp(confidenceScore * 0.65 + freshness * 0.25 + priceDropSignal * 0.1, 0, 1);
}

function computeTemperature(listing: Listing, confidenceScore: number, score: number): LeadCategory {
  if (listing.isAgency || confidenceScore < 0.45) {
    return "Cold";
  }
  if (
    typeof listing.previousPriceXpf === "number" &&
    listing.previousPriceXpf > listing.priceXpf &&
    score < 0.8
  ) {
    return "Warm";
  }
  if (score >= 0.8) {
    return "Hot";
  }
  return "Warm";
}

function summarizeToPitch(listing: Listing, marketZone: MarketZone): [string, string, string] {
  const compactDescription = listing.description
    .replace(/\s+/g, " ")
    .replace(/[.!?]+/g, ".")
    .trim();

  const chargesCopy =
    listing.chargesType === "CC"
      ? "Charges comprises (CC)"
      : listing.chargesType === "HC"
        ? "Hors charges (HC)"
        : "Charges non precisees";

  return [
    `${listing.title} dans le secteur ${listing.district} (${marketZone}) a ${listing.priceXpf.toLocaleString("fr-FR")} XPF.`,
    compactDescription.length > 115
      ? `${compactDescription.slice(0, 112)}...`
      : compactDescription,
    `${chargesCopy}. Fenetre de contact courte pour capter le vendeur en direct.`,
  ];
}

function composeApproachSms(listing: Listing, pitch: [string, string, string]) {
  const keyBenefit = pitch[0].replace(/\.$/, "");
  return `Bonjour, je vous contacte au sujet de votre bien (${keyBenefit}). J'accompagne actuellement des acquereurs finances sur Grand Noumea et votre annonce ressort comme une opportunite serieuse. Si vous etes disponible, je vous propose un echange rapide aujourd'hui pour valider les points cles et vous faire une proposition claire.`;
}

function applyFilters(listing: Listing, filters: LeadFilters): boolean {
  const selectedLocations =
    filters.locations && filters.locations.length > 0 ? filters.locations : [...TARGET_LOCATIONS];
  const locationMatches = selectedLocations
    .map((zone) => normalizeText(zone))
    .includes(normalizeText(listing.location));
  const aboveMin =
    typeof filters.minPriceXpf === "number" ? listing.priceXpf >= filters.minPriceXpf : true;
  const belowMax =
    typeof filters.maxPriceXpf === "number" ? listing.priceXpf <= filters.maxPriceXpf : true;

  if (filters.requiredKeywords && filters.requiredKeywords.length > 0) {
    const text = normalizeText(`${listing.title} ${listing.description} ${listing.district}`);
    const hasKeyword = filters.requiredKeywords
      .map((keyword) => normalizeText(keyword))
      .some((keyword) => text.includes(keyword));
    return locationMatches && aboveMin && belowMax && hasKeyword;
  }

  return locationMatches && aboveMin && belowMax;
}

export async function runHunterAgent(filters: LeadFilters = {}): Promise<AgentRunOutput> {
  const { listings, providerNote } = await crawlLocalListings({
    provider: filters.provider ?? "mock",
    rateLimitMs: filters.rateLimitMs ?? 220,
  });
  const filteredListings = listings.filter((listing) => applyFilters(listing, filters));
  const { uniqueListings, duplicatesFiltered } = deduplicateListings(filteredListings);

  const leads = uniqueListings
    .map((listing) => {
      const corpus = `${listing.title} ${listing.description} ${listing.district}`;
      const privateMatches = findKeywords(corpus, PRIVATE_KEYWORDS);
      const agencyMatches = findKeywords(corpus, AGENCY_KEYWORDS);
      const localVocabulary = extractLocalVocabulary(listing);
      const confidenceScore = computeConfidenceScore(
        listing,
        privateMatches,
        agencyMatches,
        localVocabulary,
      );
      const score = computeLeadScore(listing, confidenceScore);
      const temperature = computeTemperature(listing, confidenceScore, score);
      const marketZone = classifyMarketZone(listing);
      const salesPitch = summarizeToPitch(listing, marketZone);
      const approachSms = composeApproachSms(listing, salesPitch);

      return {
        id: listing.id,
        source: listing.source,
        title: listing.title,
        description: listing.description,
        location: listing.location,
        district: listing.district,
        marketZone,
        priceXpf: listing.priceXpf,
        previousPriceXpf: listing.previousPriceXpf,
        discoveredAt: listing.postedAt,
        isAgency: listing.isAgency,
        url: listing.url,
        surfaceM2: listing.surfaceM2,
        phoneNumber: listing.phoneNumber,
        chargesType: listing.chargesType,
        latitude: listing.latitude,
        longitude: listing.longitude,
        matchedKeywords: [...privateMatches, ...agencyMatches],
        localVocabulary,
        privateSignal: confidenceScore >= 0.65,
        temperature,
        confidenceScore,
        score,
        salesPitch,
        approachSms,
      } satisfies Lead;
    })
    .sort((first, second) => second.score - first.score);

  const byCategory: Record<LeadCategory, number> = {
    Hot: leads.filter((lead) => lead.temperature === "Hot").length,
    Warm: leads.filter((lead) => lead.temperature === "Warm").length,
    Cold: leads.filter((lead) => lead.temperature === "Cold").length,
  };
  const byMarketZone: Record<MarketZone, number> = {
    "Noumea Sud": leads.filter((lead) => lead.marketZone === "Noumea Sud").length,
    "Noumea Centre": leads.filter((lead) => lead.marketZone === "Noumea Centre").length,
    "Noumea Nord": leads.filter((lead) => lead.marketZone === "Noumea Nord").length,
    "Grand Noumea": leads.filter((lead) => lead.marketZone === "Grand Noumea").length,
    "Hors Cible": leads.filter((lead) => lead.marketZone === "Hors Cible").length,
  };

  const privateCount = leads.filter((lead) => lead.confidenceScore >= 0.65).length;
  const agencyCount = leads.length - privateCount;
  const denominator = leads.length > 0 ? leads.length : 1;

  const notifications = filters.notifyHotLeads
    ? await notifyHotLeads(leads)
    : { sent: 0, attempted: 0 };

  return {
    generatedAt: new Date().toISOString(),
    providerNote,
    notifications: {
      enabled: Boolean(filters.notifyHotLeads),
      attempted: notifications.attempted,
      sent: notifications.sent,
    },
    stats: {
      privateCount,
      agencyCount,
      privateRatio: privateCount / denominator,
      byCategory,
      byMarketZone,
      scanned: listings.length,
      matched: leads.length,
      duplicatesFiltered,
    },
    leads,
  };
}
