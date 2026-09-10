export type IndexabilityStatus = 'Indexable' | 'Non-Indexable' | 'Unknown';
export type MigrationProfile = 'THEME_UPGRADE' | 'CMS_SWITCH' | 'WORDPRESS_MIGRATION' | 'CROSS_DOMAIN' | 'UNKNOWN';

export interface CrawlEntry {
  id: string;
  url: string;
  normalizedPath: string; // e.g. /shop/running-shoes/
  statusCode: number;
  status: string;
  contentType: string;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  h1: string;
  h2?: string;
  metaRobots: string;
  indexability: IndexabilityStatus;
  canonical: string;
  wordCount: number;
  inlinks: number;
  outlinks: number;
  outgoingLinks?: string[];
  redirectUrl?: string;
  redirectType?: string;
  responseTime?: number;
  schemaTypes?: string[];
  crawlDepth?: number;
  visits?: number;
  revenue?: number;
  
  // Analytics Metrics
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  sessions?: number;
  pageviews?: number;
}

export type MatchStrategy = 
  | 'EXACT_PATH' 
  | 'EXACT_TITLE_H1' 
  | 'HIGH_FUZZY' 
  | 'MEDIUM_FUZZY' 
  | 'PATTERN_RULE' 
  | 'MANUAL_OVERRIDE' 
  | 'GONE_410' 
  | 'UNMAPPED';

export type MappingStatus = 
  | 'APPROVED' 
  | 'NEEDS_REVIEW' 
  | 'REJECTED' 
  | 'MANUAL' 
  | 'GONE_410';

export interface UrlMapping {
  id: string;
  source: CrawlEntry;
  target?: CrawlEntry | null;
  targetUrl: string;
  statusCode: number; // usually 301 or 410
  confidenceScore: number; // 0 to 100
  strategy: MatchStrategy;
  status: MappingStatus;
  riskScore: number; // 0 to 100 based on inlink equity, target 404, etc.
  reasons: string[];
  discrepancies: ParityDiscrepancy[];
  patternId?: string;
  notes?: string;
  isHidden?: boolean;
}

export type DiscrepancySeverity = 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';

export type DiscrepancyType = 
  | 'NOINDEX_ON_TARGET'
  | 'TARGET_404_OR_500'
  | 'CANONICAL_MISMATCH'
  | 'WORD_COUNT_COLLAPSE'
  | 'TITLE_DISCREPANCY'
  | 'H1_MISSING'
  | 'HIGH_EQUITY_UNMAPPED'
  | 'HIGH_EQUITY_UNMAPPED'
  | 'META_DESCRIPTION_DROPPED'
  | 'REDIRECT_CHAIN_RISK'
  | 'SOFT_404_HOMEPAGE_TRAP'
  | 'HUB_TRAP_SOFT_404'
  | 'INFO_ONLY';

export interface ParityDiscrepancy {
  id: string;
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  title: string;
  description: string;
  sourceValue: string | number;
  targetValue: string | number;
  recommendation?: string;
}

export interface SynthesizedPattern {
  id: string;
  name: string;
  sourcePattern: string; // Regex or prefix
  targetPattern: string; // Replacement syntax
  affectedCount: number;
  sampleSource: string;
  sampleTarget: string;
  isActive: boolean;
  type: 'DIRECTORY_SHIFT' | 'DATE_STRIP' | 'EXTENSION_STRIP' | 'PARAM_CLEANUP' | 'CUSTOM';
}

export interface MigrationSummaryStats {
  totalSourceUrls: number;
  totalTargetUrls: number;
  autoMatchedCount: number;
  exactPathCount: number;
  exactTitleCount: number;
  fuzzyMatchCount: number;
  needsReviewCount: number;
  unmappedCount: number;
  highRiskCount: number;
  criticalDiscrepanciesCount: number;
  readinessScore: number; // 0-100%
  totalInlinksPreserved: number;
  totalInlinksAtRisk: number;
}

export interface ProjectMetadata {
  projectName?: string;
  clientName?: string;
  targetDate?: string;
  platform?: string;
  hasGSC?: boolean;
  hasGA4?: boolean;
  hasSEMrush?: boolean;
  gscPropertyUrl?: string;
  ga4MeasurementId?: string;
  semrushProjectId?: string;
  baselineIndexedPages?: number;
  baselineOrganicClicks?: number;
}

export interface MigrationProject {
  id: string;
  name: string;
  profile: MigrationProfile;
  sourceFileName: string;
  targetFileName: string;
  sourceDomain: string;
  targetDomain: string;
  sourceEntries: CrawlEntry[];
  targetEntries: CrawlEntry[];
  mappings: UrlMapping[];
  patterns: SynthesizedPattern[];
  stats: MigrationSummaryStats;
  checklistProgress?: Record<string, boolean>;
  metadata?: ProjectMetadata;
  resolvedDiscrepancies?: Record<string, boolean>;
  confidenceThreshold: number; // default 75
  createdAt: string;
  updatedAt: string;
}

export type ExportFormat = 
  | 'HTACCESS' 
  | 'NGINX' 
  | 'CLOUDFLARE_CSV' 
  | 'VERCEL_REDIRECTS' 
  | 'NEXTJS_CONFIG' 
  | 'WORDPRESS_REDIRECTION_CSV' 
  | 'FULL_MAPPING_CSV' 
  | 'SEO_AUDIT_REPORT_CSV'
  | 'FULL_AUDIT_EXCEL'
  | 'SITEMAP_XML'
  | 'EXECUTIVE_PDF';

export interface MigrationSnapshot {
  id: string;
  projectId: string;
  description: string;
  timestamp: string;
  stats: MigrationSummaryStats | null;
  mappings: UrlMapping[];
}
