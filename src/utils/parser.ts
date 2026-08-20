import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CrawlEntry, IndexabilityStatus } from '../types/migration';

/**
 * Normalizes a URL to a standard pathname for matching
 * e.g. "https://example.com/blog/my-post/?ref=1" -> "/blog/my-post"
 */
export function normalizeUrlPath(rawUrl: string): string {
  if (!rawUrl) return '/';
  try {
    const urlObj = new URL(rawUrl.trim());
    let pathname = urlObj.pathname.toLowerCase().trim();
    
    // Strip trailing index.html, index.php
    pathname = pathname.replace(/\/index\.(html|php|htm|aspx)$/i, '');
    
    // Normalize slashes (strip trailing slash unless root)
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    
    return pathname || '/';
  } catch {
    // If raw string without protocol, handle manually
    let path = rawUrl.trim().toLowerCase();
    // Strip protocol & domain if present
    path = path.replace(/^https?:\/\/[^/]+/i, '');
    // Strip query string and hash
    path = path.split('?')[0].split('#')[0];
    path = path.replace(/\/index\.(html|php|htm|aspx)$/i, '');
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    return path || '/';
  }
}

/**
 * Extracts the base domain from a URL
 */
export function extractDomain(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl.trim());
    return urlObj.hostname;
  } catch {
    return 'domain.com';
  }
}

/**
 * Normalizes messy multi-line cells or multi-tag fields
 */
function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // If multi-line (e.g. Screaming Frog multi-H1), take the primary first line
  return str.split(/[\r\n]+/)[0].trim();
}

function parseNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const num = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
  return isNaN(num) ? fallback : num;
}

/**
 * Finds the first matching key in an object from a list of aliases
 */
function findValue(row: Record<string, any>, aliases: string[]): any {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedAlias);
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
      return row[matchedKey];
    }
  }
  return undefined;
}

/**
 * Converts a raw Screaming Frog row into our standardized CrawlEntry
 */
export function normalizeCrawlRow(row: Record<string, any>, index: number): CrawlEntry | null {
  const urlVal = findValue(row, ['Address', 'URL', 'Url', 'Target URL', 'Source URL', 'URI', 'Location']);
  if (!urlVal) return null;

  const url = String(urlVal).trim();
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    return null; // Ignore invalid headers or blank lines
  }

  const statusCode = parseNumber(findValue(row, ['Status Code', 'Status code', 'HTTP Status Code', 'Status_Code']), 200);
  const status = cleanText(findValue(row, ['Status', 'Status Description']) || (statusCode === 200 ? 'OK' : String(statusCode)));
  const contentType = cleanText(findValue(row, ['Content Type', 'Content-Type', 'Type']) || 'text/html');
  
  const title = cleanText(findValue(row, ['Title 1', 'Title', 'Page Title', 'Meta Title']));
  const metaDescription = cleanText(findValue(row, ['Meta Description 1', 'Meta Description', 'Description']));
  const h1 = cleanText(findValue(row, ['H1-1', 'H1 1', 'H1', 'Heading 1']));
  const h2 = cleanText(findValue(row, ['H2-1', 'H2 1', 'H2']));
  const metaRobots = cleanText(findValue(row, ['Meta Robots 1', 'Meta Robots', 'Robots']) || 'index, follow');
  
  const indexabilityRaw = cleanText(findValue(row, ['Indexability', 'Indexability Status']) || 'Indexable');
  const indexability: IndexabilityStatus = indexabilityRaw.toLowerCase().includes('non') 
    ? 'Non-Indexable' 
    : (indexabilityRaw.toLowerCase().includes('index') ? 'Indexable' : 'Unknown');

  const canonical = cleanText(findValue(row, ['Canonical Link Element 1', 'Canonical URL', 'Canonical', 'Canonical Link']));
  const wordCount = parseNumber(findValue(row, ['Word Count', 'Words', 'Word count']), 0);
  const inlinks = parseNumber(findValue(row, ['Inlinks', 'Internal Inlinks', 'Unique Inlinks', 'Total Inlinks', 'Unique Inlinks (All)']), 0);
  const outlinks = parseNumber(findValue(row, ['Outlinks', 'Internal Outlinks', 'Unique Outlinks']), 0);
  const redirectUrl = cleanText(findValue(row, ['Redirect URL', 'Redirect URI', 'Redirect Target', 'Redirect destination']));
  const redirectType = cleanText(findValue(row, ['Redirect Type', 'Redirect Status Code']));
  const responseTime = parseFloat(String(findValue(row, ['Response Time', 'Response Time (s)', 'Time']) || '0')) || 0;
  const crawlDepth = parseNumber(findValue(row, ['Crawl Depth', 'Depth', 'Level']), 1);

  return {
    id: `crawl_${index}_${Math.random().toString(36).substring(2, 7)}`,
    url,
    normalizedPath: normalizeUrlPath(url),
    statusCode,
    status,
    contentType,
    title,
    titleLength: title.length,
    metaDescription,
    metaDescriptionLength: metaDescription.length,
    h1,
    h2,
    metaRobots,
    indexability,
    canonical,
    wordCount,
    inlinks,
    outlinks,
    redirectUrl: redirectUrl || undefined,
    redirectType: redirectType || undefined,
    responseTime,
    crawlDepth,
  };
}

