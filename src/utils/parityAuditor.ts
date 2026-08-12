import { CrawlEntry, ParityDiscrepancy, MigrationSummaryStats, UrlMapping, MigrationProfile } from '../types/migration';

/**
 * Deep-dive parity inspection between Source URL and Target URL
 */
export function evaluateParityDiscrepancies(source: CrawlEntry, target: CrawlEntry, profile: MigrationProfile = 'UNKNOWN'): ParityDiscrepancy[] {
  const discrepancies: ParityDiscrepancy[] = [];

  // 1. Check if source is non-canonical
  const isSourceNonCanonical = source.canonical && source.canonical.toLowerCase().trim() !== source.url.toLowerCase().trim();

  // 2. Indexability & Meta Robots Discrepancy
  const isSourceIndexable = source.indexability === 'Indexable' && !source.metaRobots.toLowerCase().includes('noindex');
  const isTargetIndexable = target.indexability === 'Indexable' && !target.metaRobots.toLowerCase().includes('noindex');

  if (isSourceIndexable && !isTargetIndexable) {
    discrepancies.push({
      id: `disc_noindex_${source.id}`,
      type: 'NOINDEX_ON_TARGET',
      severity: 'CRITICAL',
      title: 'Target Page is Non-Indexable / Noindex',
      description: `Source URL was indexable, but target page has '${target.metaRobots || 'Non-Indexable'}'. This will cause Google to de-index the page post-launch.`,
      sourceValue: source.metaRobots || 'Indexable',
      targetValue: target.metaRobots || 'Non-Indexable',
      recommendation: 'Remove noindex directive from target staging/production template.'
    });
  }

  // 2. HTTP Status Code Errors on Target
  if (target.statusCode >= 400) {
    discrepancies.push({
      id: `disc_status_${source.id}`,
      type: 'TARGET_404_OR_500',
      severity: 'CRITICAL',
      title: `Target Returns HTTP ${target.statusCode} Error`,
      description: `Target destination URL responds with HTTP status ${target.statusCode} (${target.status}). Redirecting here will create a broken link.`,
      sourceValue: `HTTP ${source.statusCode}`,
      targetValue: `HTTP ${target.statusCode} ${target.status}`,
      recommendation: 'Verify target route exists or map to an active replacement URL.'
    });
  }

  // 3. Canonical Link Element Drift
  if (target.canonical) {
    const targetNormCanonical = target.canonical.toLowerCase().trim();
    const targetNormUrl = target.url.toLowerCase().trim();
    
    if (targetNormCanonical.startsWith('http://') && targetNormUrl.startsWith('https://')) {
      discrepancies.push({
        id: `disc_canon_proto_${source.id}`,
        type: 'CANONICAL_MISMATCH',
        severity: 'HIGH',
        title: 'Target Canonical uses Insecure HTTP Protocol',
        description: 'Target canonical tag specifies an insecure http:// URL on a secure https:// site.',
        sourceValue: source.canonical || 'None',
        targetValue: target.canonical,
        recommendation: 'Update canonical URL to use https:// protocol.'
      });
    }

    if (profile === 'CROSS_DOMAIN') {
      const sourceDomainMatch = source.url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/im);
      const targetCanonicalDomainMatch = target.canonical.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/im);
      
      if (sourceDomainMatch && targetCanonicalDomainMatch) {
        const sourceDomain = sourceDomainMatch[1].toLowerCase();
        const targetCanonicalDomain = targetCanonicalDomainMatch[1].toLowerCase();
        
        if (sourceDomain === targetCanonicalDomain) {
          discrepancies.push({
            id: `disc_canon_crossdomain_${source.id}`,
            type: 'CANONICAL_MISMATCH',
            severity: 'CRITICAL',
            title: 'Target Canonical points to Old Domain',
            description: 'This is a cross-domain migration, but the Target page canonicalizes back to the Old Domain. This is a severe SEO trap.',
            sourceValue: 'New Domain',
            targetValue: target.canonical,
            recommendation: 'Update canonical to point to the new domain.'
          });
        }
      }
    }
  } else if (source.canonical && !target.canonical) {
    discrepancies.push({
      id: `disc_canon_missing_${source.id}`,
      type: 'CANONICAL_MISMATCH',
      severity: 'WARNING',
      title: 'Target Missing Canonical Link Element',
      description: 'Source page had an explicit canonical tag, but target page has none.',
      sourceValue: source.canonical,
      targetValue: 'Missing',
      recommendation: 'Add self-referential canonical tag to target page.'
    });
  }

  // Skip Content parity audits if source is a non-canonical parameter URL
  if (isSourceNonCanonical) {
    discrepancies.push({
      id: `disc_canon_param_${source.id}`,
      type: 'INFO_ONLY',
      severity: 'INFO',
      title: 'Non-Canonical / Parameter URL',
      description: 'Content parity audits (Word Count, Title, H1) were skipped because this is a non-canonical URL that should not be indexed.',
      sourceValue: source.url,
      targetValue: source.canonical,
      recommendation: 'Ensure parameter URLs are correctly handled or dropped.'
    });
    return discrepancies; // Return early, skipping the rest of the content checks
  }

  // 4. Word Count Collapse / Content Gutting
  if (source.wordCount > 250 && target.wordCount < source.wordCount * 0.6) {
    const dropPct = Math.round(((source.wordCount - target.wordCount) / source.wordCount) * 100);
    
    let severity: ParityDiscrepancy['severity'] = dropPct > 60 ? 'HIGH' : 'WARNING';
    if (profile === 'THEME_UPGRADE') {
      // In a theme upgrade, content should NEVER drop.
      severity = 'CRITICAL';
    }

    discrepancies.push({
      id: `disc_wc_${source.id}`,
      type: 'WORD_COUNT_COLLAPSE',
      severity,
      title: `Word Count Dropped by ${dropPct}%`,
      description: `Source had ${source.wordCount.toLocaleString()} words, while Target only has ${target.wordCount.toLocaleString()} words. Severe content reductions often trigger ranking drops.`,
      sourceValue: `${source.wordCount.toLocaleString()} words`,
      targetValue: `${target.wordCount.toLocaleString()} words`,
      recommendation: 'Verify that main content body, FAQs, or reviews were not accidentally pruned during redesign.'
    });
  }

  // 5. Title Tag Loss or Severe Truncation
  if (source.title && (!target.title || target.title.length < 10)) {
    discrepancies.push({
      id: `disc_title_${source.id}`,
      type: 'TITLE_DISCREPANCY',
      severity: profile === 'THEME_UPGRADE' ? 'CRITICAL' : 'WARNING',
      title: 'Target Missing or Short Title Tag',
      description: 'Target page has an empty or extremely short <title> tag compared to source.',
      sourceValue: source.title,
      targetValue: target.title || 'Empty',
      recommendation: 'Migrate optimized title tag from source to target.'
    });
  }

  // 6. H1 Heading Missing
  if (source.h1 && !target.h1) {
    discrepancies.push({
      id: `disc_h1_${source.id}`,
      type: 'H1_MISSING',
      severity: profile === 'THEME_UPGRADE' ? 'CRITICAL' : 'WARNING',
      title: 'Target Page Missing Primary <h1> Heading',
      description: 'Source page had a primary H1 heading, but target page has no detected H1.',
      sourceValue: source.h1,
      targetValue: 'Missing',
      recommendation: 'Ensure target template renders a semantic <h1> tag.'
    });
  }

  // 7. Meta Description Missing
  if (source.metaDescription && !target.metaDescription) {
    discrepancies.push({
      id: `disc_desc_${source.id}`,
      type: 'META_DESCRIPTION_DROPPED',
      severity: 'INFO',
      title: 'Meta Description Missing on Target',
      description: 'Source had a meta description, but target page has none.',
      sourceValue: source.metaDescription,
      targetValue: 'Empty',
      recommendation: 'Populate meta description on target page.'
    });
  }

  // 8. Soft 404 Homepage Trap (Deep URL mapped to root /)
  if (source.normalizedPath !== '/' && (target.normalizedPath === '/' || target.normalizedPath === '')) {
    if (source.inlinks > 15) {
      discrepancies.push({
        id: `disc_soft404_${source.id}`,
        type: 'SOFT_404_HOMEPAGE_TRAP',
        severity: 'WARNING',
        title: 'Deep High-Equity URL Mapped to Root Homepage',
        description: 'Redirecting deep specific pages to the homepage often gets flagged as a "Soft 404" by Google, forfeiting link equity.',
        sourceValue: source.url,
        targetValue: target.url,
        recommendation: 'Map to the closest relevant category page instead of the homepage.'
      });
    }
  }

  return discrepancies;
}

