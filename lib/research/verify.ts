// Checks that a quote really appears in its source: same words in the same order, ignoring
// punctuation and case, allowing at most one word different (a typo fix, a dropped "the").
// Anything looser is treated as a paraphrase and thrown away.

export const MIN_QUOTE_WORDS = 4;
export const MAX_QUOTE_WORDS = 15;

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Word-level edit distance, stopping early once it exceeds `limit`. */
function distance(a: string[], b: string[], limit: number) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > limit) return limit + 1;
    prev = cur;
  }
  return prev[b.length];
}

export function quoteFound(quote: string, sourceText: string) {
  const q = words(quote);
  if (q.length < MIN_QUOTE_WORDS || q.length > MAX_QUOTE_WORDS) return false;
  const src = words(sourceText);
  const joinedQ = q.join(" ");
  if (` ${src.join(" ")} `.includes(` ${joinedQ} `)) return true;
  // Slide a window over the source and allow one word of difference.
  for (let i = 0; i + q.length - 1 <= src.length; i++) {
    if (src[i] !== q[0] && src[i + 1] !== q[1]) continue; // quick skip: windows must start near a match
    for (const len of [q.length - 1, q.length, q.length + 1]) {
      if (len < 1 || i + len > src.length) continue;
      if (distance(q, src.slice(i, i + len), 1) <= 1) return true;
    }
  }
  return false;
}