/**
 * Parses XML Sitemap string or File object
 */
export async function parseXmlSitemap(fileOrContent: File | string): Promise<CrawlEntry[]> {
  let content = '';
  if (fileOrContent instanceof File) {
    content = await fileOrContent.text();
  } else {
    content = fileOrContent;
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, "text/xml");
  const locs = Array.from(xmlDoc.getElementsByTagName("loc"));

  if (locs.length === 0) {
    return [];
  }

  return locs.map((loc, index) => {
    const url = loc.textContent?.trim() || '';
    return {
      id: `sitemap_${index}_${Math.random().toString(36).substring(2, 7)}`,
      url,
      normalizedPath: normalizeUrlPath(url),
      statusCode: 200, // Assume 200 for sitemap URLs
      status: 'OK',
      contentType: 'text/html',
      title: '', // Not available in basic XML sitemaps
      titleLength: 0,
      metaDescription: '',
      metaDescriptionLength: 0,
      h1: '',
      h2: '',
      metaRobots: 'index, follow',
      indexability: 'Indexable',
      canonical: url, // Assume canonical is self
      wordCount: 0,
      inlinks: 0,
      outlinks: 0,
      responseTime: 0,
      crawlDepth: 1,
    };
  });
}

/**
 * Parses CSV string or File object using PapaParse
 */
export async function parseScreamingFrogCsv(fileOrContent: File | string): Promise<CrawlEntry[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(fileOrContent as any, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          return resolve([]);
        }
        const entries: CrawlEntry[] = [];
        results.data.forEach((row: any, idx) => {
          const entry = normalizeCrawlRow(row, idx);
          if (entry) {
            entries.push(entry);
          }
        });
        resolve(entries);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Parses XLSX / XLS files using SheetJS
 */
export async function parseScreamingFrogExcel(file: File): Promise<CrawlEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Find first sheet or 'Internal_HTML' sheet
        const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('html') || s.toLowerCase().includes('internal')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const entries: CrawlEntry[] = [];
        
        rawJson.forEach((row, idx) => {
          const entry = normalizeCrawlRow(row, idx);
          if (entry) {
            entries.push(entry);
          }
        });
        
        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export interface AnalyticsData {
  [normalizedUrl: string]: {
    visits: number;
    revenue: number;
  }
}

export type AnalyticsPlatform = 'GA4' | 'GSC' | 'AHREFS' | 'AUTO';

export async function parseAnalyticsFile(file: File, platform: AnalyticsPlatform = 'AUTO'): Promise<AnalyticsData> {
  let rawJson: any[] = [];
  
  if (file.name.endsWith('.csv')) {
    rawJson = await new Promise((resolve, reject) => {
      Papa.parse(file as any, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.trim(),
        complete: (results) => resolve(results.data),
        error: (error) => reject(error)
      });
    });
  } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    rawJson = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(worksheet, { defval: '' }));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  } else {
    throw new Error('Unsupported analytics file type. Please upload a CSV or XLSX.');
  }

  const analyticsMap: AnalyticsData = {};

  rawJson.forEach(row => {
    // Find URL column
    const urlVal = findValue(row, ['Address', 'URL', 'Url', 'Page', 'Landing Page', 'Landing page', 'Page path', 'Top queries', 'Top pages', 'Top Pages']);
    if (!urlVal) return;

    const normalizedPath = normalizeUrlPath(String(urlVal));
    
    // Find visits based on platform
    let visitAliases = ['Sessions', 'Visits', 'Clicks', 'Traffic', 'Total Traffic', 'Active Users', 'Users'];
    if (platform === 'GA4') visitAliases = ['Sessions', 'Active Users', 'Total users'];
    else if (platform === 'GSC') visitAliases = ['Clicks'];
    else if (platform === 'AHREFS') visitAliases = ['Traffic'];

    const visits = parseNumber(findValue(row, visitAliases), 0);
    
    // Find revenue
    const revenue = parseNumber(findValue(row, ['Revenue', 'Total Revenue', 'Conversions', 'Value']), 0);

    if (visits > 0 || revenue > 0) {
      if (!analyticsMap[normalizedPath]) {
        analyticsMap[normalizedPath] = { visits: 0, revenue: 0 };
      }
      analyticsMap[normalizedPath].visits += visits;
      analyticsMap[normalizedPath].revenue += revenue;
    }
  });

  return analyticsMap;
}

/**
 * Parses a custom Redirect Map CSV provided by the user
 */
export async function parseRedirectMapCsv(file: File): Promise<{sourceUrl: string, targetUrl: string}[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file as any, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          return resolve([]);
        }
        const mappings: {sourceUrl: string, targetUrl: string}[] = [];
        results.data.forEach((row: any) => {
          const source = findValue(row, ['Source', 'Old URL', 'Source URL', 'Old']);
          const target = findValue(row, ['Target', 'New URL', 'Target URL', 'New', 'Destination']);
          if (source && target) {
            mappings.push({ sourceUrl: String(source).trim(), targetUrl: String(target).trim() });
          }
        });
        resolve(mappings);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}
