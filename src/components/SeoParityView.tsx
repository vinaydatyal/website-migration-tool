import React, { useState } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  ArrowRight, 
  Search,
  ExternalLink,
  ShieldCheck,
  FileWarning,
  Download,
  CheckCircle,
  XCircle,
  Ban,
  MessageSquare
} from 'lucide-react';
import { UrlMapping, DiscrepancySeverity, ParityDiscrepancy } from '../types/migration';
import { FilterBuilder, FilterCondition } from './FilterBuilder';
import { exportDiscrepanciesToCsv } from '../utils/exporters';

interface SeoParityViewProps {
  mappings: UrlMapping[];
  resolvedDiscrepancies?: Record<string, boolean>;
  onToggleDiscrepancyResolution?: (id: string) => void;
  onUpdateMapping?: (id: string, updates: Partial<UrlMapping>) => void;
  onBulkUpdateMappings?: (updates: { id: string, updates: Partial<UrlMapping> }[]) => void;
}

export const SeoParityView: React.FC<SeoParityViewProps> = ({ 
  mappings, 
  resolvedDiscrepancies = {}, 
  onToggleDiscrepancyResolution,
  onUpdateMapping,
  onBulkUpdateMappings
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'WARNING'>('ALL');
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('ALL');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: 'c1', operator: 'CONTAINS', value: '' }
  ]);
  const [deferredConditions, setDeferredConditions] = useState<FilterCondition[]>(conditions);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');

  // Debounce filter inputs for performance
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDeferredConditions(conditions);
    }, 300);
    return () => clearTimeout(timer);
  }, [conditions]);

  const addCondition = () => {
    setConditions(prev => [...prev, { id: `c_${Date.now()}`, operator: 'CONTAINS', value: '' }]);
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Extract all discrepancies linked with their mapping context
  const allDiscrepancies = mappings.flatMap(m => 
    m.discrepancies.map(d => ({
      ...d,
      mappingId: m.id,
      sourceUrl: m.source.url,
      sourcePath: m.source.normalizedPath,
      targetUrl: m.target ? m.target.url : m.targetUrl,
      targetPath: m.target ? m.target.normalizedPath : m.targetUrl,
      sourceInlinks: m.source.inlinks,
      isResolved: resolvedDiscrepancies[d.id] || false
    }))
  );

  const filteredDiscrepancies = allDiscrepancies.filter(d => {
    if (severityFilter !== 'ALL' && d.severity !== severityFilter) return false;
    if (errorTypeFilter !== 'ALL' && d.type !== errorTypeFilter) return false;

    // Apply AND logic across all non-empty conditions
    const activeConditions = deferredConditions.filter(c => c.value.trim().length > 0);
    
    if (activeConditions.length === 0) return true;

    return activeConditions.every(cond => {
      const v = cond.value.toLowerCase().trim();
      
      const searchSpace = [
        d.title,
        d.description,
        d.sourceUrl,
        d.targetUrl,
        d.sourceValue,
        d.targetValue
      ].join(' ').toLowerCase();

      switch (cond.operator) {
        case 'CONTAINS':
          return searchSpace.includes(v);
        case 'NOT_CONTAINS':
          return !searchSpace.includes(v);
        case 'EQUALS':
          return searchSpace === v;
        case 'STARTS_WITH':
          return d.sourceUrl.toLowerCase().startsWith(v) || d.targetUrl.toLowerCase().startsWith(v);
        case 'ENDS_WITH':
          return d.sourceUrl.toLowerCase().endsWith(v) || d.targetUrl.toLowerCase().endsWith(v);
        default:
          return true;
      }
    });
  });

  // Reset to page 1 and clear selection when filters change
  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedItemIds(new Set());
  }, [deferredConditions, severityFilter, errorTypeFilter]);

  // Calculate Paginated Rows
  const totalPages = Math.ceil(filteredDiscrepancies.length / itemsPerPage);
  const paginatedDiscrepancies = filteredDiscrepancies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const criticalCount = allDiscrepancies.filter(d => d.severity === 'CRITICAL').length;
  const highCount = allDiscrepancies.filter(d => d.severity === 'HIGH').length;
  const warningCount = allDiscrepancies.filter(d => d.severity === 'WARNING').length;

  const handleExportSelected = () => {
    const selectedItems = allDiscrepancies.filter(d => selectedItemIds.has(d.id));
    if (selectedItems.length === 0) return;
    
    const { content, filename, mimeType } = exportDiscrepanciesToCsv(selectedItems);
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setSelectedItemIds(new Set());
  };

  const handleBulkApprove = () => {
    if (!onBulkUpdateMappings) return;
    const selectedItems = allDiscrepancies.filter(d => selectedItemIds.has(d.id));
    const mappingIds = Array.from(new Set(selectedItems.map(d => d.mappingId)));
    onBulkUpdateMappings(mappingIds.map(id => ({ id, updates: { status: 'APPROVED' } })));
    setSelectedItemIds(new Set());
  };

  const handleBulk410 = () => {
    if (!onBulkUpdateMappings) return;
    const selectedItems = allDiscrepancies.filter(d => selectedItemIds.has(d.id));
    const mappingIds = Array.from(new Set(selectedItems.map(d => d.mappingId)));
    onBulkUpdateMappings(mappingIds.map(id => ({ 
      id, 
      updates: { status: 'GONE_410', statusCode: 410, targetUrl: '/410-gone', strategy: 'GONE_410' } 
    })));
    setSelectedItemIds(new Set());
  };

  const handleToggleSelectAll = (items: typeof allDiscrepancies) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      const allSelected = items.every(item => newSet.has(item.id));
      if (allSelected) {
        items.forEach(item => newSet.delete(item.id));
      } else {
        items.forEach(item => newSet.add(item.id));
      }
      return newSet;
    });
  };

  const handleToggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filter Controls */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <FileWarning className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              <span>Pre vs. Post SEO Parity Inspector</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Automated reconciliation comparing metadata, indexability, status codes, and word count deltas.
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
          {/* Left Column: Search & Error Type Filter */}
          <div className="flex flex-col gap-4 w-full lg:w-2/3">
            <FilterBuilder
              conditions={conditions}
              onAddCondition={addCondition}
              onUpdateCondition={updateCondition}
              onRemoveCondition={removeCondition}
            />
            
            <div className="relative w-full sm:w-64">
              <select
                value={errorTypeFilter}
                onChange={(e) => setErrorTypeFilter(e.target.value)}
                className="appearance-none w-full pl-3 pr-8 py-2.5 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-300 focus:outline-none focus:border-brand-500/50 cursor-pointer shadow-sm"
              >
                <option value="ALL">All Error Types</option>
                <option value="NOINDEX_ON_TARGET">Indexability (Noindex)</option>
                <option value="TARGET_404_OR_500">Target Error (404/500)</option>
                <option value="CANONICAL_MISMATCH">Canonical Mismatch</option>
                <option value="WORD_COUNT_COLLAPSE">Word Count Collapse</option>
                <option value="TITLE_DISCREPANCY">Missing/Short Title</option>
                <option value="H1_MISSING">Missing H1 Heading</option>
                <option value="META_DESCRIPTION_DROPPED">Missing Meta Description</option>
                <option value="SOFT_404_HOMEPAGE_TRAP">Soft 404 / Homepage Trap</option>
              </select>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" opacity={0} /> {/* Invisible for spacing */}
            </div>
          </div>

          {/* Right Column: Severity Quick Filters */}
          <div className="flex flex-wrap items-start justify-start lg:justify-end gap-1.5 w-full lg:w-1/3 pt-2 lg:pt-0">
            <button
              onClick={() => setSeverityFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                severityFilter === 'ALL'
                  ? 'bg-slate-800 dark:bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              All ({allDiscrepancies.length})
            </button>
            <button
              onClick={() => setSeverityFilter('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                severityFilter === 'CRITICAL'
                  ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30 font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
              <span>Critical ({criticalCount})</span>
            </button>
            <button
              onClick={() => setSeverityFilter('HIGH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                severityFilter === 'HIGH'
                  ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span>High ({highCount})</span>
            </button>
            <button
              onClick={() => setSeverityFilter('WARNING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                severityFilter === 'WARNING'
                  ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Warnings ({warningCount})
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedItemIds.size > 0 && (
        <div className="bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between text-brand-600 dark:text-brand-300 animate-in fade-in slide-in-from-top-2 shadow-sm gap-3">
          <div className="text-sm font-semibold pl-2">
            {selectedItemIds.size} discrepancy{selectedItemIds.size !== 1 ? 'ies' : ''} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onBulkUpdateMappings && (
              <>
                <button
                  onClick={handleBulkApprove}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Bulk Approve</span>
                </button>
                <button
                  onClick={handleBulk410}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Ban className="h-4 w-4" />
                  <span>Bulk 410</span>
                </button>
              </>
            )}
            <button
              onClick={handleExportSelected}
              className="px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-500/20 hover:bg-brand-200 dark:hover:bg-brand-500/30 text-brand-600 dark:text-brand-300 text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Discrepancies List */}
      <div className="space-y-4">
        {paginatedDiscrepancies.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3 shadow-sm">
            <ShieldCheck className="h-10 w-10 text-brand-500 dark:text-brand-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Discrepancies in Active Filter</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">All evaluated URL pairs meet the selected SEO parity criteria.</p>
          </div>
        ) : (
          Object.values(
            paginatedDiscrepancies.reduce((acc, item) => {
              if (!acc[item.type]) {
                acc[item.type] = {
                  type: item.type,
                  title: item.title,
                  description: item.description,
                  severity: item.severity,
                  items: []
                };
              }
              acc[item.type].items.push(item);
              return acc;
            }, {} as Record<string, { type: string, title: string, description: string, severity: string, items: typeof paginatedDiscrepancies }>)
          ).map((group) => {
            const isCritical = group.severity === 'CRITICAL';
            const isHigh = group.severity === 'HIGH';

            return (
              <div 
                key={group.type}
                className={`overflow-hidden rounded-2xl border transition-all shadow-sm ${
                  isCritical 
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-500/30' 
                    : isHigh 
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Group Header */}
                <div className={`p-5 border-b ${
                  isCritical ? 'border-red-200 dark:border-red-500/30 bg-red-100/50 dark:bg-red-950/40' : isHigh ? 'border-amber-200 dark:border-amber-500/30 bg-amber-100/50 dark:bg-amber-950/40' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2.5">
                      {isCritical ? (
                        <AlertOctagon className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0" />
                      ) : isHigh ? (
                        <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0" />
                      ) : (
                        <Info className="h-5 w-5 text-teal-500 dark:text-teal-400 shrink-0" />
                      )}
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{group.title}</h3>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-950/50 px-2 py-0.5 rounded-md">
                        {group.items.length} affected
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono uppercase font-bold px-2.5 py-0.5 rounded-full ${
                      isCritical 
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30' 
                        : isHigh
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
                    }`}>
                      {group.severity} SEVERITY
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 pl-8">{group.description}</p>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800/50">
                        <th className="py-3 px-4 font-semibold w-10 text-center">
                          <input 
                            type="checkbox" 
                            checked={group.items.length > 0 && group.items.every(i => selectedItemIds.has(i.id))}
                            onChange={() => handleToggleSelectAll(group.items)}
                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-brand-500 focus:ring-brand-500/50 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-4 font-semibold">Source URL (Old)</th>
                        <th className="py-3 px-4 font-semibold">Source Value</th>
                        <th className="py-3 px-4 font-semibold">Target URL (New)</th>
                        <th className="py-3 px-4 font-semibold">Target Value</th>
                        <th className="py-3 px-4 text-center font-semibold">Links</th>
                        {onToggleDiscrepancyResolution && <th className="py-3 px-4 text-center font-semibold">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30">
                      {group.items.map((item) => (
                        <React.Fragment key={item.id}>
                        <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors ${item.isResolved ? 'opacity-50 bg-slate-50 dark:bg-slate-900/30' : ''}`}>
                          <td className="py-3 px-4 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedItemIds.has(item.id)}
                              onChange={() => handleToggleItem(item.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-brand-500 focus:ring-brand-500/50 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="text-slate-800 dark:text-slate-200 font-mono text-[10px] truncate max-w-[200px] xl:max-w-[300px]">
                                {item.sourcePath}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-mono font-bold truncate max-w-[150px] inline-block ${isCritical ? 'text-red-600 dark:text-red-300/80' : isHigh ? 'text-amber-600 dark:text-amber-300/80' : 'text-slate-800 dark:text-slate-300/80'}`}>
                              {String(item.sourceValue)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="text-slate-800 dark:text-slate-200 font-mono text-[10px] truncate max-w-[200px] xl:max-w-[300px]">
                                {item.targetPath}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-mono font-bold truncate max-w-[150px] inline-block ${isCritical ? 'text-red-600 dark:text-red-300/80' : isHigh ? 'text-amber-600 dark:text-amber-300/80' : 'text-slate-800 dark:text-slate-300/80'}`}>
                              {String(item.targetValue)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <a 
                                href={item.sourceUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                                title="Open Source URL"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span className="sr-only">Source</span>
                              </a>
                              {item.targetUrl && (
                                <a 
                                  href={item.targetUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 hover:bg-brand-100 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors"
                                  title="Open Target URL"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="sr-only">Target</span>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col gap-1 items-center">
                              {onToggleDiscrepancyResolution && (
                                <button
                                  onClick={() => onToggleDiscrepancyResolution(item.id)}
                                  className={`flex items-center justify-center gap-1 mx-auto px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${item.isResolved ? 'bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20'}`}
                                  title={item.isResolved ? "Unresolve" : "Mark as Resolved"}
                                >
                                  {item.isResolved ? <XCircle size={12} /> : <CheckCircle size={12} />}
                                  {item.isResolved ? 'Undo' : 'Resolve'}
                                </button>
                              )}
                              
                              {onUpdateMapping && (
                                <div className="flex items-center gap-1 mt-1">
                                  <button
                                    onClick={() => onUpdateMapping(item.mappingId, { status: 'APPROVED' })}
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                                    title="Approve Mapping"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => onUpdateMapping(item.mappingId, { status: 'GONE_410' })}
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                    title="Mark as 410 Gone"
                                  >
                                    <Ban className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (editingNoteId === item.mappingId) {
                                        setEditingNoteId(null);
                                      } else {
                                        setEditingNoteId(item.mappingId);
                                        const mapping = mappings.find(m => m.id === item.mappingId);
                                        setNoteInput(mapping?.notes || '');
                                      }
                                    }}
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-500 transition-colors"
                                    title="Add Note"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {editingNoteId === item.mappingId && (
                          <tr className="bg-slate-50 dark:bg-slate-900/30">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={noteInput}
                                  onChange={(e) => setNoteInput(e.target.value)}
                                  placeholder="Add a note to this mapping..."
                                  className="flex-1 px-3 py-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && onUpdateMapping) {
                                      onUpdateMapping(item.mappingId, { notes: noteInput });
                                      setEditingNoteId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingNoteId(null);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    if (onUpdateMapping) {
                                      onUpdateMapping(item.mappingId, { notes: noteInput });
                                      setEditingNoteId(null);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600"
                                >
                                  Save Note
                                </button>
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-300 dark:hover:bg-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredDiscrepancies.length)}</span> of <span className="font-bold text-slate-900 dark:text-white">{filteredDiscrepancies.length}</span> issues
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm dark:shadow-none"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 px-2">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm dark:shadow-none"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
