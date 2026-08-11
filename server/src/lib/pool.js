/** Runs async tasks with bounded concurrency, preserving input order. */
export async function mapWithConcurrency(items, limit, worker) {
  const list = [...items];
  const results = new Array(list.length);
  const size = Math.max(1, Math.min(limit || 1, list.length || 1));
  let cursor = 0;

  const runners = Array.from({ length: size }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) return;
      results[index] = await worker(list[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

/** Promise-based sleep used for retry backoff. */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
