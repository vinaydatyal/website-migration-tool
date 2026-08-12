import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  AlertCircle,
  FileText,
  HelpCircle
} from 'lucide-react';
import { parseScreamingFrogCsv, parseScreamingFrogExcel, parseAnalyticsFile, AnalyticsPlatform } from '../utils/parser';
import { CrawlEntry, MigrationProfile } from '../types/migration';

interface UploadZoneProps {
  onDataParsed: (
    sourceEntries: CrawlEntry[],
    targetEntries: CrawlEntry[],
    sourceName: string,
    targetName: string,
    profile: MigrationProfile
  ) => void;
  onLoadSample: () => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onDataParsed, onLoadSample }) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [sourceEntries, setSourceEntries] = useState<CrawlEntry[] | null>(null);
  const [targetEntries, setTargetEntries] = useState<CrawlEntry[] | null>(null);
  const [analyticsFile, setAnalyticsFile] = useState<File | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [analyticsPlatform, setAnalyticsPlatform] = useState<AnalyticsPlatform>('AUTO');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MigrationProfile>('UNKNOWN');

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const analyticsInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File, type: 'source' | 'target' | 'analytics') => {
    setError(null);
    try {
      if (type === 'analytics') {
        const parsedAnalytics = await parseAnalyticsFile(file, analyticsPlatform);
        setAnalyticsFile(file);
        setAnalyticsData(parsedAnalytics);
        return;
      }

      let parsed: CrawlEntry[] = [];
      if (file.name.endsWith('.csv')) {
        parsed = await parseScreamingFrogCsv(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsed = await parseScreamingFrogExcel(file);
      } else {
        throw new Error('Please upload a valid CSV or XLSX file exported from Screaming Frog.');
      }

      if (parsed.length === 0) {
        throw new Error('No valid crawl URLs found in file. Ensure Screaming Frog "Internal_HTML" or standard CSV export was used.');
      }

      if (type === 'source') {
        setSourceFile(file);
        setSourceEntries(parsed);
      } else {
        setTargetFile(file);
        setTargetEntries(parsed);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse file.');
    }
  };

  const handleStartAnalysis = () => {
    if (sourceEntries && targetEntries && sourceFile && targetFile) {
      setIsProcessing(true);
      
      // Merge analytics data if available
      let finalSourceEntries = [...sourceEntries];
      if (analyticsData) {
        finalSourceEntries = finalSourceEntries.map(entry => {
          const matchedAnalytics = analyticsData[entry.normalizedPath];
          if (matchedAnalytics) {
            return {
              ...entry,
              visits: matchedAnalytics.visits,
              revenue: matchedAnalytics.revenue
            };
          }
          return entry;
        });
      }

      // Add brief timeout so UI can render loading state
      setTimeout(() => {
        onDataParsed(
          finalSourceEntries, 
          targetEntries, 
          sourceFile?.name || 'source.csv', 
          targetFile?.name || 'target.csv',
          profile
        );
      }, 100);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
      {/* Hero Header */}
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Screaming Frog 301 Engine & SEO Parity Suite</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Automate Website Migrations <br />
          <span className="bg-gradient-to-r from-brand-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
            With Zero Traffic Loss
          </span>
        </h1>
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400">
          Upload your Screaming Frog crawl exports for the <strong>Source (Old Site)</strong> and <strong>Target (New/Staging Site)</strong>. Our multi-tier matching engine synthesizes 301 redirects and flags critical SEO discrepancies in seconds.
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3 text-red-300 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Upload Error:</span> {error}
          </div>
        </div>
      )}

      {/* Triple Upload Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Source File Box */}
        <div className="relative group">
          <div className={`p-6 rounded-2xl border-2 border-dashed transition-all ${
            sourceFile 
              ? 'border-brand-500/60 bg-brand-500/5' 
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
          }`}>
            <input
              type="file"
              ref={sourceInputRef}
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], 'source')}
            />

            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${sourceFile ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-400'}`}>
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">1. Source Site Crawl</h3>
                  <p className="text-xs text-slate-400">Old / Existing Website Export</p>
                </div>
              </div>
              {sourceFile && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Ready</span>
                </span>
              )}
            </div>

            {sourceFile ? (
              <div className="space-y-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="h-4 w-4 text-brand-400 shrink-0" />
                    <span className="text-xs font-mono text-slate-200 truncate">{sourceFile.name}</span>
                  </div>
                  <span className="text-xs font-bold text-brand-400 px-2 py-0.5 rounded bg-brand-500/10">
                    {sourceEntries?.length.toLocaleString()} URLs
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => sourceInputRef.current?.click()}
                  className="text-xs text-slate-400 hover:text-slate-200 underline decoration-slate-600"
                >
                  Change source file
                </button>
              </div>
            ) : (
              <div 
                onClick={() => sourceInputRef.current?.click()}
                className="py-8 text-center cursor-pointer space-y-2"
              >
                <Upload className="h-8 w-8 text-slate-500 mx-auto group-hover:text-brand-400 transition-colors" />
                <p className="text-sm font-semibold text-slate-300">
                  Drop <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">internal_html.csv</code> here
                </p>
                <p className="text-xs text-slate-500">Supports CSV, XLSX up to 250k URLs</p>
              </div>
            )}
          </div>
        </div>

        {/* Target File Box */}
        <div className="relative group">
          <div className={`p-6 rounded-2xl border-2 border-dashed transition-all ${
            targetFile 
              ? 'border-emerald-500/60 bg-emerald-500/5' 
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
          }`}>
            <input
              type="file"
              ref={targetInputRef}
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], 'target')}
            />

            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${targetFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">2. Target Site Crawl</h3>
                  <p className="text-xs text-slate-400">New / Staging Website Export</p>
                </div>
              </div>
              {targetFile && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Ready</span>
                </span>
              )}
            </div>

            {targetFile ? (
              <div className="space-y-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-mono text-slate-200 truncate">{targetFile.name}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">
                    {targetEntries?.length.toLocaleString()} URLs
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => targetInputRef.current?.click()}
                  className="text-xs text-slate-400 hover:text-slate-200 underline decoration-slate-600"
                >
                  Change target file
                </button>
              </div>
            ) : (
              <div 
                onClick={() => targetInputRef.current?.click()}
                className="py-8 text-center cursor-pointer space-y-2"
              >
                <Upload className="h-8 w-8 text-slate-500 mx-auto group-hover:text-emerald-400 transition-colors" />
                <p className="text-sm font-semibold text-slate-300">
                  Drop <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">staging_crawl.csv</code> here
                </p>
                <p className="text-xs text-slate-500">Supports CSV, XLSX up to 250k URLs</p>
              </div>
            )}
          </div>
        </div>

        {/* Analytics File Box */}
        <div className="relative group">
          <div className={`h-full p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col justify-between ${
            analyticsFile 
              ? 'border-purple-500/60 bg-purple-500/5' 
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
          }`}>
            <input
              type="file"
              ref={analyticsInputRef}
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], 'analytics')}
            />

            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${analyticsFile ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'}`}>
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">3. Analytics (Opt)</h3>
                  <p className="text-xs text-slate-400">GA4 or Ahrefs Export</p>
                </div>
              </div>
              {analyticsFile && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Ready</span>
                </span>
              )}
            </div>

            {analyticsFile ? (
              <div className="space-y-3 pt-2 mt-auto">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="h-4 w-4 text-purple-400 shrink-0" />
                    <span className="text-xs font-mono text-slate-200 truncate">{analyticsFile.name}</span>
                  </div>
                  <span className="text-xs font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-500/10">
                    {Object.keys(analyticsData || {}).length.toLocaleString()} URLs
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => analyticsInputRef.current?.click()}
                  className="text-xs text-slate-400 hover:text-slate-200 underline decoration-slate-600 block mx-auto"
                >
                  Change analytics file
                </button>
              </div>
            ) : (
              <div 
                onClick={() => analyticsInputRef.current?.click()}
                className="py-8 text-center cursor-pointer space-y-2 mt-auto"
              >
                <Upload className="h-8 w-8 text-slate-500 mx-auto group-hover:text-purple-400 transition-colors" />
                <p className="text-sm font-semibold text-slate-300">
                  Drop <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">analytics.csv</code>
                </p>
                <div className="flex flex-col items-center mt-2 space-y-2">
                  <select 
                    value={analyticsPlatform}
                    onChange={(e) => setAnalyticsPlatform(e.target.value as AnalyticsPlatform)}
                    onClick={(e) => e.stopPropagation()}
                    className="appearance-none bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                  >
                    <option value="AUTO">Auto-detect Platform</option>
                    <option value="GA4">Google Analytics 4</option>
                    <option value="GSC">Google Search Console</option>
                    <option value="AHREFS">Ahrefs</option>
                  </select>
                  <p className="text-[10px] text-slate-500">To prioritize traffic loss</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Migration Context Selector */}
      <div className="mb-8 p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <label className="block text-sm font-semibold text-slate-200 mb-3">
          Migration Scenario Context
        </label>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setProfile('UNKNOWN')}
            className={`px-4 py-3 text-left rounded-xl border text-sm transition-all ${
              profile === 'UNKNOWN' 
                ? 'bg-brand-500/10 border-brand-500 text-brand-300' 
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div className="font-bold mb-1">Standard / Not Sure</div>
            <div className="text-xs opacity-70">Balanced heuristics.</div>
          </button>
          
          <button
            type="button"
            onClick={() => setProfile('THEME_UPGRADE')}
            className={`px-4 py-3 text-left rounded-xl border text-sm transition-all ${
              profile === 'THEME_UPGRADE' 
                ? 'bg-brand-500/10 border-brand-500 text-brand-300' 
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div className="font-bold mb-1">Theme Upgrade</div>
            <div className="text-xs opacity-70">Same domain & CMS. Hyper-strict on paths.</div>
          </button>

          <button
            type="button"
            onClick={() => setProfile('CMS_SWITCH')}
            className={`px-4 py-3 text-left rounded-xl border text-sm transition-all ${
              profile === 'CMS_SWITCH' 
                ? 'bg-brand-500/10 border-brand-500 text-brand-300' 
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div className="font-bold mb-1">CMS Platform Switch</div>
            <div className="text-xs opacity-70">Same domain. Forgiving on paths.</div>
          </button>

          <button
            type="button"
            onClick={() => setProfile('WORDPRESS_MIGRATION')}
            className={`px-4 py-3 text-left rounded-xl border text-sm transition-all ${
              profile === 'WORDPRESS_MIGRATION' 
                ? 'bg-brand-500/10 border-brand-500 text-brand-300' 
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div className="font-bold mb-1">WordPress Migration</div>
            <div className="text-xs opacity-70">Tailored playbook for WP.</div>
          </button>

          <button
            type="button"
            onClick={() => setProfile('CROSS_DOMAIN')}
            className={`px-4 py-3 text-left rounded-xl border text-sm transition-all ${
              profile === 'CROSS_DOMAIN' 
                ? 'bg-brand-500/10 border-brand-500 text-brand-300' 
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div className="font-bold mb-1">Cross-Domain Rebrand</div>
            <div className="text-xs opacity-70">Absolute redirects. Strict canonical checks.</div>
          </button>
        </div>
      </div>

      {/* Main Start Action / Quick Sample Button */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={handleStartAnalysis}
          disabled={!sourceEntries || !targetEntries || isProcessing}
          className={`w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-lg ${
            sourceEntries && targetEntries
              ? 'bg-gradient-to-r from-brand-500 to-emerald-500 text-slate-950 hover:from-brand-400 hover:to-emerald-400 shadow-brand-500/25 cursor-pointer transform hover:-translate-y-0.5'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          <span>Run Migration & Parity Analysis</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        <span className="text-xs text-slate-500 font-medium">or</span>

        <button
          onClick={onLoadSample}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-center space-x-2 transition-all cursor-pointer"
        >
          <Sparkles className="h-4 w-4 text-brand-400" />
          <span>Load E-Commerce Demo Dataset</span>
        </button>
      </div>

      {/* Feature Pills */}
      <div className="mt-14 pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Anti-False Positive Engine</h4>
            <p className="text-xs text-slate-400 mt-0.5">Penalizes geo-location, pagination, and product SKU drift.</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pre/Post SEO Parity</h4>
            <p className="text-xs text-slate-400 mt-0.5">Flags staging noindex leaks, canonical drift, and word count collapse.</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 shrink-0">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Multi-Format Exporters</h4>
            <p className="text-xs text-slate-400 mt-0.5">Generates Apache .htaccess, Nginx, Cloudflare CSV, and Vercel configs.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
