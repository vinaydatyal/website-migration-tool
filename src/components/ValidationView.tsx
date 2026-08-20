import React, { useState, useEffect } from 'react';
import { UrlMapping } from '../types/migration';
import { Play, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ValidationResult {
  sourceUrl: string;
  targetUrl: string;
  actualUrl: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED' | 'ERROR';
  statusCode?: number;
  message?: string;
}

interface ValidationViewProps {
  mappings: UrlMapping[];
}

export const ValidationView: React.FC<ValidationViewProps> = ({ mappings }) => {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  
  const mappedUrls = mappings.filter(m => m.targetUrl && m.status !== 'GONE_410' && m.strategy !== 'UNMAPPED');

  const handleStartValidation = async () => {
    if (mappedUrls.length === 0) {
      setError('No mapped URLs available to validate.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: mappedUrls.length });

    try {
      const response = await fetch('/api/validate-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mappings: mappedUrls.map(m => ({ 
            sourceUrl: m.source.url, 
            targetUrl: m.target ? m.target.url : m.targetUrl 
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start validation');
      }

      const { jobId } = await response.json();
      
      const eventSource = new EventSource(`/api/crawl/events?jobId=${jobId}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'done') {
          eventSource.close();
          setResults(data.results);
          setIsProcessing(false);
        } else if (data.type === 'error') {
          eventSource.close();
          setError(`Validation failed: ${data.message}`);
          setIsProcessing(false);
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        setError(`Connection error while validating.`);
        setIsProcessing(false);
      };

    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Live 301 Redirect Validation</h2>
          <p className="text-sm text-slate-400 mt-1">
            Test {mappedUrls.length} mapped URLs against the live server to verify if they correctly 301 redirect to the target destination.
          </p>
        </div>
        
        <button
          onClick={handleStartValidation}
          disabled={isProcessing || mappedUrls.length === 0}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-brand-500 text-slate-950 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Validating ({progress.current}/{progress.total})...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Run Validation</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="text-sm text-slate-400 font-medium">Total Tested</div>
              <div className="text-3xl font-bold text-white mt-1">{results.length}</div>
            </div>
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-sm text-emerald-400 font-medium">Passed (Perfect Match)</div>
              <div className="text-3xl font-bold text-emerald-400 mt-1">{passCount}</div>
            </div>
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <div className="text-sm text-red-400 font-medium">Failed / Errors</div>
              <div className="text-3xl font-bold text-red-400 mt-1">{failCount}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs text-slate-400 bg-slate-900/80 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Source URL</th>
                  <th className="px-4 py-3 font-semibold">Expected Target</th>
                  <th className="px-4 py-3 font-semibold">Actual Destination</th>
                  <th className="px-4 py-3 font-semibold">HTTP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {results.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.status === 'PASS' ? (
                        <span className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>PASS</span>
                        </span>
                      ) : r.status === 'SKIPPED' ? (
                        <span className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-500/10 text-slate-400 text-xs font-bold">
                          <span>SKIPPED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-bold">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>{r.status}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]" title={r.sourceUrl}>{r.sourceUrl}</td>
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]" title={r.targetUrl}>{r.targetUrl}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs truncate max-w-[200px] text-white" title={r.actualUrl}>
                        {r.actualUrl || '-'}
                      </div>
                      {r.status === 'FAIL' && r.message && (
                        <div className="text-[10px] text-red-400 mt-1 truncate">{r.message}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.statusCode === 200 ? 'bg-emerald-500/20 text-emerald-300' :
                        r.statusCode === 404 ? 'bg-red-500/20 text-red-300' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {r.statusCode || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
