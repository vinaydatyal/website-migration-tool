import * as loader from "@assemblyscript/loader";
import { CrawlEntry, MatchStrategy, UrlMapping, MappingStatus, ParityDiscrepancy } from '../types/migration';
import { TargetCandidateIndex, extractTokens, tokenJaccardSimilarity, calculatePenalties, stringSimilarity, calculateRiskScore } from '../utils/matcher';
import { evaluateParityDiscrepancies } from '../utils/parityAuditor';

let wasmModule: any = null;

async function initWasm() {
  try {
    const response = await fetch('/matcher.wasm');
    const buffer = await response.arrayBuffer();
    wasmModule = await loader.instantiate(buffer);
    console.log("WASM Module Loaded inside Worker!");
  } catch (e) {
    console.error("WASM fallback to JS due to load error:", e);
  }
}

function wasmStringSimilarity(a: string, b: string): number {
  if (!wasmModule) return stringSimilarity(a, b); // fallback to JS
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  if (a === b) return 1.0;

  const { __newString, __pin, __unpin, levenshteinDistance } = wasmModule.exports;
  
  let aPtr = 0;
  let bPtr = 0;
  try {
    aPtr = __pin(__newString(a));
    bPtr = __pin(__newString(b));
    const dist = levenshteinDistance(aPtr, bPtr);
    const maxLen = Math.max(a.length, b.length);
    return Math.max(0, 1 - dist / maxLen);
  } finally {
    if (aPtr) __unpin(aPtr);
    if (bPtr) __unpin(bPtr);
  }
}

// --- TF-IDF Semantic Matcher ---
let idfMap = new Map<string, number>();

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  if (tokens.length === 0) return tf;
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  const max = Math.max(...Array.from(tf.values()));
  for (const [k, v] of tf.entries()) {
    tf.set(k, v / max);
  }
  return tf;
}

function computeIDF(corpus: string[][]) {
  const N = corpus.length;
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const unique = new Set(doc);
    for (const token of unique) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }
  idfMap.clear();
  for (const [token, count] of df.entries()) {
    idfMap.set(token, Math.log(N / (1 + count)));
  }
}

function computeTFIDF(tokens: string[]): Map<string, number> {
  const tf = computeTF(tokens);
  const tfidf = new Map<string, number>();
  for (const [k, v] of tf.entries()) {
    tfidf.set(k, v * (idfMap.get(k) || Math.log(1))); // Default IDF if unknown
  }
  return tfidf;
}

