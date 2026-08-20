import React, { useState, useMemo, useEffect } from 'react';
import { CrawlEntry } from '../types/migration';
import { Search, Database, ExternalLink, Info } from 'lucide-react';

interface CrawlDataViewProps {
  sourceEntries: CrawlEntry[] | null;
  targetEntries: CrawlEntry[] | null;
}

export const CrawlDataView: React.FC<CrawlDataViewProps> = ({ sourceEntries, targetEntries }) => {
  const [activeTab, setActiveTab] = useState<'source' | 'target'>('source');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  const currentData = activeTab === 'source' ? sourceEntries : targetEntries;

  const filteredData = useMemo(() => {
    if (!currentData) return [];
    if (!searchQuery.trim()) return currentData;
    
    const query = searchQuery.toLowerCase();
    return currentData.filter(entry => 
      entry.url.toLowerCase().includes(query) ||
      (entry.title && entry.title.toLowerCase().includes(query)) ||
      (entry.description && entry.description.toLowerCase().includes(query))
    );
  }, [currentData, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Database className="h-6 w-6 text-brand-400" />
            <span>Crawl Data</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">Review the raw data collected from your websites or CSV uploads.</p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800">
        <div className="flex w-full sm:w-auto p-1 bg-slate-950 rounded-lg">
          <button
            onClick={() => setActiveTab('source')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'source'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Old Site (Source)
            <span className="ml-2 text-xs font-mono bg-slate-900/50 px-2 py-0.5 rounded-full border border-slate-700">
              {sourceEntries?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('target')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'target'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            New Site (Target)
            <span className="ml-2 text-xs font-mono bg-slate-900/50 px-2 py-0.5 rounded-full border border-slate-700">
              {targetEntries?.length || 0}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search URLs, titles, or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 w-1/4">URL</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 w-1/4">Title & Description</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 w-24">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 w-32">Indexability</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Canonical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {!currentData || currentData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Info className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p>No data available for {activeTab === 'source' ? 'Old Site' : 'New Site'}.</p>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <p>No results found for "{searchQuery}".</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 border-b border-slate-800/50">
                      <div className="flex items-start space-x-2">
                        <a 
                          href={entry.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-brand-400 hover:text-brand-300 break-all leading-tight"
                        >
                          {entry.url}
                        </a>
                        <ExternalLink className="h-3 w-3 text-slate-500 shrink-0 mt-1" />
                      </div>
                      {(entry.visits || 0) > 0 && (
                        <div className="mt-2 inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          <span>{entry.visits?.toLocaleString()} visits</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 border-b border-slate-800/50">
                      <div className="space-y-1">
                        <div className="text-sm text-slate-200 line-clamp-2" title={entry.title || 'Missing Title'}>
                          {entry.title || <span className="text-slate-500 italic">No Title</span>}
                        </div>
                        <div className="text-xs text-slate-400 line-clamp-3" title={entry.description || 'Missing Description'}>
                          {entry.description || <span className="text-slate-600 italic">No Meta Description</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 border-b border-slate-800/50">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-mono font-medium ${
                        entry.statusCode === 200 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        entry.statusCode >= 300 && entry.statusCode < 400 ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {entry.statusCode}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-b border-slate-800/50">
                      <span className={`text-xs font-medium ${
                        entry.indexability === 'Indexable' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {entry.indexability || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-b border-slate-800/50">
                      <div className="text-xs text-slate-400 break-all line-clamp-2" title={entry.canonical || 'Self-referencing / None'}>
                        {entry.canonical || <span className="italic text-slate-600">None</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {filteredData.length > 0 && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-slate-400">
              <span>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} URLs</span>
              {searchQuery && <span> (Filtered from {currentData?.length || 0})</span>}
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-400 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
