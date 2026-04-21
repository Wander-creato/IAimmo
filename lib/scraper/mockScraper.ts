import mockListings from "@/lib/data/mockListings.json";

export type ListingSource = "Le Gratuit" | "Immobilier.nc" | "Facebook Groups";
export type Zone =
  | "Noumea"
  | "Nouméa"
  | "Dumbea"
  | "Dumbéa"
  | "Paita"
  | "Païta"
  | "Mont-Dore";
export type ChargesType = "HC" | "CC";

export interface Listing {
  id: string;
  source: ListingSource;
  title: string;
  description: string;
  location: Zone;
  district: string;
  priceXpf: number;
  postedAt: string;
  previousPriceXpf?: number;
  isAgency: boolean;
  url: string;
  surfaceM2?: number;
  phoneNumber?: string;
  chargesType?: ChargesType;
  latitude: number;
  longitude: number;
}

type RawListing = Omit<Listing, "previousPriceXpf"> & {
  previousPriceXpf?: number | null;
};

export type ScraperConfig = {
  provider?: "mock" | "firecrawl" | "apify";
  rateLimitMs?: number;
};

const providerNote: Record<"mock" | "firecrawl" | "apify", string> = {
  mock: "Mock scraper active. Replace with Firecrawl/Apify call in production.",
  firecrawl:
    "Firecrawl placeholder enabled. Next step: call Firecrawl API and transform output into Listing[] schema.",
  apify:
    "Apify placeholder enabled. Next step: trigger actor runs and map actor dataset rows into Listing[] schema.",
};

export async function crawlLocalListings(
  config: ScraperConfig = { provider: "mock" },
): Promise<{ listings: Listing[]; providerNote: string }> {
  const provider = config.provider ?? "mock";
  const rateLimitMs = config.rateLimitMs ?? 200;
  const wait = (delay: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, delay);
    });

  // Rate limiting placeholder to mimic respectful crawl pacing between requests.
  const listings: Listing[] = [];
  for (const rawListing of mockListings as RawListing[]) {
    await wait(rateLimitMs);
    listings.push({
      ...rawListing,
      previousPriceXpf:
        typeof rawListing.previousPriceXpf === "number"
          ? rawListing.previousPriceXpf
          : undefined,
    });
  }

  return {
    listings,
    providerNote: providerNote[provider],
  };
}