function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, v] of vecA.entries()) {
    dotProduct += v * (vecB.get(k) || 0);
    normA += v * v;
  }
  for (const v of vecB.values()) {
    normB += v * v;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Receive messages from main thread
self.onmessage = async (e: MessageEvent) => {
  try {
    const { type, sourceEntries, targetEntries, confidenceThreshold, profile } = e.data;

    if (type === 'START_MATCHING') {
    if (!wasmModule) {
      await initWasm();
    }

    const index = new TargetCandidateIndex(targetEntries);
    const mappings: UrlMapping[] = [];
    const CHUNK_SIZE = 250;

    // Index all sources by URL for canonical lookups
    const sourceIndexByUrl = new Map<string, CrawlEntry>();
    let maxVisits = 0;
    for (const source of sourceEntries) {
      if (source.url) {
        sourceIndexByUrl.set(source.url.toLowerCase().trim(), source);
      }
      if (source.visits && source.visits > maxVisits) {
        maxVisits = source.visits;
      }
    }

    // Build TF-IDF Corpus
    const targetCorpus: string[][] = [];
    for (const target of targetEntries) {
      targetCorpus.push(extractTokens(target.normalizedPath + ' ' + target.title));
    }
    computeIDF(targetCorpus);

    // Precompute TF-IDF for all targets
    const targetTfIdfCache = new Map<string, Map<string, number>>();
    for (const target of targetEntries) {
      targetTfIdfCache.set(target.id, computeTFIDF(extractTokens(target.normalizedPath + ' ' + target.title)));
    }

    for (let i = 0; i < sourceEntries.length; i += CHUNK_SIZE) {
      const chunk = sourceEntries.slice(i, i + CHUNK_SIZE);

      for (const source of chunk) {
        let bestTarget: CrawlEntry | null = null;
        let confidenceScore = 0;
        let strategy: MatchStrategy = 'UNMAPPED';
        const reasons: string[] = [];
        
        // Canonical Delegation: If this URL is non-canonical, match using its canonical parent's data
        let matchSource = source;
        const sourceUrlStr = source.url || '';
        const isNonCanonical = source.canonical && source.canonical.toLowerCase().trim() !== sourceUrlStr.toLowerCase().trim();
        
        if (isNonCanonical) {
          const canonicalParent = sourceIndexByUrl.get(source.canonical.toLowerCase().trim());
          if (canonicalParent) {
            matchSource = canonicalParent;
            reasons.push(`Mapped via Canonical Parent: ${canonicalParent.url}`);
          }
        }

        // TIER 1: Exact
        const exactPathTarget = index.findExactPath(matchSource.normalizedPath);
        if (exactPathTarget) {
          bestTarget = exactPathTarget;
          confidenceScore = 100;
          strategy = 'EXACT_PATH';
          if (!isNonCanonical) reasons.push('Exact normalized URL pathname matched');
        }

        // TIER 2: Exact Title
        if (!bestTarget && matchSource.title) {
          const exactTitleTarget = index.findExactTitle(matchSource.title);
          if (exactTitleTarget) {
            bestTarget = exactTitleTarget;
            confidenceScore = 98;
            strategy = 'EXACT_TITLE_H1';
            if (!isNonCanonical) reasons.push('Identical <title> tag matched');
          }
        }

        // TIER 3: Fast Fuzzy Token & String Similarity (WASM ACCELERATED)
        if (!bestTarget) {
          const candidates = index.getCandidates(matchSource);
          let highestScore = 0;
          let topCandidate: CrawlEntry | null = null;
          let topCandidateReasons: string[] = [];

          const srcPathTokens = extractTokens(matchSource.normalizedPath);
          const srcTitleTokens = extractTokens(matchSource.title);
          const srcAllTokensSet = new Set(extractTokens(matchSource.normalizedPath + ' ' + matchSource.title));

          for (const candidate of candidates) {
            const cached = index.entryTokensCache.get(candidate.id);
            const candPathTokens = cached ? cached.pathTokens : extractTokens(candidate.normalizedPath);
            const candTitleTokens = cached ? cached.titleTokens : extractTokens(candidate.title);
            const candAllTokensSet = cached ? cached.allTokensSet : new Set(extractTokens(candidate.normalizedPath + ' ' + candidate.title));

            // Path similarity (WASM)
            const pathJaccard = tokenJaccardSimilarity(srcPathTokens, candPathTokens);
            let pathLevenshtein = 0;
            if (pathJaccard > 0.1 || candidates.length < 5) {
              pathLevenshtein = wasmStringSimilarity(matchSource.normalizedPath, candidate.normalizedPath);
            }
            const pathScore = (pathJaccard * 0.7 + pathLevenshtein * 0.3) * 50;

            // Title similarity (WASM)
            let titleScore = 0;
            if (matchSource.title && candidate.title) {
              const titleJaccard = tokenJaccardSimilarity(srcTitleTokens, candTitleTokens);
              let titleLevenshtein = 0;
              if (titleJaccard > 0.1) {
                titleLevenshtein = wasmStringSimilarity(matchSource.title, candidate.title);
              }
              titleScore = (titleJaccard * 0.7 + titleLevenshtein * 0.3) * 40;
            }

            let totalScore = Math.round(pathScore + titleScore);
            const { penalty, reasons: penaltyReasons } = calculatePenalties(matchSource, candidate, srcAllTokensSet, candAllTokensSet);
            totalScore = Math.max(0, totalScore - penalty);
            
            if (profile === 'THEME_UPGRADE') {
              // In theme upgrade, URL paths should not change! Heavy penalty for fuzzy path matches.
              if (pathScore < 45) {
                totalScore -= 20;
                penaltyReasons.push("Theme Upgrade: Non-exact path penalized");
              }
            } else if (profile === 'CMS_SWITCH') {
              // CMS switches inherently change paths. Boost score slightly if title/h1 are strong.
              if (titleScore > 25) {
                totalScore += 5;
              }
            }

            if (totalScore > highestScore) {
              highestScore = totalScore;
              topCandidate = candidate;
              topCandidateReasons = [
                `Path match: ${Math.round(pathScore)}/50 pts`,
                matchSource.title ? `Title match: ${Math.round(titleScore)}/40 pts` : '',
                ...penaltyReasons
              ].filter(Boolean);
            }
          }

          if (topCandidate && highestScore >= 55) {
            bestTarget = topCandidate;
            confidenceScore = highestScore;
            strategy = highestScore >= 80 ? 'HIGH_FUZZY' : 'MEDIUM_FUZZY';
            reasons.push(...topCandidateReasons);
          }
        }

        // TIER 4: Semantic TF-IDF Fallback
        if (!bestTarget) {
          const srcTokens = extractTokens(matchSource.normalizedPath + ' ' + matchSource.title);
          if (srcTokens.length > 0) {
            const srcTfIdf = computeTFIDF(srcTokens);
            let bestSemanticScore = 0;
            let semanticTarget: CrawlEntry | null = null;

            for (const candidate of targetEntries) {
              const candTfIdf = targetTfIdfCache.get(candidate.id);
              if (candTfIdf) {
                const sim = cosineSimilarity(srcTfIdf, candTfIdf);
                if (sim > bestSemanticScore) {
                  bestSemanticScore = sim;
                  semanticTarget = candidate;
                }
              }
            }

            const semanticConfidence = Math.round(bestSemanticScore * 100);
            if (semanticTarget && semanticConfidence >= 40) {
              bestTarget = semanticTarget;
              confidenceScore = semanticConfidence;
              strategy = 'MEDIUM_FUZZY'; // Repurposed for semantic
              reasons.push(`AI Semantic Match (TF-IDF): ${semanticConfidence}% similarity`);
            }
          }
        }

        let status: MappingStatus = 'UNMAPPED' as any;
        if (bestTarget) {
          status = confidenceScore >= confidenceThreshold ? 'APPROVED' : 'NEEDS_REVIEW';
        } else {
          status = 'NEEDS_REVIEW';
          strategy = 'UNMAPPED';
          reasons.push('No matching target page found above confidence threshold');
        }

        const targetUrl = bestTarget ? bestTarget.url : '/';
        const discrepancies: ParityDiscrepancy[] = bestTarget 
          ? evaluateParityDiscrepancies(source, bestTarget, profile)
          : [];

        // Check Traffic Discrepancies for missing/broken targets
        if (source.visits && maxVisits > 0) {
          const trafficPercentile = (source.visits / maxVisits) * 100;
          if (!bestTarget || bestTarget.statusCode >= 400) {
            let severity: 'CRITICAL' | 'HIGH' | 'WARNING' = 'WARNING';
            if (trafficPercentile >= 80) severity = 'CRITICAL';
            else if (trafficPercentile >= 40) severity = 'HIGH';

            discrepancies.push({
              id: `disc_traffic_${source.id}`,
              type: 'HIGH_EQUITY_UNMAPPED',
              severity,
              title: `High Traffic Page Missing or Broken (${Math.round(trafficPercentile)}% max traffic)`,
              description: `This page generates significant traffic (${source.visits.toLocaleString()} visits). Failing to redirect this properly will result in an immediate traffic drop.`,
              sourceValue: `${source.visits.toLocaleString()} Visits`,
              targetValue: bestTarget ? `HTTP ${bestTarget.statusCode}` : 'Unmapped',
              recommendation: 'Manually assign a 301 target or recreate the content on the target site.'
            });
          }
        }

        const riskScore = calculateRiskScore(source, bestTarget, confidenceScore);

        mappings.push({
          id: `map_${source.id}`,
          source,
          target: bestTarget,
          targetUrl,
          statusCode: 301,
          confidenceScore,
          strategy,
          status,
          riskScore,
          reasons,
          discrepancies,
        });
      }

      // Post progress back to main thread
      const progress = Math.min(100, Math.round(((i + CHUNK_SIZE) / sourceEntries.length) * 100));
      self.postMessage({ type: 'PROGRESS', payload: progress });
    }

      // Done
      self.postMessage({ type: 'COMPLETE', payload: mappings });
    }
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', payload: err.message || err.toString() });
  }
};
