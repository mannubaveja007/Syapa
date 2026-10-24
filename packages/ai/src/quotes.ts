export interface QuotedItem {
  quote: string;
  [key: string]: any;
}

export interface QuoteVerificationResult<T extends QuotedItem> {
  verified: T[];
  dropped: T[];
  droppedCount: number;
}

/**
 * Normalizes text by removing punctuation variations and collapsing whitespace.
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verifies that a quote actually appears in the source text or transcript.
 * This is 100% deterministic code, not LLM output.
 */
export function verifyQuoteInSource(quote: string, sourceText: string): boolean {
  if (!quote || !quote.trim()) return false;
  if (!sourceText || !sourceText.trim()) return false;

  // Direct substring check first
  if (sourceText.includes(quote.trim())) {
    return true;
  }

  // Case-insensitive trimmed check
  const sourceLower = sourceText.toLowerCase();
  const quoteLower = quote.trim().toLowerCase();
  if (sourceLower.includes(quoteLower)) {
    return true;
  }

  // Normalized punctuation and whitespace check
  const normSource = normalizeForComparison(sourceText);
  const normQuote = normalizeForComparison(quote);

  if (normQuote.length > 5 && normSource.includes(normQuote)) {
    return true;
  }

  return false;
}

/**
 * Filters a list of items having a `quote` property against source text or transcripts.
 * Any item whose quote is not grounded in the source is dropped, and droppedCount is incremented.
 */
export function verifyAndFilterQuotes<T extends QuotedItem>(
  items: T[],
  sourceText: string
): QuoteVerificationResult<T> {
  const verified: T[] = [];
  const dropped: T[] = [];

  for (const item of items) {
    if (verifyQuoteInSource(item.quote, sourceText)) {
      verified.push(item);
    } else {
      dropped.push(item);
    }
  }

  return {
    verified,
    dropped,
    droppedCount: dropped.length,
  };
}
