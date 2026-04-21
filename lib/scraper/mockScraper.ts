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

export interface Listing {
  id: string;
  source: ListingSource;
  title: string;
  description: string;
  location: Zone;
  priceXpf: number;
  postedAt: string;
  previousPriceXpf?: number;
  isAgency: boolean;
  latitude: number;
  longitude: number;
}

type RawListing = Omit<Listing, "previousPriceXpf"> & {
  previousPriceXpf?: number | null;
};

export type ScraperConfig = {
  provider?: "mock" | "firecrawl" | "apify";
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
  const listings = (mockListings as RawListing[]).map((listing) => ({
    ...listing,
    previousPriceXpf:
      typeof listing.previousPriceXpf === "number" ? listing.previousPriceXpf : undefined,
  }));

  return {
    listings,
    providerNote: providerNote[provider],
  };
}
