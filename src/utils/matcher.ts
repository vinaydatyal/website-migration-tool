import { CrawlEntry, MatchStrategy, UrlMapping, MappingStatus, ParityDiscrepancy, MigrationProfile } from '../types/migration';
import { evaluateParityDiscrepancies } from './parityAuditor';

// List of common stop words in URLs and SEO titles
const STOP_WORDS = new Set([
  'the', 'and', 'or', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be',
  'this', 'that', 'these', 'those', 'html', 'php', 'aspx', 'htm', 'index',
  'category', 'product', 'post', 'tag', 'tags', 'author', 'page', 'default'
]);

// Recognized geo-location and modifier tokens for negative penalty checks
const COMMON_GEO_TOKENS = new Set([
  'dallas', 'houston', 'austin', 'miami', 'orlando', 'chicago', 'seattle', 'boston',
  'denver', 'phoenix', 'atlanta', 'london', 'toronto', 'sydney', 'newyork', 'nyc',
  'california', 'texas', 'florida', 'uk', 'usa', 'canada', 'australia', 'dubai'
]);

/**
 * Tokenizes a string (slug or title) into clean significant words
 */
export function extractTokens(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-_/]/g, ' ')
    .split(/[\s-_/]+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Optimized Levenshtein distance calculation using two rows (O(N) memory)
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  let v0 = new Array(s2.length + 1);
  let v1 = new Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) v0[i] = i;

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    const temp = v0;
    v0 = v1;
    v1 = temp;
  }
  return v0[s2.length];
}

/**
 * Calculates string similarity ratio (0.0 to 1.0)
 */
