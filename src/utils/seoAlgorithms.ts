import { CrawlEntry } from '../types/migration';

export interface InternalLinkGraph {
  nodes: Record<string, number>; // URL -> PageRank score (0-10)
  orphanPages: string[];
  powerPages: string[];
}

export interface CannibalizationRisk {
  urls: string[];
  sharedIntent: string; // e.g., the title or h1 they share
  severity: 'HIGH' | 'MEDIUM';
}

/**
 * Calculates a simplified Internal PageRank to determine Link Equity flow.
 * Identifies orphan pages (0 incoming internal links) and power pages (highest internal equity).
 */
export function calculateInternalEquity(entries: CrawlEntry[]): InternalLinkGraph {
  const graph: Record<string, { in: number; out: number }> = {};
  
  // Initialize graph
  entries.forEach(e => {
    graph[e.url] = { in: e.inlinks || 0, out: e.outlinks || 0 };
  });

  // Since we rely on the crawler's outlinks/inlinks count, we'll calculate a normalized 0-10 score.
  let maxInlinks = 1;
  entries.forEach(e => {
    if (e.inlinks > maxInlinks) maxInlinks = e.inlinks;
  });

  const nodes: Record<string, number> = {};
  const orphanPages: string[] = [];
  const powerPages: string[] = [];

  entries.forEach(e => {
    // Basic logarithmic equity score 0-10
    const rawScore = (e.inlinks / maxInlinks) * 10;
    // Boost slightly by organic traffic if we have GSC data, but for now just internal links
    const finalScore = Math.min(10, Math.max(0, rawScore));
    
    nodes[e.url] = Math.round(finalScore * 10) / 10;

    if (e.inlinks === 0 && e.url !== entries[0]?.url /* ignore root if it has 0 somehow */) {
      orphanPages.push(e.url);
    }

    if (finalScore >= 8) {
      powerPages.push(e.url);
    }
  });

  // Sort power pages by score descending
  powerPages.sort((a, b) => (nodes[b] || 0) - (nodes[a] || 0));

  return { nodes, orphanPages, powerPages };
}

/**
 * Detects keyword cannibalization by finding pages with highly similar Titles or H1s.
 */
export function detectContentCannibalization(entries: CrawlEntry[]): CannibalizationRisk[] {
  const risks: CannibalizationRisk[] = [];
  const titleGroups: Record<string, string[]> = {};
  const h1Groups: Record<string, string[]> = {};

  // Group by normalized Title
  entries.forEach(e => {
    if (e.title && e.title.length > 5 && e.indexability === 'Indexable') {
      // Normalize: lowercase, remove brand names, trim
      const normTitle = e.title.toLowerCase().replace(/[-|].*$/, '').trim();
      if (!titleGroups[normTitle]) titleGroups[normTitle] = [];
      titleGroups[normTitle].push(e.url);
    }

    if (e.h1 && e.h1.length > 5 && e.indexability === 'Indexable') {
      const normH1 = e.h1.toLowerCase().trim();
      if (!h1Groups[normH1]) h1Groups[normH1] = [];
      h1Groups[normH1].push(e.url);
    }
  });

  Object.entries(titleGroups).forEach(([intent, urls]) => {
    if (urls.length > 1) {
      risks.push({
        urls,
        sharedIntent: `Title: "${intent}"`,
        severity: urls.length > 3 ? 'HIGH' : 'MEDIUM'
      });
    }
  });

  Object.entries(h1Groups).forEach(([intent, urls]) => {
    if (urls.length > 1) {
      // Check if this group is already caught by Title risk
      const alreadyCaught = risks.some(r => r.urls.some(u => urls.includes(u)) && r.sharedIntent.includes('Title'));
      if (!alreadyCaught) {
        risks.push({
          urls,
          sharedIntent: `H1: "${intent}"`,
          severity: urls.length > 3 ? 'HIGH' : 'MEDIUM'
        });
      }
    }
  });

  return risks.sort((a, b) => b.urls.length - a.urls.length);
}
