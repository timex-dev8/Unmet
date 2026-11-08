// quote must match its source word for word, ignoring punctuation and case. only a one-letter typo in a longer word passes,
// so "this is not a problem" never matches "this is a problem". shown text is the source's own

const MIN_QUOTE_WORDS = 4;
export const MAX_QUOTE_WORDS = 15;

type Token = { word: string; start: number; end: number };

const norm = (text: string) => text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[‘’`]/g, "'");

function tokens(text: string): Token[] {
  const found: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}'‘’`]+/gu)) {
    const word = norm(match[0]).replace(/'/g, ""); // "can't" and "cant" match
    if (word) found.push({ word, start: match.index, end: match.index + match[0].length });
  }
  return found;
}

function oneEditApart(first: string, second: string) {
  if (Math.abs(first.length - second.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < first.length && j < second.length) {
    if (first[i] === second[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (first.length > second.length) i++;
    else if (second.length > first.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (first.length - i) + (second.length - j) <= 1;
}

const sameWord = (first: string, second: string) => first === second || (first.length >= 5 && second.length >= 5 && oneEditApart(first, second));

export function findQuote(quote: string, sourceText: string): string | null {
  const quoteWords = tokens(quote).map((token) => token.word);
  if (quoteWords.length < MIN_QUOTE_WORDS || quoteWords.length > MAX_QUOTE_WORDS) return null;
  const sourceWords = tokens(sourceText);
  for (let i = 0; i + quoteWords.length <= sourceWords.length; i++) {
    let typos = 0;
    let matched = 0;
    for (; matched < quoteWords.length; matched++) {
      const sourceWord = sourceWords[i + matched].word;
      if (sourceWord === quoteWords[matched]) continue;
      if (++typos > 1 || !sameWord(sourceWord, quoteWords[matched])) break;
    }
    if (matched === quoteWords.length)
      return sourceText
        .slice(sourceWords[i].start, sourceWords[i + quoteWords.length - 1].end)
        .replace(/\s+/g, " ")
        .trim();
  }
  return null;
}
