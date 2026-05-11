import type { StockLookup } from "@/lib/yahoo";

export type LookupState = {
  lookup: StockLookup | null;
  message: string | null;
};

export type MutationResult = {
  ok: boolean;
  message: string | null;
};