/**
 * Computes high-level Migration Summary Stats & Readiness Score
 */
export function calculateMigrationStats(
  sourceEntries: CrawlEntry[],
  targetEntries: CrawlEntry[],
  mappings: UrlMapping[],
  profile: MigrationProfile = 'UNKNOWN'
): MigrationSummaryStats {
  let autoMatchedCount = 0;
  let exactPathCount = 0;
  let exactTitleCount = 0;
  let fuzzyMatchCount = 0;
  let needsReviewCount = 0;
  let unmappedCount = 0;
  let highRiskCount = 0;
  let criticalDiscrepanciesCount = 0;
  let totalInlinksPreserved = 0;
  let totalInlinksAtRisk = 0;

  for (const m of mappings) {
    if (m.strategy === 'EXACT_PATH') exactPathCount++;
    else if (m.strategy === 'EXACT_TITLE_H1') exactTitleCount++;
    else if (m.strategy === 'HIGH_FUZZY' || m.strategy === 'MEDIUM_FUZZY') fuzzyMatchCount++;
    else if (m.strategy === 'UNMAPPED') unmappedCount++;

    if (m.status === 'APPROVED' || m.status === 'MANUAL') {
      autoMatchedCount++;
      totalInlinksPreserved += m.source.inlinks;
    } else {
      needsReviewCount++;
      totalInlinksAtRisk += m.source.inlinks;
    }

    if (m.riskScore >= 60) {
      highRiskCount++;
    }

    const criticalIssues = m.discrepancies.filter(d => d.severity === 'CRITICAL');
    criticalDiscrepanciesCount += criticalIssues.length;
  }

  // Calculate Migration Readiness Score (0-100%)
  const total = sourceEntries.length || 1;
  const mappedRatio = autoMatchedCount / total;
  const criticalPenalty = Math.min(40, criticalDiscrepanciesCount * 5);
  const unmappedPenalty = Math.min(30, (unmappedCount / total) * 50);

  let readinessScore = Math.round(mappedRatio * 100 - criticalPenalty - unmappedPenalty);
  readinessScore = Math.max(5, Math.min(100, readinessScore));

  return {
    totalSourceUrls: sourceEntries.length,
    totalTargetUrls: targetEntries.length,
    autoMatchedCount,
    exactPathCount,
    exactTitleCount,
    fuzzyMatchCount,
    needsReviewCount,
    unmappedCount,
    highRiskCount,
    criticalDiscrepanciesCount,
    readinessScore,
    totalInlinksPreserved,
    totalInlinksAtRisk,
  };
}
