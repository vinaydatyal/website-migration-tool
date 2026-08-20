import React, { useMemo } from 'react';
import { CrawlEntry, UrlMapping } from '../types/migration';
import { AlertCircle, Link as LinkIcon, ExternalLink, CheckCircle2 } from 'lucide-react';

interface LinkAuditorViewProps {
  targetEntries: CrawlEntry[];
  mappings: UrlMapping[];
}

interface LegacyLink {
  sourcePageUrl: string; // The page containing the bad link
  badLinkUrl: string;    // The legacy URL it links to
  recommendedTarget?: string; // Where it should link instead based on mapping
}

export const LinkAuditorView: React.FC<LinkAuditorViewProps> = ({ targetEntries, mappings }) => {
  const legacyLinks = useMemo(() => {
    const issues: LegacyLink[] = [];
    
    // Create a fast lookup for legacy URLs that have mappings
    const legacyMap = new Map<string, UrlMapping>();
    
    // Support exact URL matches and normalized path matches
    mappings.forEach(m => {
      legacyMap.set(m.source.url, m);
      if (m.source.normalizedPath !== '/') {
        legacyMap.set(m.source.normalizedPath, m);
      }
    });

    targetEntries.forEach(entry => {
      if (!entry.outgoingLinks) return;
      
      entry.outgoingLinks.forEach(outLink => {
        // Look up the outLink in our legacy mapping
        // We strip trailing slashes to improve match rate
        const cleanLink = outLink.replace(/\/$/, '').split('#')[0];
        const match = legacyMap.get(cleanLink) || 
                      legacyMap.get(cleanLink.replace(/^https?:\/\/[^\/]+/, ''));
        
        if (match) {
          issues.push({
            sourcePageUrl: entry.url,
            badLinkUrl: outLink,
            recommendedTarget: match.targetUrl !== match.source.url ? match.targetUrl : 'N/A (Unmapped/Deleted)'
          });
        }
      });
    });

    return issues;
  }, [targetEntries, mappings]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <LinkIcon className="h-5 w-5 text-brand-500" />
            <span>Internal Link Auditor</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Scans the new (target) website for any internal links that still point to the old legacy URLs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="text-sm text-slate-400 font-medium">Pages Scanned</div>
          <div className="text-3xl font-bold text-white mt-1">{targetEntries.length}</div>
        </div>
        <div className={`p-4 rounded-xl border ${legacyLinks.length > 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
          <div className={`text-sm font-medium ${legacyLinks.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>Legacy Links Found</div>
          <div className={`text-3xl font-bold mt-1 ${legacyLinks.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {legacyLinks.length}
          </div>
        </div>
      </div>

      {legacyLinks.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 bg-slate-900/80 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Page Found On (New Site)</th>
                <th className="px-4 py-3 font-semibold">Legacy Link (Bad)</th>
                <th className="px-4 py-3 font-semibold">Recommended Fix (New URL)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {legacyLinks.map((issue, i) => (
                <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs truncate max-w-[250px]" title={issue.sourcePageUrl}>{issue.sourcePageUrl}</span>
                      <a href={issue.sourcePageUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-brand-400"><ExternalLink className="h-3 w-3" /></a>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center space-x-1.5 px-2 py-1 rounded bg-red-500/10 text-red-400 font-mono text-xs truncate max-w-[250px]" title={issue.badLinkUrl}>
                      <AlertCircle className="h-3 w-3" />
                      <span>{issue.badLinkUrl}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-400 truncate max-w-[250px]" title={issue.recommendedTarget}>
                    {issue.recommendedTarget}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center bg-slate-900/30">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Legacy Links Found!</h3>
          <p className="text-slate-400 max-w-md">
            All internal links on your target site appear to be correctly pointing to new URLs.
          </p>
        </div>
      )}
    </div>
  );
};
