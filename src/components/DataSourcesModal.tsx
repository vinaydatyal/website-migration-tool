import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, CheckCircle2, Upload, FileSpreadsheet, Loader2, AlertCircle, FileText, Settings, ShieldAlert, UserCircle2, Cookie } from 'lucide-react';
import { CrawlEntry } from '../types/migration';
import { parseScreamingFrogCsv, parseScreamingFrogExcel } from '../utils/parser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDataParsed: (entries: CrawlEntry[]) => void;
  sourceEntries?: CrawlEntry[];
  onMergeAnalytics?: (enrichedEntries: CrawlEntry[]) => void;
}

export const DataSourcesModal: React.FC<Props> = ({ isOpen, onClose, onDataParsed, sourceEntries, onMergeAnalytics }) => {
  const [inputMode, setInputMode] = useState<'csv' | 'crawl'>('csv');
  
  // File states
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  
  // Crawl states
  const [sourceUrl, setSourceUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [crawlConfig, setCrawlConfig] = useState({
    authType: 'NONE' as 'NONE' | 'BASIC_AUTH' | 'FORM_AUTH' | 'COOKIE',
    username: '',
    password: '',
    loginUrl: '',
    customCookie: '',
    ignoreRobots: false,
    maxDepth: 10,
    maxPages: 10000,
    rateLimit: 5
  });

  // Mock states for UI
  const [crawlProgress, setCrawlProgress] = useState<any>({ source: null, target: null });
  
  // Analytics State
  const [gscConnected, setGscConnected] = useState(false);
  const [ga4Connected, setGa4Connected] = useState(false);
  const [gscSites, setGscSites] = useState<string[]>([]);
  const [ga4Properties, setGa4Properties] = useState<any[]>([]);
  const [selectedGscSite, setSelectedGscSite] = useState('');
  const [selectedGa4Property, setSelectedGa4Property] = useState('');
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);
  const [analyticsMergeSuccess, setAnalyticsMergeSuccess] = useState(false);

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const [draftRestored, setDraftRestored] = useState(false);

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

  const handleOAuth = async (service: 'gsc' | 'ga4') => {
    try {
      const res = await fetch(`/api/gsc/auth?service=${service}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'GoogleAuth', 'width=500,height=600');
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
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

  const handleMergeAnalytics = async () => {
    if (!sourceEntries || !onMergeAnalytics) return;
    setIsFetchingAnalytics(true);
    setError(null);
    setAnalyticsMergeSuccess(false);

    try {
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
           // Basic normalization if it's just a path
           u = (selectedGscSite.replace(/\/$/, '') + u).replace(/\/$/, '');
        }
        return [u, d];
      }));

      const enriched = sourceEntries.map(entry => {
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

      onMergeAnalytics(enriched);
      setAnalyticsMergeSuccess(true);
      setTimeout(() => setAnalyticsMergeSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsFetchingAnalytics(false);
    }
  };

  // --- DRAFT STATE & BACKGROUND RECOVERY ---
  const downloadCsvTemplate = () => {
    const headers = 'Address,Title 1,Meta Description 1,Status Code,Indexability,Canonical Link Element 1,Inlinks,Word Count';
    const row1 = 'https://example.com/about,About Us,Learn more about our company.,200,Indexable,https://example.com/about,15,500';
    const row2 = 'https://example.com/contact,Contact,Get in touch.,200,Indexable,https://example.com/contact,10,300';
    const csvContent = `${headers}\n${row1}\n${row2}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migration_data_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const saved = localStorage.getItem('dataSources_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSourceUrl(parsed.sourceUrl || '');
        setTargetUrl(parsed.targetUrl || '');
        setCrawlConfig(parsed.crawlConfig || crawlConfig);
        setInputMode(parsed.inputMode || 'csv');
        
        if (parsed.crawlProgress) {
          setCrawlProgress(parsed.crawlProgress);
          // Wait for functions to be defined by just doing it asynchronously or using refs/hoisting
        }
      } catch (e) {
        console.error('Failed to parse draft state', e);
      }
    }
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    const draft = {
      sourceUrl,
      targetUrl,
      crawlConfig,
      inputMode,
      crawlProgress,
    };
    try {
      localStorage.setItem('dataSources_draft', JSON.stringify(draft));
    } catch {
      // Storage quota or restriction fallback
    }
  }, [sourceUrl, targetUrl, crawlConfig, inputMode, crawlProgress, draftRestored]);

  // Handle reconnecting after functions are defined
  useEffect(() => {
    if (draftRestored) {
      const saved = localStorage.getItem('dataSources_draft');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.crawlProgress) {
            if (parsed.crawlProgress.source?.jobId && parsed.crawlProgress.source?.status !== 'done' && parsed.crawlProgress.source?.status !== 'error') {
              connectToCrawlJob(parsed.crawlProgress.source.jobId, 'source', parsed.sourceUrl);
            }
            if (parsed.crawlProgress.target?.jobId && parsed.crawlProgress.target?.status !== 'done' && parsed.crawlProgress.target?.status !== 'error') {
              connectToCrawlJob(parsed.crawlProgress.target.jobId, 'target', parsed.targetUrl);
            }
          }
        } catch (e) {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftRestored]);

  if (!isOpen) return null;

  const handleFileChange = async (file: File, type: 'source' | 'target') => {
    setError(null);
    setIsProcessing(true);
    if (type === 'source') setSourceFile(file);
    if (type === 'target') setTargetFile(file);

    try {
      let parsed: CrawlEntry[] = [];
      if (file.name.endsWith('.csv')) {
        parsed = await parseScreamingFrogCsv(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsed = await parseScreamingFrogExcel(file);
      } else {
        throw new Error('Please upload a valid CSV or XLSX file exported from Screaming Frog.');
      }

      if (parsed.length === 0) {
        throw new Error('No valid crawl URLs found in file.');
      }

      // Briefly show success state then trigger callback (in a real app you might want to wait for user to hit 'Merge Data')
      setTimeout(() => {
        setIsProcessing(false);
        // We will just call onDataParsed for now, though it only handles targetEntries in App.tsx
        onDataParsed(parsed);
      }, 500);

    } catch (err: any) {
      setError(err.message || 'Failed to parse file.');
      setIsProcessing(false);
    }
  };

  const connectToCrawlJob = (jobId: string, type: 'source' | 'target', url: string) => {
    setIsProcessing(true);
    const eventSource = new EventSource(`/api/crawl/events?jobId=${jobId}`);
    
    setCrawlProgress((prev: any) => ({
      ...prev,
      [type]: { ...prev[type], jobId, status: prev[type]?.status || 'starting' }
    }));
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'start') {
        setCrawlProgress((prev: any) => ({...prev, [type]: { jobId, status: 'starting', current: 0, total: 0, discovered: 0, queued: 0 }}));
      } else if (data.type === 'progress') {
        setCrawlProgress((prev: any) => ({
          ...prev, 
          [type]: { 
            jobId, 
            status: 'crawling', 
            current: data.current, 
            total: data.total || data.discovered || 0,
            discovered: data.discovered || data.total || 0,
            queued: data.queued !== undefined ? data.queued : Math.max(0, (data.total || 0) - data.current),
            maxPages: data.maxPages,
            message: data.message 
          }
        }));
      } else if (data.type === 'done') {
        eventSource.close();
        const entries = data.results || [];
        const summary = data.summary || {
          totalDiscovered: entries.length,
          crawledCount: entries.length,
          queuedCount: 0,
          maxPagesReached: false,
          maxPages: crawlConfig.maxPages
        };
        setCrawlProgress((prev: any) => ({
          ...prev, 
          [type]: { 
            jobId, 
            status: 'done', 
            current: summary.crawledCount, 
            total: summary.totalDiscovered,
            discovered: summary.totalDiscovered,
            queued: summary.queuedCount,
            summary,
            message: 'Crawl completed' 
          }
        }));
        
        setTimeout(() => {
          setIsProcessing(false);
          // In the modal, we trigger onDataParsed which currently updates targetEntries in App
          onDataParsed(entries);
        }, 500);
      } else if (data.type === 'paused') {
        eventSource.close();
        setCrawlProgress((prev: any) => ({...prev, [type]: { ...prev[type], jobId, status: 'paused', message: data.message }}));
        setIsProcessing(false);
      } else if (data.type === 'error') {
        eventSource.close();
        setError(`Crawl failed for ${url}: ${data.message}`);
        setCrawlProgress((prev: any) => ({...prev, [type]: { jobId, status: 'error' }}));
        setIsProcessing(false);
      }
    };
    
    eventSource.onerror = (err) => {
      console.warn("SSE connection dropped, auto-reconnecting...", err);
      // Let the native EventSource auto-reconnect. 
      // The backend retains the job and will replay events from the beginning.
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
         setCrawlProgress((prev: any) => ({...prev, [type]: { ...prev[type], status: 'error' }}));
      }
    } catch (err) {
      console.error('Failed to stop crawl', err);
      setCrawlProgress((prev: any) => ({...prev, [type]: { ...prev[type], status: 'error' }}));
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-950 rounded-xl w-full max-w-5xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-500" />
              Manage Data Sources
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Add new crawl data or connect analytics. We'll automatically run a "Smart Merge" so you never lose your manual overrides.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          
          {/* Mode Switcher */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-slate-900 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setInputMode('csv')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  inputMode === 'csv' 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                Upload CSV / XML
              </button>
              <button
                onClick={() => setInputMode('crawl')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  inputMode === 'crawl' 
                    ? 'bg-brand-500/20 text-brand-400 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                Live Crawl (New)
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Source Data Box */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border-2 border-slate-800 bg-slate-900/60 h-full">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-400">
                    {inputMode === 'csv' ? <FileSpreadsheet className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">1. Old Site (Source)</h3>
                    <p className="text-xs text-slate-400">{inputMode === 'csv' ? 'Upload existing export' : 'Run a new live crawl'}</p>
                  </div>
                </div>

                {inputMode === 'csv' ? (
                  <div className="mt-6">
                    <div className="flex justify-between items-center mt-3">
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
                    <input
                      type="file"
                      ref={sourceInputRef}
                      accept=".csv,.xlsx,.xls,.xml"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], 'source')}
                    />
                    {sourceFile ? (
                      <div className="space-y-3 pt-2">
                        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="h-4 w-4 text-brand-400 shrink-0" />
                            <span className="text-xs font-mono text-slate-200 truncate">{sourceFile.name}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => sourceInputRef.current?.click()}
                          className="text-xs text-slate-400 hover:text-slate-200 underline decoration-slate-600 w-full text-center"
                        >
                          Change source file
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => sourceInputRef.current?.click()}
                        className="py-8 text-center cursor-pointer space-y-2 border-2 border-dashed border-slate-700 rounded-xl hover:border-brand-500/50 hover:bg-slate-800/50 transition-all"
                      >
                        <Upload className="h-8 w-8 text-slate-500 mx-auto group-hover:text-brand-400 transition-colors" />
                        <h3 className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                          Drop <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">internal_html.csv</code> here
                        </h3>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 mt-6">
                    <input 
                      type="url" 
                      placeholder="https://www.oldsite.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      disabled={isProcessing && crawlProgress.source?.status !== 'crawling'}
                    />
                    
                    {crawlProgress.source?.status === 'crawling' || crawlProgress.source?.status === 'starting' ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handlePauseCrawl('source')}
                          className="w-1/2 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Pause
                        </button>
                        <button 
                          onClick={() => handleStopCrawl('source')}
                          className="w-1/2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Stop
                        </button>
                      </div>
                    ) : crawlProgress.source?.status === 'paused' ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleResumeCrawl('source')}
                          className="w-1/2 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 border border-brand-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Resume
                        </button>
                        <button 
                          onClick={() => handleStopCrawl('source')}
                          className="w-1/2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Stop
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleCrawl('source')}
                        disabled={!sourceUrl || (isProcessing && crawlProgress.source?.status !== 'done')}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {crawlProgress.source?.status === 'done' ? 'Restart Crawl' : (crawlProgress.source?.status === 'error' ? 'Restart Crawl' : 'Start Crawl')}
                      </button>
                    )}

                    {crawlProgress.source && crawlProgress.source.status !== 'done' && (
                      <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                            </span>
                            <span>{crawlProgress.source.status === 'starting' ? 'Scanning Sitemaps...' : 'Crawling Site...'}</span>
                          </span>
                          <span className="font-mono text-slate-300 font-medium">
                            {crawlProgress.source.total > 0 ? (
                              <>
                                <span className="text-brand-400 font-bold">{crawlProgress.source.current}</span>
                                <span className="text-slate-500"> / </span>
                                <span>{crawlProgress.source.total}</span>
                                <span className="text-slate-400 text-[11px] ml-1">pages</span>
                              </>
                            ) : (
                              <span className="text-slate-500 text-[11px] italic">Discovering URLs...</span>
                            )}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-brand-500 h-1.5 rounded-full transition-all duration-300" 
                            style={{ width: crawlProgress.source.total > 0 ? `${Math.min(100, Math.max(3, (crawlProgress.source.current / crawlProgress.source.total) * 100))}%` : '15%' }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate max-w-[180px] text-slate-400">{crawlProgress.source.message}</span>
                          {crawlProgress.source.queued !== undefined && crawlProgress.source.queued > 0 && (
                            <span className="shrink-0 text-slate-400 font-mono text-[10px] bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                              {crawlProgress.source.queued} in queue
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {crawlProgress.source?.status === 'done' && (
                      <div className="mt-4 p-3 rounded-xl bg-slate-950/90 border border-brand-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Crawl Summary</span>
                          {crawlProgress.source?.summary?.queuedCount > 0 ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              Limit Capped ({crawlConfig.maxPages} max)
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30">
                              100% Crawled
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                            <span className="block text-[10px] text-slate-400 font-medium">Pages in Crawl</span>
                            <div className="flex items-baseline space-x-1 mt-0.5">
                              <span className="text-base font-bold text-slate-200 font-mono">
                                {crawlProgress.source?.summary?.totalDiscovered ?? crawlProgress.source?.total ?? 0}
                              </span>
                              <span className="text-[10px] text-slate-500">found</span>
                            </div>
                          </div>
                          <div className="bg-slate-900/90 p-2 rounded-lg border border-brand-500/20">
                            <span className="block text-[10px] text-brand-400 font-medium">Actually Crawled</span>
                            <div className="flex items-baseline space-x-1 mt-0.5">
                              <span className="text-base font-bold text-brand-400 font-mono">
                                {crawlProgress.source?.summary?.crawledCount ?? crawlProgress.source?.current ?? 0}
                              </span>
                              <span className="text-[10px] text-slate-400">pages</span>
                            </div>
                          </div>
                        </div>
                        {crawlProgress.source?.summary?.queuedCount > 0 ? (
                          <p className="text-[10px] text-amber-400/90 leading-tight bg-amber-500/5 p-1.5 rounded border border-amber-500/20">
                            ⚠️ {crawlProgress.source.summary.queuedCount} discovered pages were left uncrawled (maxPages limit).
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 leading-tight">
                            ✓ All discovered pages were successfully crawled.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Target Data Box */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border-2 border-slate-800 bg-slate-900/60 h-full">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                    {inputMode === 'csv' ? <FileSpreadsheet className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">2. New Site (Target)</h3>
                    <p className="text-xs text-slate-400">{inputMode === 'csv' ? 'Upload existing export' : 'Run a new live crawl'}</p>
                  </div>
                </div>

                {inputMode === 'csv' ? (
                  <div className="mt-6">
                    <input
                      type="file"
                      ref={targetInputRef}
                      accept=".csv,.xlsx,.xls,.xml"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], 'target')}
                    />
                    {targetFile ? (
                      <div className="space-y-3 pt-2">
                        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span className="text-xs font-mono text-slate-200 truncate">{targetFile.name}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => targetInputRef.current?.click()}
                          className="text-xs text-slate-400 hover:text-slate-200 underline decoration-slate-600 w-full text-center"
                        >
                          Change target file
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => targetInputRef.current?.click()}
                        className="py-8 text-center cursor-pointer space-y-2 border-2 border-dashed border-slate-700 rounded-xl hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all"
                      >
                        <Upload className="h-8 w-8 text-slate-500 mx-auto group-hover:text-emerald-400 transition-colors" />
                        <h3 className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                          Drop <code className="text-xs font-mono bg-slate-800 px-1 py-0.5 rounded">staging_crawl.csv</code> here
                        </h3>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 mt-6">
                    <input 
                      type="url" 
                      placeholder="https://staging.newsite.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      disabled={isProcessing && crawlProgress.target?.status !== 'crawling'}
                    />
                    
                    {crawlProgress.target?.status === 'crawling' || crawlProgress.target?.status === 'starting' ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handlePauseCrawl('target')}
                          className="w-1/2 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Pause
                        </button>
                        <button 
                          onClick={() => handleStopCrawl('target')}
                          className="w-1/2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Stop
                        </button>
                      </div>
                    ) : crawlProgress.target?.status === 'paused' ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleResumeCrawl('target')}
                          className="w-1/2 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Resume
                        </button>
                        <button 
                          onClick={() => handleStopCrawl('target')}
                          className="w-1/2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Stop
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleCrawl('target')}
                        disabled={!targetUrl || (isProcessing && crawlProgress.target?.status !== 'done')}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {crawlProgress.target?.status === 'done' ? 'Restart Crawl' : (crawlProgress.target?.status === 'error' ? 'Restart Crawl' : 'Start Crawl')}
                      </button>
                    )}

                    {crawlProgress.target && crawlProgress.target.status !== 'done' && (
                      <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>{crawlProgress.target.status === 'starting' ? 'Scanning Sitemaps...' : 'Crawling Site...'}</span>
                          </span>
                          <span className="font-mono text-slate-300 font-medium">
                            {crawlProgress.target.total > 0 ? (
                              <>
                                <span className="text-emerald-400 font-bold">{crawlProgress.target.current}</span>
                                <span className="text-slate-500"> / </span>
                                <span>{crawlProgress.target.total}</span>
                                <span className="text-slate-400 text-[11px] ml-1">pages</span>
                              </>
                            ) : (
                              <span className="text-slate-500 text-[11px] italic">Discovering URLs...</span>
                            )}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                            style={{ width: crawlProgress.target.total > 0 ? `${Math.min(100, Math.max(3, (crawlProgress.target.current / crawlProgress.target.total) * 100))}%` : '15%' }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate max-w-[180px] text-slate-400">{crawlProgress.target.message}</span>
                          {crawlProgress.target.queued !== undefined && crawlProgress.target.queued > 0 && (
                            <span className="shrink-0 text-slate-400 font-mono text-[10px] bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                              {crawlProgress.target.queued} in queue
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {crawlProgress.target?.status === 'done' && (
                      <div className="mt-4 p-3 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Crawl Summary</span>
                          {crawlProgress.target?.summary?.queuedCount > 0 ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              Limit Capped ({crawlConfig.maxPages} max)
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              100% Crawled
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                            <span className="block text-[10px] text-slate-400 font-medium">Pages in Crawl</span>
                            <div className="flex items-baseline space-x-1 mt-0.5">
                              <span className="text-base font-bold text-slate-200 font-mono">
                                {crawlProgress.target?.summary?.totalDiscovered ?? crawlProgress.target?.total ?? 0}
                              </span>
                              <span className="text-[10px] text-slate-500">found</span>
                            </div>
                          </div>
                          <div className="bg-slate-900/90 p-2 rounded-lg border border-emerald-500/20">
                            <span className="block text-[10px] text-emerald-400 font-medium">Actually Crawled</span>
                            <div className="flex items-baseline space-x-1 mt-0.5">
                              <span className="text-base font-bold text-emerald-400 font-mono">
                                {crawlProgress.target?.summary?.crawledCount ?? crawlProgress.target?.current ?? 0}
                              </span>
                              <span className="text-[10px] text-slate-400">pages</span>
                            </div>
                          </div>
                        </div>
                        {crawlProgress.target?.summary?.queuedCount > 0 ? (
                          <p className="text-[10px] text-amber-400/90 leading-tight bg-amber-500/5 p-1.5 rounded border border-amber-500/20">
                            ⚠️ {crawlProgress.target.summary.queuedCount} discovered pages were left uncrawled (maxPages limit).
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 leading-tight">
                            ✓ All discovered pages were successfully crawled.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Analytics Box */}
            <div className="p-6 rounded-2xl border-2 border-slate-800 bg-slate-900/60 flex flex-col justify-between">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">3. Analytics</h3>
                  <p className="text-xs text-slate-400">Connect GSC / GA4</p>
                </div>
              </div>
              
              <div className="mt-auto flex flex-col gap-3">
                {!gscConnected ? (
                  <button 
                    onClick={() => handleOAuth('gsc')}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Connect GSC</span>
                  </button>
                ) : (
                  <select 
                    value={selectedGscSite}
                    onChange={e => setSelectedGscSite(e.target.value)}
                    className="w-full bg-slate-950 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">Select GSC Site</option>
                    {gscSites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}

                {!ga4Connected ? (
                  <button 
                    onClick={() => handleOAuth('ga4')}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Connect GA4</span>
                  </button>
                ) : (
                  <select 
                    value={selectedGa4Property}
                    onChange={e => setSelectedGa4Property(e.target.value)}
                    className="w-full bg-slate-950 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">Select GA4 Property</option>
                    {ga4Properties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.account})</option>)}
                  </select>
                )}

                {(gscConnected || ga4Connected) && sourceEntries && (
                  <button 
                    onClick={handleMergeAnalytics}
                    disabled={isFetchingAnalytics}
                    className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isFetchingAnalytics && <Loader2 className="w-4 h-4 animate-spin" />}
                    {analyticsMergeSuccess ? 'Merged Successfully!' : 'Fetch & Merge Data'}
                  </button>
                )}
                
                {(gscConnected || ga4Connected) && !sourceEntries && (
                  <div className="text-xs text-amber-400 mt-2 text-center">
                    Perform a source crawl first to merge analytics.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Advanced Settings Panel */}
          {inputMode === 'crawl' && (
          <div className="mt-8 mb-8">
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
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                        value={crawlConfig.username}
                        onChange={e => setCrawlConfig(prev => ({...prev, username: e.target.value}))}
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                        value={crawlConfig.password}
                        onChange={e => setCrawlConfig(prev => ({...prev, password: e.target.value}))}
                      />
                    </div>
                  )}

                  {crawlConfig.authType === 'FORM_AUTH' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                      <input
                        type="url"
                        placeholder="Login URL (e.g. /wp-admin)"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                        value={crawlConfig.loginUrl}
                        onChange={e => setCrawlConfig(prev => ({...prev, loginUrl: e.target.value}))}
                      />
                      <input
                        type="text"
                        placeholder="Username"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                        value={crawlConfig.username}
                        onChange={e => setCrawlConfig(prev => ({...prev, username: e.target.value}))}
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                        value={crawlConfig.password}
                        onChange={e => setCrawlConfig(prev => ({...prev, password: e.target.value}))}
                      />
                    </div>
                  )}

                  {crawlConfig.authType === 'COOKIE' && (
                    <div className="animate-fade-in">
                      <input
                        type="text"
                        placeholder="session_id=abcdef12345; auth_token=xyz"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                        value={crawlConfig.customCookie}
                        onChange={e => setCrawlConfig(prev => ({...prev, customCookie: e.target.value}))}
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-semibold text-slate-200">Ignore robots.txt</label>
                      <p className="text-xs text-slate-500">Crawl disallowed paths</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setCrawlConfig(prev => ({...prev, ignoreRobots: !prev.ignoreRobots}))}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${crawlConfig.ignoreRobots ? 'bg-brand-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${crawlConfig.ignoreRobots ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-semibold text-slate-200">Max Depth</label>
                      <span className="text-xs font-mono text-brand-400">{crawlConfig.maxDepth}</span>
                    </div>
                    <input 
                      type="range" min="1" max="20" 
                      className="w-full accent-brand-500"
                      value={crawlConfig.maxDepth}
                      onChange={e => setCrawlConfig(prev => ({...prev, maxDepth: parseInt(e.target.value)}))}
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-semibold text-slate-200">Max Pages</label>
                      <span className="text-xs font-mono text-brand-400">{crawlConfig.maxPages}</span>
                    </div>
                    <input 
                      type="range" min="100" max="50000" step="100"
                      className="w-full accent-brand-500"
                      value={crawlConfig.maxPages}
                      onChange={e => setCrawlConfig(prev => ({...prev, maxPages: parseInt(e.target.value)}))}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-semibold text-slate-200">Rate Limit (req/sec)</label>
                      <span className="text-xs font-mono text-brand-400">{crawlConfig.rateLimit}</span>
                    </div>
                    <input 
                      type="range" min="1" max="50"
                      className="w-full accent-brand-500"
                      value={crawlConfig.rateLimit}
                      onChange={e => setCrawlConfig(prev => ({...prev, rateLimit: parseInt(e.target.value)}))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

        </div>

      </div>
    </div>
  );
};
