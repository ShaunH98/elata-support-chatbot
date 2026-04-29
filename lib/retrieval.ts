import kbData from "@/data/kb.json";

export interface KbChunk {
  doc_id: string;
  doc_label: string;
  page: number;
  text: string;
}

const KB: KbChunk[] = kbData as KbChunk[];

// Words we shouldn't score on
const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with","is",
  "are","was","were","be","been","being","it","its","this","that","these","those",
  "i","you","he","she","we","they","my","your","our","their","what","when","where",
  "which","how","why","do","does","did","can","could","should","would","will","may",
  "might","have","has","had","not","no","yes","if","then","than","so","as","by",
  "from","up","down","out","into","about","there","here","me","us","them","his",
  "her","him","i'm","i've","i'd","you're","you've","don't","can't","won't","isn't",
  "aren't","wasn't","weren't","please","tell","know","want","need","get","find"
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s\-™®]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Pre-compute document frequencies for IDF weighting
const DF: Map<string, number> = new Map();
{
  for (const chunk of KB) {
    const seen = new Set(tokenize(chunk.text));
    for (const tok of seen) {
      DF.set(tok, (DF.get(tok) || 0) + 1);
    }
  }
}
const N = KB.length;

function scoreChunk(query: string, chunk: KbChunk): number {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return 0;
  const cTokens = tokenize(chunk.text);
  const cFreq: Map<string, number> = new Map();
  for (const t of cTokens) cFreq.set(t, (cFreq.get(t) || 0) + 1);

  let score = 0;
  for (const qt of qTokens) {
    const tf = cFreq.get(qt) || 0;
    if (tf === 0) continue;
    const df = DF.get(qt) || 1;
    const idf = Math.log(1 + N / df);
    score += (1 + Math.log(tf)) * idf;
  }

  // Lift exact-phrase matches (helps with "alarm code", "power outage" etc.)
  const ql = query.toLowerCase();
  if (ql.length > 4 && chunk.text.toLowerCase().includes(ql)) {
    score *= 1.5;
  }

  // Small bias toward IFU pages (more authoritative for support)
  if (chunk.doc_id.startsWith("IFU")) score *= 1.05;

  return score;
}

export function retrieve(query: string, k = 6): KbChunk[] {
  const scored = KB.map((c) => ({ chunk: c, s: scoreChunk(query, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k);
  return scored.map((x) => x.chunk);
}

export function formatContext(chunks: KbChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] ${c.doc_label} — page ${c.page}\n${c.text}`,
    )
    .join("\n\n---\n\n");
}

export const KB_STATS = {
  totalChunks: KB.length,
  totalDocs: new Set(KB.map((c) => c.doc_id)).size,
};
