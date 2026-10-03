import { QueryClient } from "@tanstack/react-query";

/**
 * Default options so that revisiting a page shows cached data immediately
 * (like Google Drive / Notion), with background revalidation.
 */
export const queryClientDefaultOptions: NonNullable<
  ConstructorParameters<typeof QueryClient>[0]["defaultOptions"]
> = {
  queries: {
    staleTime: 60 * 1000, // 1 min – data considered fresh
    gcTime: 5 * 60 * 1000, // 5 min – keep unused cache
  },
};

export function createQueryClient() {
  return new QueryClient({ defaultOptions: queryClientDefaultOptions });
}
