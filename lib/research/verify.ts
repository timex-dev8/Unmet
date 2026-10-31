// Checks that a quote really appears in its source: the same words in the same order, ignoring
// punctuation and case. Only a one-letter typo inside a longer word is forgiven; a dropped, added
// or swapped word fails, since "this is not a problem" must never pass as "this is a problem".
// What gets shown is the source's own text, never the model's version of it.

export const MIN_QUOTE_WORDS = 4;
export const MAX_QUOTE_WORDS = 15;

type Token = { word: string; start: number; end: number };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[‘’`]/g, "'");

/** Words with their position in the original text, so the matching span can be cut out of it. */
function tokens(s: string): Token[] {
  const out: Token[] = [];
  for (const m of s.matchAll(/[\p{L}\p{N}'‘’`]+/gu)) {
    const word = norm(m[0]).replace(/'/g, ""); // "can't" and "cant" are the same word
    if (word) out.push({ word, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** True when two words differ by at most one letter (added, dropped or changed). */
function oneEditApart(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Short words ("not", "no", "is", "can") carry meaning in a single letter, so they must match exactly.
const sameWord = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && oneEditApart(a, b));

/** The source's own text for `quote`, or null when the quote isn't really there. */
export function findQuote(quote: string, sourceText: string): string | null {
  const q = tokens(quote).map((t) => t.word);
  if (q.length < MIN_QUOTE_WORDS || q.length > MAX_QUOTE_WORDS) return null;
  const src = tokens(sourceText);
  for (let i = 0; i + q.length <= src.length; i++) {
    let typos = 0;
    let k = 0;
    for (; k < q.length; k++) {
      const w = src[i + k].word;
      if (w === q[k]) continue;
      if (++typos > 1 || !sameWord(w, q[k])) break;
    }
    if (k === q.length)
      return sourceText
        .slice(src[i].start, src[i + q.length - 1].end)
        .replace(/\s+/g, " ")
        .trim();
  }
  return null;
}
