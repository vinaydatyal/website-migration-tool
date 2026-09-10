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
    const isNoIndex = target.metaRobots.toLowerCase().includes('noindex');
    const isTargetCanonicalized = target.canonical && target.canonical.toLowerCase().trim() !== target.url.toLowerCase().trim();
    
    let severity: ParityDiscrepancy['severity'] = 'CRITICAL';
    let title = 'Target Page is Non-Indexable / Noindex';
    let displayValue: string = target.indexability;

    if (isNoIndex) {
      displayValue = 'Noindex tag';
    } else if (isTargetCanonicalized) {
      severity = 'INFO';
      title = 'Target Page is Canonicalized (Non-Indexable)';
      displayValue = 'Canonicalized';
    }
    
    discrepancies.push({
      id: `disc_noindex_${source.id}`,
      type: 'NOINDEX_ON_TARGET',
      severity,
      title,
      description: `Source URL was indexable, but target page is marked as '${displayValue}'. ${isTargetCanonicalized ? 'This is often expected for pagination or duplicate content consolidating equity.' : 'This will cause Google to de-index the page post-launch.'}`,
      sourceValue: source.metaRobots || 'Indexable',
      targetValue: isNoIndex ? target.metaRobots : displayValue,
      recommendation: isTargetCanonicalized ? 'Verify this canonicalization is intentional.' : 'Ensure target template is indexable (check robots tags and canonical tags).'
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


  // 7. Meta Description Mismatch / Drop
  if (source.metaDescription && !target.metaDescription) {
    discrepancies.push({
      id: `disc_metadesc_missing_${source.id}`,
      type: 'META_DESCRIPTION_DROPPED',
      severity: 'WARNING',
      title: 'Target Meta Description is Missing',
      description: 'Source page had a meta description but target page does not.',
      sourceValue: source.metaDescription,
      targetValue: 'Missing',
      recommendation: 'Ensure meta description is carried over to maintain CTR.'
    });
  }

  // 8. H1 Drift
  if (source.h1 && target.h1 && source.h1.toLowerCase() !== target.h1.toLowerCase()) {
    discrepancies.push({
      id: `disc_h1_drift_${source.id}`,
      type: 'TITLE_DISCREPANCY',
      severity: 'WARNING',
      title: 'H1 Tag Changed',
      description: 'The primary H1 tag has changed on the target page. This can impact topical relevance.',
      sourceValue: source.h1,
      targetValue: target.h1,
      recommendation: 'Review H1 change to ensure core target keywords are still present.'
    });
  } else if (source.h1 && !target.h1) {
    discrepancies.push({
      id: `disc_h1_missing_${source.id}`,
      type: 'H1_MISSING',
      severity: 'HIGH',
      title: 'Target H1 is Missing',
      description: 'Source page had an H1 tag but target page does not.',
      sourceValue: source.h1,
      targetValue: 'Missing',
      recommendation: 'Add a relevant H1 tag to the target page.'
    });
  }

  // 9. Word Count Collapse
  if (source.wordCount > 300 && target.wordCount > 0) {
    const diff = (source.wordCount - target.wordCount) / source.wordCount;
    if (diff > 0.20) {
      discrepancies.push({
        id: `disc_wordcount_${source.id}`,
        type: 'WORD_COUNT_COLLAPSE',
        severity: 'HIGH',
        title: 'Significant Content Thinning',
        description: 'The target page has significantly fewer words than the source page (>' + Math.round(diff * 100) + '% drop). This risks a traffic drop due to thin content.',
        sourceValue: source.wordCount + ' words',
        targetValue: target.wordCount + ' words',
        recommendation: 'Review page content. Ensure no critical body copy was lost during the migration.'
      });
    }
  }

  // 10. Internal Link Traps (Hardcoded Old Domain Links)
  if (target.outgoingLinks && target.outgoingLinks.length > 0 && profile !== 'CROSS_DOMAIN') {
    try {
      const sourceUrlObj = new URL(source.url);
      const oldDomain = sourceUrlObj.hostname;
      const oldLinks = target.outgoingLinks.filter(link => {
        try { return new URL(link).hostname === oldDomain; } catch(e) { return false; }
      });
      
      if (oldLinks.length > 0) {
        discrepancies.push({
          id: `disc_internal_links_${source.id}`,
          type: 'REDIRECT_CHAIN_RISK',
          severity: 'HIGH',
          title: 'Hardcoded Internal Links to Old Domain',
          description: `The target page contains ${oldLinks.length} links pointing to the OLD domain (${oldDomain}). This will cause unnecessary redirects or broken links post-launch.`,
          sourceValue: 'N/A',
          targetValue: `${oldLinks.length} hardcoded links`,
          recommendation: 'Update internal links on the staging site to use relative paths or point to the new domain.'
        });
      }
    } catch(e) {
      // Ignore URL parse errors
    }
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
  profile: MigrationProfile = 'CMS_SWITCH',
  resolvedDiscrepancies: Record<string, boolean> = {}
): MigrationSummaryStats {
  
  // -- PASS 1: Detect "Hub Traps" (Soft 404s) --
  // Count how many source URLs are mapped to each target URL
  const targetFrequency = new Map<string, string[]>();
  for (const m of mappings) {
    if (m.targetUrl && m.status !== 'REJECTED') {
      const arr = targetFrequency.get(m.targetUrl) || [];
      arr.push(m.id);
      targetFrequency.set(m.targetUrl, arr);
    }
  }

  // Flag mappings that point to a Hub Trap (>3 sources to 1 target, excluding homepage)
  for (const [targetUrl, mappingIds] of targetFrequency.entries()) {
    if (mappingIds.length > 3) {
      const targetEntry = targetEntries.find(t => t.url === targetUrl);
      if (targetEntry && targetEntry.normalizedPath !== '/' && targetEntry.normalizedPath !== '') {
        // Apply the discrepancy to all these mappings
        for (const mId of mappingIds) {
          const mapping = mappings.find(m => m.id === mId);
          if (mapping) {
            // Check if it already has this discrepancy to avoid duplicates
            const hasHubTrap = mapping.discrepancies.some(d => d.type === 'HUB_TRAP_SOFT_404');
            if (!hasHubTrap) {
              mapping.discrepancies.push({
                id: `disc_hubtrap_${mapping.id}_${targetUrl}`,
                type: 'HUB_TRAP_SOFT_404',
                severity: 'CRITICAL',
                title: 'SEO Hub Trap (Soft 404 Risk)',
                description: `${mappingIds.length} different source URLs are being redirected to this single target page. Google may treat this as a Soft 404 and drop the SEO equity.`,
                sourceValue: 'Multiple Source URLs',
                targetValue: targetEntry.url,
                recommendation: 'Try to map to more specific, 1-to-1 equivalent pages rather than a catch-all category hub.'
              });
              // Recalculate risk score since we added a critical issue
              mapping.riskScore = Math.min(100, mapping.riskScore + 30);
            }
          }
        }
      }
    }
  }

  // -- PASS 2: Calculate Stats --
  let autoMatchedCount = 0;
  let exactPathCount = 0;
  let exactTitleCount = 0;
  let fuzzyMatchCount = 0;
  let needsReviewCount = 0;
  let unmappedCount = 0;
  let highRiskCount = 0;
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
  }

  const criticalDiscrepanciesCount = mappings.reduce((acc, m) => {
    const criticals = m.discrepancies.filter(d => d.severity === 'CRITICAL' && !resolvedDiscrepancies[d.id]).length;
    return acc + criticals;
  }, 0);

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
