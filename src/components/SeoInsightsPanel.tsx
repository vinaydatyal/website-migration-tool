import React, { useMemo } from 'react';
import { Network, Search, AlertTriangle, ArrowRight, Zap, Target, CheckCircle2 } from 'lucide-react';
import { CrawlEntry, UrlMapping } from '../types/migration';
import { calculateInternalEquity, detectContentCannibalization } from '../utils/seoAlgorithms';

interface SeoInsightsPanelProps {
  mappings: UrlMapping[];
}

export const SeoInsightsPanel: React.FC<SeoInsightsPanelProps> = ({ mappings }) => {
  // Extract all unique source entries from mappings
  const sourceEntries = useMemo(() => {
    const unique = new Map<string, CrawlEntry>();
    mappings.forEach(m => unique.set(m.source.url, m.source));
    return Array.from(unique.values());
  }, [mappings]);

  const { orphanPages, powerPages, nodes } = useMemo(() => calculateInternalEquity(sourceEntries), [sourceEntries]);
  const cannibalizationRisks = useMemo(() => detectContentCannibalization(sourceEntries), [sourceEntries]);

  if (sourceEntries.length === 0) return null;

  return (
    <div className="space-y-6 mt-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-brand-500/10 rounded-lg">
          <Target className="h-6 w-6 text-brand-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-sans tracking-tight">AI SEO Consultant Insights</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Deep structural and semantic analysis of your source domain.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Internal Equity Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <Network className="h-4 w-4 text-brand-500" />
              <span>Internal Link Equity</span>
            </h3>
            <span className="text-xs px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 font-bold tracking-wide">
              {powerPages.length} Power Pages
            </span>
          </div>
          <div className="p-5 flex-1 flex flex-col space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                <Zap className="h-4 w-4 mr-1.5 text-amber-500" /> Top Power Pages
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Pages with the highest internal equity concentration. Ensure these map to highly relevant targets.</p>
              <div className="space-y-2">
                {powerPages.slice(0, 3).map((url, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <span className="truncate flex-1 text-slate-700 dark:text-slate-300 font-mono pr-2">{new URL(url).pathname || url}</span>
                    <span className="font-bold text-brand-600 dark:text-brand-400">Score: {nodes[url]}</span>
                  </div>
                ))}
                {powerPages.length === 0 && <p className="text-xs text-slate-400 italic">No significant power pages detected.</p>}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1.5 text-red-500" /> Orphan Pages ({orphanPages.length})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Pages with 0 incoming internal links. Consider dropping these from the migration if they have no traffic.</p>
            </div>
          </div>
        </div>

        {/* Cannibalization Risk Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <Search className="h-4 w-4 text-brand-500" />
              <span>Keyword Cannibalization</span>
            </h3>
            <span className="text-xs px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 font-bold tracking-wide">
              {cannibalizationRisks.length} Risks
            </span>
          </div>
          <div className="p-5 flex-1 overflow-y-auto max-h-[300px]">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Pages targeting the exact same semantic intent. Consider consolidating these pages into a single target URL.</p>
            
            {cannibalizationRisks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No cannibalization detected</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cannibalizationRisks.slice(0, 3).map((risk, i) => (
                  <div key={i} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                        {risk.sharedIntent}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${risk.severity === 'HIGH' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {risk.severity} RISK
                      </span>
                    </div>
                    <div className="space-y-1 mt-2">
                      {risk.urls.slice(0, 3).map((url, j) => (
                        <div key={j} className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate flex items-center">
                          <ArrowRight className="h-3 w-3 mr-1 text-slate-300 dark:text-slate-600" />
                          {new URL(url).pathname || url}
                        </div>
                      ))}
                      {risk.urls.length > 3 && (
                        <div className="text-[10px] text-brand-500 font-semibold pl-4">
                          + {risk.urls.length - 3} more pages
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
