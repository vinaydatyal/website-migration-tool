import React, { useState, useEffect } from 'react';
import { Server, Shield, FileCode2, Code2, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { ProjectMetadata } from '../types/migration';

interface Props {
  projectMetadata: ProjectMetadata;
}

export const InfrastructureAuditorView: React.FC<Props> = ({ projectMetadata }) => {
  const [sourceDomain, setSourceDomain] = useState<string>('');
  const [targetDomain, setTargetDomain] = useState<string>('');
  
  const [loadingSource, setLoadingSource] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  
  const [sourceData, setSourceData] = useState<any>(null);
  const [targetData, setTargetData] = useState<any>(null);
  
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);

  const checkInfrastructure = async (domainToTest: string, type: 'source' | 'target') => {
    if (!domainToTest) return;
    
    // Simple sanitization to get just the domain
    let cleanDomain = domainToTest.trim();
    if (cleanDomain.startsWith('http')) {
      try {
        cleanDomain = new URL(cleanDomain).hostname;
      } catch (e) {
        // ignore
      }
    }

    if (type === 'source') {
      setLoadingSource(true);
      setSourceError(null);
      setSourceData(null);
    } else {
      setLoadingTarget(true);
      setTargetError(null);
      setTargetData(null);
    }
    
    try {
      const [dnsSslRes, robotsRes, sitemapRes] = await Promise.all([
        fetch(`/api/check-dns-ssl?domain=${encodeURIComponent(cleanDomain)}`),
        fetch(`/api/check-robots?domain=${encodeURIComponent(cleanDomain)}`),
        fetch(`/api/check-sitemap?domain=${encodeURIComponent(cleanDomain)}`)
      ]);

      if (!dnsSslRes.ok) throw new Error('Failed to fetch DNS/SSL data');
      
      const dnsSsl = await dnsSslRes.json();
      const robots = await robotsRes.json();
      const sitemap = await sitemapRes.json();

      const combinedData = { dnsSsl, robots, sitemap };

      if (type === 'source') setSourceData(combinedData);
      else setTargetData(combinedData);
      
    } catch (err: any) {
      if (type === 'source') setSourceError(err.message || 'An error occurred during infrastructure checks.');
      else setTargetError(err.message || 'An error occurred during infrastructure checks.');
    } finally {
      if (type === 'source') setLoadingSource(false);
      else setLoadingTarget(false);
    }
  };

  const renderResultBlock = (data: any, title: string) => {
    if (!data) return null;
    const { dnsSsl, robots, sitemap } = data;

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2">{title} Results</h2>
        
        {/* SSL Status */}
        <div className="glass-panel glass-panel-hover rounded-xl p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-900 dark:text-white">
            <Shield className="w-5 h-5 text-emerald-500" />
            SSL Certificate
          </h3>
          {dnsSsl?.ssl?.valid ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
                Certificate is valid and active
              </div>
              <div className="grid grid-cols-2 gap-y-2 mt-4 text-slate-600 dark:text-slate-400 break-words">
                <span className="font-medium text-slate-800 dark:text-slate-200">Issuer:</span>
                <span>{dnsSsl.ssl.issuer}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">Subject:</span>
                <span>{dnsSsl.ssl.subject}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">Valid From:</span>
                <span>{new Date(dnsSsl.ssl.validFrom).toLocaleDateString()}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">Valid To:</span>
                <span>{new Date(dnsSsl.ssl.validTo).toLocaleDateString()}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm">
              <XCircle className="w-5 h-5 shrink-0" />
              {dnsSsl?.ssl?.message || 'Invalid or missing SSL certificate'}
            </div>
          )}
        </div>

        {/* DNS Resolution */}
        <div className="glass-panel glass-panel-hover rounded-xl p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-900 dark:text-white">
            <Server className="w-5 h-5 text-blue-500" />
            DNS Resolution
          </h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">A Records (IPs)</div>
              {dnsSsl?.dns?.a?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {dnsSsl.dns.a.map((ip: string) => (
                    <span key={ip} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">{ip}</span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No A records found</div>
              )}
            </div>
            
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">CNAME Records</div>
              {dnsSsl?.dns?.cname?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {dnsSsl.dns.cname.map((cname: string) => (
                    <span key={cname} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">{cname}</span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No CNAME records found</div>
              )}
            </div>
          </div>
        </div>

        {/* Robots.txt */}
        <div className="glass-panel glass-panel-hover rounded-xl p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-900 dark:text-white">
            <FileCode2 className="w-5 h-5 text-indigo-500" />
            Robots.txt Status
          </h3>
          {robots?.exists ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" /> Found (HTTP {robots.status})
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg font-mono text-sm text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre max-h-64 overflow-y-auto">
                {robots.content}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm">
              <XCircle className="w-5 h-5 shrink-0" />
              Missing or inaccessible (HTTP {robots?.status || 'Error'})
            </div>
          )}
        </div>

        {/* Sitemap */}
        <div className="glass-panel glass-panel-hover rounded-xl p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-900 dark:text-white">
            <Code2 className="w-5 h-5 text-orange-500" />
            Sitemap.xml Preview
          </h3>
          {sitemap?.exists ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Found {sitemap.urlCount} URLs (HTTP {sitemap.status})
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre max-h-48 overflow-y-auto">
                {sitemap.rawContentPreview}
                {sitemap.rawContentPreview?.length >= 1000 && '\n\n... (truncated)'}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-medium bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Not found at /sitemap.xml (Check robots.txt for custom path)
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 flex items-center gap-2">
            <Server className="w-6 h-6 text-brand-500" />
            Side-by-Side Infrastructure Auditor
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Validate DNS, SSL certificates, Robots.txt, and Sitemaps between your old and new domains.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Source Column */}
        <div className="space-y-6">
          <div className="glass-panel glass-panel-hover rounded-xl p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              Source Domain (Old)
            </h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="e.g. old-website.com" 
                  value={sourceDomain}
                  onChange={(e) => setSourceDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkInfrastructure(sourceDomain, 'source')}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 backdrop-blur-sm shadow-inner"
                />
              </div>
              <button 
                onClick={() => checkInfrastructure(sourceDomain, 'source')}
                disabled={loadingSource || !sourceDomain}
                className="px-6 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg font-medium transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-brand-500/20"
              >
                {loadingSource ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {loadingSource ? 'Auditing...' : 'Audit Source'}
              </button>
            </div>
            {sourceError && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2 border border-red-200 dark:border-red-500/30">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {sourceError}
              </div>
            )}
          </div>
          
          {renderResultBlock(sourceData, 'Source')}
        </div>

        {/* Target Column */}
        <div className="space-y-6">
          <div className="glass-panel glass-panel-hover rounded-xl p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              Target Domain (New/Staging)
            </h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="e.g. staging-website.com" 
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkInfrastructure(targetDomain, 'target')}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 backdrop-blur-sm shadow-inner"
                />
              </div>
              <button 
                onClick={() => checkInfrastructure(targetDomain, 'target')}
                disabled={loadingTarget || !targetDomain}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-emerald-500/20"
              >
                {loadingTarget ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {loadingTarget ? 'Auditing...' : 'Audit Target'}
              </button>
            </div>
            {targetError && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2 border border-red-200 dark:border-red-500/30">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {targetError}
              </div>
            )}
          </div>

          {renderResultBlock(targetData, 'Target')}
        </div>

      </div>
    </div>
  );
};
