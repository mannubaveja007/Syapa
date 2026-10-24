export interface TranscriptSegmentLike {
  speaker: string;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

export interface ChunkResult {
  content: string;
  chunkIndex: number;
  metadata: {
    startSegmentIndex?: number;
    endSegmentIndex?: number;
    startTimeMs?: number;
    endTimeMs?: number;
    wordCount: number;
  };
}

/**
 * Splits plain text into chunks of ~300-500 words with configurable overlap (~50 words).
 */
export function chunkText(
  text: string,
  targetWords = 350,
  overlapWords = 50
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= targetWords) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + targetWords, words.length);
    const chunkSlice = words.slice(startIndex, endIndex);
    chunks.push(chunkSlice.join(" "));

    if (endIndex === words.length) break;
    startIndex += targetWords - overlapWords;
  }

  return chunks;
}

/**
 * Chunks a list of transcript segments into coherent conversation chunks (~300-500 words)
 * preserving speaker tags and timestamps.
 */
export function chunkTranscriptSegments(
  segments: TranscriptSegmentLike[],
  targetWords = 350,
  overlapWords = 50
): ChunkResult[] {
  if (!segments.length) return [];

  const chunks: ChunkResult[] = [];
  let currentWords: string[] = [];
  let currentSegmentSlice: { seg: TranscriptSegmentLike; index: number }[] = [];
  let chunkIdx = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segText = `[${seg.speaker}]: ${seg.text}`;
    const segWords = segText.split(/\s+/);

    currentWords.push(...segWords);
    currentSegmentSlice.push({ seg, index: i });

    if (currentWords.length >= targetWords || i === segments.length - 1) {
      const firstSeg = currentSegmentSlice[0].seg;
      const lastSeg = currentSegmentSlice[currentSegmentSlice.length - 1].seg;

      const formattedContent = currentSegmentSlice
        .map((s) => `[${s.seg.speaker}]: ${s.seg.text}`)
        .join("\n");

      chunks.push({
        content: formattedContent,
        chunkIndex: chunkIdx++,
        metadata: {
          startSegmentIndex: currentSegmentSlice[0].index,
          endSegmentIndex: currentSegmentSlice[currentSegmentSlice.length - 1].index,
          startTimeMs: firstSeg.startTimeMs,
          endTimeMs: lastSeg.endTimeMs,
          wordCount: currentWords.length,
        },
      });

      // Prepare overlap for next chunk
      if (i < segments.length - 1) {
        // Retain the trailing segments that fit within overlapWords
        let accumulatedOverlap = 0;
        const overlapSlice: { seg: TranscriptSegmentLike; index: number }[] = [];
        for (let j = currentSegmentSlice.length - 1; j >= 0; j--) {
          const item = currentSegmentSlice[j];
          const wordsCount = item.seg.text.split(/\s+/).length;
          accumulatedOverlap += wordsCount;
          overlapSlice.unshift(item);
          if (accumulatedOverlap >= overlapWords) break;
        }

        currentSegmentSlice = overlapSlice;
        currentWords = currentSegmentSlice.flatMap((s) =>
          `[${s.seg.speaker}]: ${s.seg.text}`.split(/\s+/)
        );
      }
    }
  }

  return chunks;
}