export function stringSimilarity(s1: string, s2: string): number {
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1 === str2) return 1.0;

  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(str1, str2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Jaccard token overlap similarity (0.0 to 1.0)
 */
export function tokenJaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  let intersection = 0;

  for (const t of set1) {
    if (set2.has(t)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculates negative penalties (Geo mismatches, pagination conflicts, number differences)
 */
export function calculatePenalties(
  source: CrawlEntry, 
  target: CrawlEntry,
  srcTokensSet?: Set<string>,
  tgtTokensSet?: Set<string>
): { penalty: number; reasons: string[] } {
  let penalty = 0;
  const reasons: string[] = [];

  const srcTokens = srcTokensSet || new Set(extractTokens(source.normalizedPath + ' ' + source.title));
  const tgtTokens = tgtTokensSet || new Set(extractTokens(target.normalizedPath + ' ' + target.title));

  // 1. Geo-Modifier Penalty
  const srcGeos = Array.from(srcTokens).filter(t => COMMON_GEO_TOKENS.has(t));
  const tgtGeos = Array.from(tgtTokens).filter(t => COMMON_GEO_TOKENS.has(t));

  if (srcGeos.length > 0 && tgtGeos.length > 0) {
    const geoMatch = srcGeos.some(g => tgtGeos.includes(g));
    if (!geoMatch) {
      penalty += 45;
      reasons.push(`Geo-location mismatch detected (${srcGeos.join(', ')} vs ${tgtGeos.join(', ')})`);
    }
  }

  // 2. Pagination / Page Number Penalty
  const srcPageMatch = source.normalizedPath.match(/\/page\/(\d+)/i) || source.normalizedPath.match(/-p(\d+)$/i);
  const tgtPageMatch = target.normalizedPath.match(/\/page\/(\d+)/i) || target.normalizedPath.match(/-p(\d+)$/i);
  if (srcPageMatch && tgtPageMatch && srcPageMatch[1] !== tgtPageMatch[1]) {
    penalty += 35;
    reasons.push(`Pagination mismatch: Page ${srcPageMatch[1]} vs Page ${tgtPageMatch[1]}`);
  }

  // 3. Year / Date Archive Penalty
  const srcYear = source.normalizedPath.match(/\/20(1\d|2\d)\//);
  const tgtYear = target.normalizedPath.match(/\/20(1\d|2\d)\//);
  if (srcYear && tgtYear && srcYear[1] !== tgtYear[1]) {
    penalty += 25;
    reasons.push(`Archive year mismatch (${srcYear[1]} vs ${tgtYear[1]})`);
  }

  // 4. URL Depth/Structure Mismatch (reduces false positives across different site sections)
  const srcDepth = source.normalizedPath.split('/').filter(Boolean).length;
  const tgtDepth = target.normalizedPath.split('/').filter(Boolean).length;
  if (Math.abs(srcDepth - tgtDepth) >= 2) {
    penalty += 15;
    reasons.push(`Significant URL depth mismatch (${srcDepth} levels vs ${tgtDepth} levels)`);
  }

  return { penalty, reasons };
}

/**
 * High-performance Inverted Index for Target Crawl to prevent O(N*M) explosions
 */
export class TargetCandidateIndex {
  private exactPathMap = new Map<string, CrawlEntry>();
  private exactTitleMap = new Map<string, CrawlEntry>();
  private exactH1Map = new Map<string, CrawlEntry>();
  private tokenToEntries = new Map<string, Set<CrawlEntry>>();
  
  // Cache extracted tokens to avoid recomputing in tight loops
  public entryTokensCache = new Map<string, { pathTokens: string[], titleTokens: string[], allTokensSet: Set<string> }>();

  public allEntries: CrawlEntry[] = [];

  constructor(targetEntries: CrawlEntry[]) {
    this.allEntries = targetEntries;
    for (const entry of targetEntries) {
      // 1. Path Index
      this.exactPathMap.set(entry.normalizedPath, entry);

      // 2. Title Index
      if (entry.title) {
        this.exactTitleMap.set(entry.title.toLowerCase().trim(), entry);
      }

      // 3. H1 Index
      if (entry.h1) {
        this.exactH1Map.set(entry.h1.toLowerCase().trim(), entry);
      }

      // Pre-extract and cache tokens
      const pathTokens = extractTokens(entry.normalizedPath);
      const titleTokens = extractTokens(entry.title);
      const allTokens = extractTokens(entry.normalizedPath + ' ' + entry.title + ' ' + entry.h1);
      const allTokensSet = new Set(allTokens);

      this.entryTokensCache.set(entry.id, { pathTokens, titleTokens, allTokensSet });

      // 4. Token Index
      for (const token of allTokens) {
        if (!this.tokenToEntries.has(token)) {
          this.tokenToEntries.set(token, new Set());
        }
        this.tokenToEntries.get(token)!.add(entry);
      }
    }
  }

  public findExactPath(path: string): CrawlEntry | undefined {
    return this.exactPathMap.get(path);
  }

  public findExactTitle(title: string): CrawlEntry | undefined {
    if (!title) return undefined;
    return this.exactTitleMap.get(title.toLowerCase().trim());
  }

  public findExactH1(h1: string): CrawlEntry | undefined {
    if (!h1) return undefined;
    return this.exactH1Map.get(h1.toLowerCase().trim());
  }

  /**
   * Retrieves TOP candidate targets that share tokens with the source
   */
  public getCandidates(source: CrawlEntry): CrawlEntry[] {
    const srcTokens = extractTokens(source.normalizedPath + ' ' + source.title + ' ' + source.h1);
    const matchCounts = new Map<CrawlEntry, number>();

    // Fast token counting overlap
    for (const token of srcTokens) {
      const matched = this.tokenToEntries.get(token);
      if (matched) {
        // Skip overly common tokens that match almost everything to prevent index bloat
        if (matched.size > this.allEntries.length * 0.5 && this.allEntries.length > 1000) {
          continue; 
        }
        for (const entry of matched) {
          matchCounts.set(entry, (matchCounts.get(entry) || 0) + 1);
        }
      }
    }

    if (matchCounts.size === 0) {
      return this.allEntries.slice(0, 10);
    }

    // Sort candidates by number of matched tokens (descending)
    const sortedCandidates = Array.from(matchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    // ONLY return top 15 candidates to prevent O(N*M) explosion in Levenshtein checks!
    return sortedCandidates.slice(0, 15);
  }
}

/**
 * Calculates SEO Link Equity Risk Score (0-100) for a source URL
 */
export function calculateRiskScore(source: CrawlEntry, target: CrawlEntry | null | undefined, confidence: number): number {
  let risk = 0;

  // Inlink Equity Weighting (Pages with many internal links have high risk if unmapped or mismatched)
  if (source.inlinks > 100) risk += 50;
  else if (source.inlinks > 40) risk += 35;
  else if (source.inlinks > 10) risk += 20;
  else if (source.inlinks > 0) risk += 10;

  // If unmapped or low confidence
  if (!target || confidence < 60) {
    risk += 40;
  } else if (confidence < 80) {
    risk += 20;
  }

  // If target has error status code
  if (target && target.statusCode >= 400) {
    risk += 40;
  }

  // If source was indexable but target is non-indexable
  if (source.indexability === 'Indexable' && target && target.indexability === 'Non-Indexable') {
    risk += 30;
  }

  return Math.min(100, Math.max(0, risk));
}

/**
 * Full Orchestrated Matching Pipeline (Async Chunked)
 * Breaks processing into small chunks so the browser UI doesn't freeze.
 */
export async function matchSourceAndTargetEntriesAsync(
  sourceEntries: CrawlEntry[],
  targetEntries: CrawlEntry[],
  confidenceThreshold = 75,
  profile: MigrationProfile = 'UNKNOWN',
  onProgress?: (progress: number) => void
): Promise<UrlMapping[]> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('../workers/matcher.worker.ts', import.meta.url), { type: 'module' });
      
      worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'PROGRESS' && onProgress) {
          onProgress(payload);
        } else if (type === 'COMPLETE') {
          resolve(payload);
          worker.terminate();
        } else if (type === 'ERROR') {
          reject(new Error(payload));
          worker.terminate();
        }
      };

      worker.onerror = (err) => {
        console.error("Worker matching failed:", err);
        reject(err);
        worker.terminate();
      };

      worker.postMessage({
        type: 'START_MATCHING',
        sourceEntries,
        targetEntries,
        confidenceThreshold,
        profile
      });
    } catch (e) {
      console.error("Failed to spawn Web Worker", e);
      reject(e);
    }
  });
}
