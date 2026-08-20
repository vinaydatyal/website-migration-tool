import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  AlertCircle,
  FileText,
  HelpCircle,
  Settings,
  ShieldAlert,
  Cookie,
  UserCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseScreamingFrogCsv, parseScreamingFrogExcel, parseAnalyticsFile, parseXmlSitemap, AnalyticsPlatform } from '../utils/parser';
import { CrawlEntry, MigrationProfile } from '../types/migration';

interface UploadZoneProps {
  onDataParsed: (
    sourceEntries: CrawlEntry[],
    targetEntries: CrawlEntry[],
    sourceName: string,
    targetName: string,
    profile: MigrationProfile,
    projectName?: string
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
  
  // Analytics OAuth States
  const [gscConnected, setGscConnected] = useState(false);
  const [ga4Connected, setGa4Connected] = useState(false);
  const [gscSites, setGscSites] = useState<string[]>([]);
  const [ga4Properties, setGa4Properties] = useState<any[]>([]);
  const [selectedGscSite, setSelectedGscSite] = useState('');
  const [selectedGa4Property, setSelectedGa4Property] = useState('');
  
  const [inputMode, setInputMode] = useState<'csv' | 'crawl'>('csv');
  const [sourceUrl, setSourceUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [crawlProgress, setCrawlProgress] = useState<{source?: any, target?: any}>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [uploadProjectName, setUploadProjectName] = useState('Untitled Project');
  const [crawlConfig, setCrawlConfig] = useState({
    authType: 'NONE' as 'NONE' | 'BASIC_AUTH' | 'COOKIE' | 'FORM_AUTH',
    loginUrl: '',
    username: '',
    password: '',
    customCookie: '',
    ignoreRobots: true,
    maxDepth: 3,
    maxPages: 500,
    exclusions: '',
    rateLimit: 0,
  });
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
      } else if (file.name.endsWith('.xml')) {
        parsed = await parseXmlSitemap(file);
      } else {
        throw new Error('Please upload a valid CSV, XLSX, or XML Sitemap file.');
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

  const handleOAuth = async (service: 'gsc' | 'ga4') => {
    try {
      const res = await fetch(`/api/gsc/auth?service=${service}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'GoogleAuth', 'width=500,height=600');
      } else {
        toast.error(data.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const fetchGscSites = async () => {
    try {
      const res = await fetch('/api/gsc/sites');
      const data = await res.json();
      if (data.sites) {
        setGscSites(data.sites);
        if (data.sites.length > 0) setSelectedGscSite(data.sites[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchGa4Properties = async () => {
    try {
      const res = await fetch('/api/ga4/properties');
      const data = await res.json();
      if (data.properties) {
        setGa4Properties(data.properties);
        if (data.properties.length > 0) setSelectedGa4Property(data.properties[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GSC_AUTH_SUCCESS') {
        const service = event.data.service;
        if (service === 'gsc') {
          setGscConnected(true);
          fetchGscSites();
        } else if (service === 'ga4') {
          setGa4Connected(true);
          fetchGa4Properties();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleStartAnalysis = async () => {
    if (sourceEntries && targetEntries && (inputMode === 'crawl' || (sourceFile && targetFile))) {
      setIsProcessing(true);
      
      let finalSourceEntries = [...sourceEntries];

      try {
        if (!analyticsFile && (gscConnected || ga4Connected)) {
          let gscData: any[] = [];
          let ga4Data: any[] = [];

          if (gscConnected && selectedGscSite) {
            const res = await fetch('/api/gsc/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ siteUrl: selectedGscSite })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch GSC data');
            gscData = json.data || [];
          }

          if (ga4Connected && selectedGa4Property) {
            const res = await fetch('/api/ga4/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ propertyId: selectedGa4Property })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch GA4 data');
            ga4Data = json.data || [];
          }

          const gscMap = new Map(gscData.map(d => [d.url.replace(/\/$/, ''), d]));
          const ga4Map = new Map(ga4Data.map(d => {
            let u = d.url;
            if (!u.startsWith('http')) {
               u = (selectedGscSite.replace(/\/$/, '') + u).replace(/\/$/, '');
            }
            return [u, d];
          }));

          finalSourceEntries = finalSourceEntries.map(entry => {
            const cleanUrl = entry.url.replace(/\/$/, '');
            const gscRow = gscMap.get(cleanUrl) || {};
            const ga4Row = ga4Map.get(cleanUrl) || {};

            return {
              ...entry,
              clicks: gscRow.clicks || entry.clicks || 0,
              impressions: gscRow.impressions || entry.impressions || 0,
              ctr: gscRow.ctr || entry.ctr || 0,
              position: gscRow.position || entry.position || 0,
              sessions: ga4Row.sessions || entry.sessions || 0,
              pageviews: ga4Row.pageviews || entry.pageviews || 0,
            };
          });
        } else if (analyticsData) {
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
      } catch (err: any) {
        toast.error(err.message || 'Failed to merge analytics data');
      }

      // Add brief timeout so UI can render loading state
      setTimeout(() => {
        if (sourceEntries && targetEntries) {
          localStorage.removeItem('uploadZone_draft');
        }
        
        onDataParsed(
          finalSourceEntries, 
          targetEntries, 
          inputMode === 'csv' ? (sourceFile?.name || 'source.csv') : sourceUrl, 
          inputMode === 'csv' ? (targetFile?.name || 'target.csv') : targetUrl,
          profile,
          uploadProjectName
        );
      }, 100);
    }
  };

  // --- DRAFT STATE & BACKGROUND RECOVERY ---
  useEffect(() => {
    // Restore draft on mount
    const saved = localStorage.getItem('uploadZone_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSourceUrl(parsed.sourceUrl || '');
        setTargetUrl(parsed.targetUrl || '');
        setCrawlConfig(parsed.crawlConfig || crawlConfig);
        setInputMode(parsed.inputMode || 'csv');
        setUploadProjectName(parsed.uploadProjectName || 'Untitled Project');
        if (parsed.sourceEntries) setSourceEntries(parsed.sourceEntries);
        if (parsed.targetEntries) setTargetEntries(parsed.targetEntries);
        
        // Reconnect to active jobs
        if (parsed.crawlProgress) {
          setCrawlProgress(parsed.crawlProgress);
          if (parsed.crawlProgress.source?.jobId && parsed.crawlProgress.source?.status !== 'done' && parsed.crawlProgress.source?.status !== 'error') {
            connectToCrawlJob(parsed.crawlProgress.source.jobId, 'source', parsed.sourceUrl);
          }
          if (parsed.crawlProgress.target?.jobId && parsed.crawlProgress.target?.status !== 'done' && parsed.crawlProgress.target?.status !== 'error') {
            connectToCrawlJob(parsed.crawlProgress.target.jobId, 'target', parsed.targetUrl);
          }
        }
      } catch (e) {
        console.error('Failed to parse draft state', e);
      }
    }
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    // Auto-save draft on changes (only after initial restore)
    if (!draftRestored) return;
    
    const draft = {
      sourceUrl,
      targetUrl,
      crawlConfig,
      inputMode,
      sourceEntries,
      targetEntries,
      crawlProgress,
      uploadProjectName,
    };
    localStorage.setItem('uploadZone_draft', JSON.stringify(draft));
  }, [sourceUrl, targetUrl, crawlConfig, inputMode, sourceEntries, targetEntries, crawlProgress, draftRestored, uploadProjectName]);

  const connectToCrawlJob = (jobId: string, type: 'source' | 'target', url: string) => {
    setIsProcessing(true);
    const eventSource = new EventSource(`/api/crawl/events?jobId=${jobId}`);
    
    // Ensure jobId is kept in state so it gets saved to draft
    setCrawlProgress(prev => ({
      ...prev,
      [type]: { ...prev[type], jobId, status: prev[type]?.status || 'starting' }
    }));
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'start') {
        setCrawlProgress(prev => ({...prev, [type]: { jobId, status: 'starting', current: 0, total: 0 }}));
      } else if (data.type === 'progress') {
        setCrawlProgress(prev => ({...prev, [type]: { jobId, status: 'crawling', current: data.current, total: data.total, message: data.message }}));
      } else if (data.type === 'done') {
        eventSource.close();
        setCrawlProgress(prev => ({...prev, [type]: { jobId, status: 'done', current: data.results.length, total: data.results.length }}));
        if (type === 'source') setSourceEntries(data.results);
        else setTargetEntries(data.results);
        setIsProcessing(false);
      } else if (data.type === 'paused') {
        eventSource.close();
        setCrawlProgress(prev => ({...prev, [type]: { ...prev[type], jobId, status: 'paused', message: data.message }}));
        setIsProcessing(false);
      } else if (data.type === 'error') {
        eventSource.close();
        setError(`Crawl failed for ${url}: ${data.message}`);
        setCrawlProgress(prev => ({...prev, [type]: { jobId, status: 'error' }}));
        setIsProcessing(false);
      }
    };
    
    eventSource.onerror = () => {
      eventSource.close();
      // Only set error if not already done
      // Only set error if not already done or paused
      setCrawlProgress(prev => {
        if (prev[type]?.status === 'done' || prev[type]?.status === 'paused') return prev;
        setError(`Connection error while crawling ${url}. Backend job may still be running.`);
        setIsProcessing(false);
        return {
          ...prev,
          [type]: { ...prev[type], status: 'error' }
        };
      });
    };
  };

  const handleCrawl = async (type: 'source' | 'target') => {
    const url = type === 'source' ? sourceUrl : targetUrl;
    if (!url) return;
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, config: crawlConfig })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to start crawl');
      }

      const { jobId } = await response.json();
      connectToCrawlJob(jobId, type, url);
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const handleStopCrawl = async (type: 'source' | 'target') => {
    const jobId = crawlProgress[type]?.jobId;
    if (!jobId) return;
    
    try {
      const response = await fetch('/api/crawl/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      if (!response.ok) {
         // If job not found or other error, assume it's already stopped/gone
         setCrawlProgress(prev => ({...prev, [type]: { ...prev[type], status: 'error' }}));
      }
    } catch (err) {
      console.error('Failed to stop crawl', err);
      setCrawlProgress(prev => ({...prev, [type]: { ...prev[type], status: 'error' }}));
    }
  };

  const handlePauseCrawl = async (type: 'source' | 'target') => {
    const jobId = crawlProgress[type]?.jobId;
    if (!jobId) return;
    
    try {
      await fetch('/api/crawl/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
    } catch (err) {
      console.error('Failed to pause crawl', err);
    }
  };

  const handleResumeCrawl = async (type: 'source' | 'target') => {
    const jobId = crawlProgress[type]?.jobId;
    const url = type === 'source' ? sourceUrl : targetUrl;
    if (!jobId || !url) return;
    
    try {
      await fetch('/api/crawl/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      connectToCrawlJob(jobId, type, url);
    } catch (err) {
      console.error('Failed to resume crawl', err);
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
            <span className="font-bold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Project Name Input */}
      <div className="max-w-md mx-auto mb-8">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">Project Name</label>
        <input
          type="text"
          value={uploadProjectName}
          onChange={(e) => setUploadProjectName(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-center"
          placeholder="e.g. Acme Corp Migration"
        />
      </div>

      {/* Input Mode Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-slate-900 rounded-lg p-1 border border-slate-800">
          <button
            onClick={() => setInputMode('csv')}
            className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
              inputMode === 'csv' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Upload CSV / XML
          </button>
          <button
            onClick={() => setInputMode('crawl')}
            className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
              inputMode === 'crawl' ? 'bg-brand-500/20 text-brand-400 shadow border border-brand-500/30' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Live Crawl (New)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {inputMode === 'csv' ? (
          <>
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
              accept=".csv,.xlsx,.xls,.xml"
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
                <h3 className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Drop <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">internal_html.csv</code> or <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">sitemap.xml</code> here
                </h3>
                <p className="text-xs text-slate-500">Supports CSV, XLSX, XML up to 250k URLs</p>
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
              accept=".csv,.xlsx,.xls,.xml"
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
              <div className="flex justify-between items-center mt-6">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="text-xs text-brand-400 hover:text-brand-300 underline font-medium"
                >
                  Download CSV Template
                </button>
                <div className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Supported formats:</span> Screaming Frog CSV/Excel, Ahrefs, SEMrush, standard CSV
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
                <h3 className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Drop <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">staging_crawl.csv</code> or <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">sitemap.xml</code> here
                </h3>
                <p className="text-xs text-slate-500">Supports CSV, XLSX, XML up to 250k URLs</p>
              </div>
            )}
          </div>
        </div>

          </>
        ) : (
          <>
        {/* Source Crawl Box */}
        <div className="p-6 rounded-2xl border-2 border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">1. Crawl Old Site</h3>
              <p className="text-xs text-slate-400">Enter the current production URL</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <input 
              type="url" 
              placeholder="https://www.oldsite.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={isProcessing && crawlProgress.source?.status !== 'crawling'}
            />
            
            {crawlProgress.source?.status === 'crawling' || crawlProgress.source?.status === 'starting' ? (
              <div className="flex space-x-2">
                <button 
                  onClick={() => handlePauseCrawl('source')}
                  className="w-1/2 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Pause
                </button>
                <button 
                  onClick={() => handleStopCrawl('source')}
                  className="w-1/2 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Stop
                </button>
              </div>
            ) : crawlProgress.source?.status === 'paused' ? (
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleResumeCrawl('source')}
                  className="w-1/2 py-2.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 border border-brand-500/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Resume
                </button>
                <button 
                  onClick={() => handleStopCrawl('source')}
                  className="w-1/2 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Stop
                </button>
              </div>
            ) : (
              <button 
                onClick={() => handleCrawl('source')}
                disabled={!sourceUrl || (isProcessing && crawlProgress.source?.status !== 'done')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {crawlProgress.source?.status === 'done' ? 'Restart Crawl' : (crawlProgress.source?.status === 'error' ? 'Restart Crawl' : 'Start Crawl')}
              </button>
            )}

            {crawlProgress.source && crawlProgress.source.status !== 'done' && (
              <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Crawling...</span>
                  <span>{crawlProgress.source.current} / {crawlProgress.source.total} pages</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (crawlProgress.source.current / Math.max(1, crawlProgress.source.total)) * 100)}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 truncate">{crawlProgress.source.message}</div>
              </div>
            )}
            
            {sourceEntries && (
               <div className="mt-4 p-3 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-between">
                 <span className="text-xs font-bold text-brand-400">{sourceEntries.length} URLs Crawled</span>
                 <CheckCircle2 className="h-4 w-4 text-brand-400" />
               </div>
            )}
          </div>
        </div>

        {/* Target Crawl Box */}
        <div className="p-6 rounded-2xl border-2 border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">2. Crawl New Site</h3>
              <p className="text-xs text-slate-400">Enter the staging/new URL</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <input 
              type="url" 
              placeholder="https://staging.newsite.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={isProcessing && crawlProgress.target?.status !== 'crawling'}
            />
            
            {crawlProgress.target?.status === 'crawling' || crawlProgress.target?.status === 'starting' ? (
              <div className="flex space-x-2">
                <button 
                  onClick={() => handlePauseCrawl('target')}
                  className="w-1/2 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Pause
                </button>
                <button 
                  onClick={() => handleStopCrawl('target')}
                  className="w-1/2 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Stop
                </button>
              </div>
            ) : crawlProgress.target?.status === 'paused' ? (
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleResumeCrawl('target')}
                  className="w-1/2 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Resume
                </button>
                <button 
                  onClick={() => handleStopCrawl('target')}
                  className="w-1/2 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                >
                  Stop
                </button>
              </div>
            ) : (
              <button 
                onClick={() => handleCrawl('target')}
                disabled={!targetUrl || (isProcessing && crawlProgress.target?.status !== 'done')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {crawlProgress.target?.status === 'done' ? 'Restart Crawl' : (crawlProgress.target?.status === 'error' ? 'Restart Crawl' : 'Start Crawl')}
              </button>
            )}

            {crawlProgress.target && crawlProgress.target.status !== 'done' && (
              <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Crawling...</span>
                  <span>{crawlProgress.target.current} / {crawlProgress.target.total} pages</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (crawlProgress.target.current / Math.max(1, crawlProgress.target.total)) * 100)}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 truncate">{crawlProgress.target.message}</div>
              </div>
            )}
            
            {targetEntries && (
               <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                 <span className="text-xs font-bold text-emerald-400">{targetEntries.length} URLs Crawled</span>
                 <CheckCircle2 className="h-4 w-4 text-emerald-400" />
               </div>
            )}
          </div>
        </div>
        </>
        )}

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
                
                <div className="pt-4 border-t border-slate-800/80 w-full mt-4 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                  {!gscConnected ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOAuth('gsc'); }}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Connect GSC
                    </button>
                  ) : (
                    <select 
                      value={selectedGscSite}
                      onChange={e => setSelectedGscSite(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-slate-950 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">Select GSC Site</option>
                      {gscSites.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}

                  {!ga4Connected ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOAuth('ga4'); }}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Connect GA4
                    </button>
                  ) : (
                    <select 
                      value={selectedGa4Property}
                      onChange={e => setSelectedGa4Property(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-slate-950 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">Select GA4 Property</option>
                      {ga4Properties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.account})</option>)}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Settings Panel */}
      {inputMode === 'crawl' && (
      <div className="mb-8">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors mx-auto"
        >
          <Settings className="h-4 w-4" />
          <span>Advanced Crawler Settings</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 p-6 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-2xl mx-auto space-y-5 animate-fade-in">
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">Authentication</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setCrawlConfig(prev => ({ ...prev, authType: 'NONE' }))}
                  className={`px-3 py-2 text-center rounded-lg border text-sm transition-all ${
                    crawlConfig.authType === 'NONE' ? 'bg-brand-500/20 border-brand-500 text-brand-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => setCrawlConfig(prev => ({ ...prev, authType: 'BASIC_AUTH' }))}
                  className={`px-3 py-2 text-center rounded-lg border text-sm transition-all flex items-center justify-center space-x-2 ${
                    crawlConfig.authType === 'BASIC_AUTH' ? 'bg-brand-500/20 border-brand-500 text-brand-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Basic Auth</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCrawlConfig(prev => ({ ...prev, authType: 'FORM_AUTH' }))}
                  className={`px-3 py-2 text-center rounded-lg border text-sm transition-all flex items-center justify-center space-x-2 ${
                    crawlConfig.authType === 'FORM_AUTH' ? 'bg-brand-500/20 border-brand-500 text-brand-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <UserCircle2 className="h-4 w-4" />
                  <span>Form Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCrawlConfig(prev => ({ ...prev, authType: 'COOKIE' }))}
                  className={`px-3 py-2 text-center rounded-lg border text-sm transition-all flex items-center justify-center space-x-2 ${
                    crawlConfig.authType === 'COOKIE' ? 'bg-brand-500/20 border-brand-500 text-brand-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Cookie className="h-4 w-4" />
                  <span>Cookie</span>
                </button>
              </div>

              {crawlConfig.authType === 'BASIC_AUTH' && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Username"
                    value={crawlConfig.username}
                    onChange={e => setCrawlConfig(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={crawlConfig.password}
                    onChange={e => setCrawlConfig(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {crawlConfig.authType === 'FORM_AUTH' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                  <input
                    type="url"
                    placeholder="Login URL (e.g., /wp-admin)"
                    value={crawlConfig.loginUrl}
                    onChange={e => setCrawlConfig(prev => ({ ...prev, loginUrl: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                  <input
                    type="text"
                    placeholder="Username / Email"
                    value={crawlConfig.username}
                    onChange={e => setCrawlConfig(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={crawlConfig.password}
                    onChange={e => setCrawlConfig(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {crawlConfig.authType === 'COOKIE' && (
                <div className="animate-fade-in">
                  <input
                    type="text"
                    placeholder="session_id=12345; auth_token=abcde;"
                    value={crawlConfig.customCookie}
                    onChange={e => setCrawlConfig(prev => ({ ...prev, customCookie: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Paste your authentication cookies here to bypass complex login forms.</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-200">Spoof User-Agent & Ignore Robots.txt</label>
                <p className="text-xs text-slate-500">Helps bypass WAFs (like Cloudflare) and prevents crawler blocking.</p>
              </div>
              <button
                type="button"
                onClick={() => setCrawlConfig(prev => ({ ...prev, ignoreRobots: !prev.ignoreRobots }))}
                className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${crawlConfig.ignoreRobots ? 'bg-brand-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${crawlConfig.ignoreRobots ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Max Crawl Depth</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={crawlConfig.maxDepth}
                  onChange={e => setCrawlConfig(prev => ({ ...prev, maxDepth: parseInt(e.target.value) || 3 }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Max Pages (Limit)</label>
                <input
                  type="number"
                  min="10"
                  max="10000"
                  value={crawlConfig.maxPages}
                  onChange={e => setCrawlConfig(prev => ({ ...prev, maxPages: parseInt(e.target.value) || 500 }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Rate Limit (ms delay)</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={crawlConfig.rateLimit}
                  onChange={e => setCrawlConfig(prev => ({ ...prev, rateLimit: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">URL Exclusions (Regex)</label>
                <input
                  type="text"
                  placeholder="\?sort=|\/cart"
                  value={crawlConfig.exclusions}
                  onChange={e => setCrawlConfig(prev => ({ ...prev, exclusions: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      )}

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
