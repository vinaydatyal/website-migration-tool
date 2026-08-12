import React from 'react';
import { UrlMapping } from '../types/migration';
import { X, ExternalLink, Link2, AlertCircle } from 'lucide-react';

interface Props {
  targetUrl: string;
  mappings: UrlMapping[];
  targetEntries?: import('../types/migration').CrawlEntry[];
  onClose: () => void;
  onUpdateMapping: (id: string, updates: Partial<UrlMapping>) => void;
}

export const DuplicateMappingsModal: React.FC<Props> = ({ targetUrl, mappings, targetEntries, onClose, onUpdateMapping }) => {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkTargetUrl, setBulkTargetUrl] = React.useState('');

  // Filter mappings to only those targeting this URL
  const duplicateMappings = mappings.filter(
    m => m.targetUrl?.toLowerCase() === targetUrl.toLowerCase() && m.status !== 'GONE_410'
  );

  const handleToggleSelectAll = () => {
    if (selectedIds.size === duplicateMappings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(duplicateMappings.map(m => m.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkRemap = () => {
    if (!bulkTargetUrl) return;
    selectedIds.forEach(id => {
      onUpdateMapping(id, {
        targetUrl: bulkTargetUrl,
        strategy: 'MANUAL_OVERRIDE',
        confidenceScore: 100,
        status: 'MANUAL'
      });
    });
    setSelectedIds(new Set());
    setBulkTargetUrl('');
  };

  const handleBulk410 = () => {
    selectedIds.forEach(id => {
      onUpdateMapping(id, {
        targetUrl: '',
        target: null,
        strategy: 'GONE_410',
        confidenceScore: 100,
        status: 'GONE_410'
      });
    });
    setSelectedIds(new Set());
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Link2 className="h-5 w-5 mr-2 text-brand-500" />
              Source URLs mapped to this Target
            </h2>
            <div className="text-sm text-emerald-400 font-mono mt-1 flex items-center">
              {targetUrl}
              <a href={targetUrl} target="_blank" rel="noreferrer" className="ml-2 text-slate-500 hover:text-emerald-400">
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto flex-1 p-5">
          {selectedIds.size > 0 && (
            <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/30 rounded-lg flex items-center justify-between animate-fade-in">
              <div className="text-sm font-semibold text-brand-400">
                {selectedIds.size} selected
              </div>
              <div className="flex items-center space-x-2 flex-1 max-w-md ml-4">
                <input
                  type="text"
                  list="target-urls-list"
                  placeholder="Select or enter new target URL..."
                  value={bulkTargetUrl}
                  onChange={(e) => setBulkTargetUrl(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-sm text-slate-200 rounded px-3 py-1.5 focus:border-brand-500 focus:outline-none placeholder:text-slate-500"
                />
                {targetEntries && (
                  <datalist id="target-urls-list">
                    {targetEntries.map(t => (
                      <option key={t.id} value={t.normalizedPath}>
                        {t.title}
                      </option>
                    ))}
                  </datalist>
                )}
                <button
                  onClick={handleBulkRemap}
                  disabled={!bulkTargetUrl}
                  className="bg-brand-500 text-slate-950 px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-400 transition-colors whitespace-nowrap"
                >
                  Map Selected
                </button>
                <button
                  onClick={handleBulk410}
                  className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded text-sm font-bold hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap border border-slate-700"
                >
                  Mark 410
                </button>
              </div>
            </div>
          )}
          <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold w-10">
                    <input 
                      type="checkbox" 
                      checked={duplicateMappings.length > 0 && selectedIds.size === duplicateMappings.length}
                      onChange={handleToggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900/50 text-brand-500 focus:ring-brand-500/50 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 font-semibold">Source URL</th>
                  <th className="py-3 px-4 font-semibold">Title & Meta</th>
                  <th className="py-3 px-4 font-semibold">Canonical</th>
                  <th className="py-3 px-4 font-semibold text-right">Confidence & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {duplicateMappings.map(m => {
                  const isNonCanonical = m.source.canonical && m.source.canonical.toLowerCase().trim() !== m.source.url.toLowerCase().trim();
                  
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="py-3 px-4 align-top w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(m.id)}
                          onChange={() => handleToggleSelect(m.id)}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900/50 text-brand-500 focus:ring-brand-500/50 cursor-pointer mt-0.5"
                        />
                      </td>
                      <td className="py-3 px-4 align-top w-4/12">
                        <div className="flex items-start">
                          <span className="font-mono text-slate-300 break-all text-xs">
                            {m.source.normalizedPath}
                          </span>
                          <a href={m.source.url} target="_blank" rel="noreferrer" className="ml-2 text-slate-600 hover:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {isNonCanonical && (
                          <span className="inline-block mt-2 px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-800 text-slate-400 border border-slate-700">
                            Parameter URL
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top w-4/12">
                        <div className="text-slate-300 font-medium text-xs line-clamp-2">
                          {m.source.title || <span className="text-slate-600 italic">No Title</span>}
                        </div>
                        <div className="text-slate-500 text-[11px] line-clamp-2 mt-1">
                          {m.source.metaDescription || 'No Description'}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top w-3/12">
                        {m.source.canonical ? (
                          <div className={`text-xs font-mono break-all ${isNonCanonical ? 'text-amber-400/90' : 'text-emerald-500/80'}`}>
                            {m.source.canonical}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs italic">Missing</span>
                        )}
                        {isNonCanonical && (
                          <div className="flex items-center text-[10px] text-amber-500/70 mt-1">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Differs from Source
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top w-1/12 text-right">
                        <div className={`inline-flex items-center justify-center px-2 py-1 rounded font-mono text-xs font-bold ${
                          m.confidenceScore >= 90 ? 'bg-emerald-500/20 text-emerald-400' :
                          m.confidenceScore >= 70 ? 'bg-amber-500/20 text-amber-400' :
                          m.confidenceScore > 0 ? 'bg-rose-500/20 text-rose-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {m.confidenceScore}%
                        </div>
                        <div className="flex flex-col items-end mt-2 space-y-2">
                          <button
                            onClick={() => {
                              onUpdateMapping(m.id, {
                                status: 'NEEDS_REVIEW',
                                strategy: 'UNMAPPED',
                                targetUrl: '/',
                                target: null,
                                confidenceScore: 0
                              });
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-2 py-1 rounded transition-colors"
                          >
                            Unmap
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
