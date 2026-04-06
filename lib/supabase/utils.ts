import { PostgrestResponse } from "@supabase/supabase-js";

/**
 * Reusable utility to fetch all records from a Supabase query with pagination.
 */
export async function fetchAll<T>(
  queryBuilder: (range: {
    from: number;
    to: number;
  }) => PromiseLike<PostgrestResponse<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const allData: T[] = [];
  let pageNumber = 0;
  let hasMore = true;

  while (hasMore) {
    const from = pageNumber * pageSize;
    const to = (pageNumber + 1) * pageSize - 1;

    const { data, error } = await queryBuilder({ from, to });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData.push(...data);
      pageNumber++;
      if (data.length < pageSize) {
        hasMore = false;
      }
    }
  }

  return allData;
}
