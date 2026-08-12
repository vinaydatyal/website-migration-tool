import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Sliders, 
  Check, 
  X, 
  Ban, 
  ExternalLink,
  ShieldAlert,
  ChevronDown,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { UrlMapping, CrawlEntry } from '../types/migration';
import { exportRedirects } from '../utils/exporters';
import { UrlMappingTableRow } from './UrlMappingTableRow';
import { DuplicateMappingsModal } from './DuplicateMappingsModal';
import { ExportModal } from './ExportModal';
import { FilterBuilder, FilterCondition } from './FilterBuilder';

interface UrlMappingTableProps {
  mappings: UrlMapping[];
  targetEntries: CrawlEntry[];
  onUpdateMapping: (mappingId: string, updates: Partial<UrlMapping>) => void;
  confidenceThreshold: number;
  onUpdateThreshold: (threshold: number) => void;
}

export const UrlMappingTable: React.FC<UrlMappingTableProps> = ({
  mappings,
  targetEntries,
  onUpdateMapping,
  confidenceThreshold,
  onUpdateThreshold,
}) => {

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'NEEDS_REVIEW' | 'UNMAPPED' | 'HIGH_RISK' | 'GONE_410'>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<string>('ALL');
  const [canonicalFilter, setCanonicalFilter] = useState<'ALL' | 'CANONICAL_ONLY'>('ALL');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: crypto.randomUUID(), operator: 'CONTAINS', value: '' }
  ]);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [duplicateModalTarget, setDuplicateModalTarget] = useState<string | null>(null);
  const [selectedMappingIds, setSelectedMappingIds] = useState<Set<string>>(new Set());
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  const [isPending, startTransition] = React.useTransition();
  const [deferredConditions, setDeferredConditions] = useState<FilterCondition[]>(conditions);

  // Defer search to prevent typing lag
  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    const newConditions = conditions.map(c => c.id === id ? { ...c, ...updates } : c);
    setConditions(newConditions);
    startTransition(() => {
      setDeferredConditions(newConditions);
    });
  };

  const addCondition = () => {
    const newConditions = [...conditions, { id: crypto.randomUUID(), operator: 'CONTAINS' as const, value: '' }];
    setConditions(newConditions);
    startTransition(() => {
      setDeferredConditions(newConditions);
    });
  };

  const removeCondition = (id: string) => {
    const newConditions = conditions.filter(c => c.id !== id);
    setConditions(newConditions);
    startTransition(() => {
      setDeferredConditions(newConditions);
    });
  };

  // Filtered list of mappings
  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
      // Check all search conditions (AND logic)
      const srcUrl = m.source.url.toLowerCase();
      const srcTitle = m.source.title?.toLowerCase() || '';
      const tgtUrl = m.targetUrl.toLowerCase();
      const tgtTitle = m.target?.title?.toLowerCase() || '';

      const passesConditions = deferredConditions.every(cond => {
        if (!cond.value.trim()) return true; // Skip empty conditions
        const q = cond.value.toLowerCase();

        if (cond.operator === 'NOT_CONTAINS') {
          const hasIt = srcUrl.includes(q) || srcTitle.includes(q) || tgtUrl.includes(q) || tgtTitle.includes(q);
          return !hasIt;
        }

        let srcMatch = false;
        let tgtMatch = false;

        switch (cond.operator) {
          case 'EQUALS':
            srcMatch = srcUrl === q || srcTitle === q;
            tgtMatch = tgtUrl === q || tgtTitle === q;
            break;
          case 'STARTS_WITH':
            srcMatch = srcUrl.startsWith(q) || srcTitle.startsWith(q);
            tgtMatch = tgtUrl.startsWith(q) || tgtTitle.startsWith(q);
            break;
          case 'ENDS_WITH':
            srcMatch = srcUrl.endsWith(q) || srcTitle.endsWith(q);
            tgtMatch = tgtUrl.endsWith(q) || tgtTitle.endsWith(q);
            break;
          case 'CONTAINS':
          default:
            srcMatch = srcUrl.includes(q) || srcTitle.includes(q);
            tgtMatch = tgtUrl.includes(q) || tgtTitle.includes(q);
            break;
        }

        return srcMatch || tgtMatch;
      });

      if (!passesConditions) return false;

      // Status filter
      if (statusFilter === 'APPROVED' && m.status !== 'APPROVED' && m.status !== 'MANUAL') return false;
      if (statusFilter === 'NEEDS_REVIEW' && m.status !== 'NEEDS_REVIEW') return false;
      if (statusFilter === 'UNMAPPED' && m.strategy !== 'UNMAPPED') return false;
      if (statusFilter === 'HIGH_RISK' && m.riskScore < 50) return false;
      if (statusFilter === 'GONE_410' && m.status !== 'GONE_410') return false;

      // Strategy filter
      if (strategyFilter !== 'ALL' && m.strategy !== strategyFilter) return false;

      // Canonical filter
      if (canonicalFilter === 'CANONICAL_ONLY') {
        const isNonCanonical = m.source.canonical && m.source.canonical.toLowerCase().trim() !== m.source.url.toLowerCase().trim();
        if (isNonCanonical) return false;
      }

      return true;
    });
  }, [mappings, deferredConditions, statusFilter, strategyFilter, canonicalFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedMappingIds(new Set());
  }, [deferredConditions, statusFilter, strategyFilter, canonicalFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMappings.length / itemsPerPage));
  const paginatedMappings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredMappings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMappings, currentPage]);

  // Handle page change: reset selection
  useEffect(() => {
    setSelectedMappingIds(new Set());
  }, [currentPage]);

  const targetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of mappings) {
      if (m.targetUrl && m.status !== 'GONE_410' && m.strategy !== 'UNMAPPED') {
        const url = m.targetUrl.toLowerCase();
        counts.set(url, (counts.get(url) || 0) + 1);
      }
    }
    return counts;
  }, [mappings]);

  const handleApprove = useCallback((id: string) => {
    onUpdateMapping(id, { status: 'APPROVED' });
  }, [onUpdateMapping]);

  const handleSet410 = useCallback((id: string) => {
    onUpdateMapping(id, { 
      status: 'GONE_410', 
      statusCode: 410,
      targetUrl: '/410-gone',
      strategy: 'GONE_410'
    });
  }, [onUpdateMapping]);

  const handleSaveCustomTarget = useCallback((id: string, newTarget: string) => {
    if (!newTarget.trim()) return;
    
    // Check if input matches an existing target entry
    const matchedTarget = targetEntries.find(t => 
      t.url.toLowerCase() === newTarget.trim().toLowerCase() ||
      t.normalizedPath.toLowerCase() === newTarget.trim().toLowerCase()
    );

    onUpdateMapping(id, {
      targetUrl: newTarget.trim(),
      target: matchedTarget || null,
      status: 'MANUAL',
      strategy: 'MANUAL_OVERRIDE',
      confidenceScore: 100
    });
    
    setEditingMappingId(null);
  }, [targetEntries, onUpdateMapping]);

  const handleSelectTargetFromDropdown = useCallback((id: string, targetId: string) => {
    const target = targetEntries.find(t => t.id === targetId);
    if (!target) return;
    
    onUpdateMapping(id, {
      targetUrl: target.url,
      target: target,
      status: 'MANUAL',
      strategy: 'MANUAL_OVERRIDE',
      confidenceScore: 100
    });
    
    setEditingMappingId(null);
  }, [targetEntries, onUpdateMapping]);

  const handleCancelEdit = useCallback(() => {
    setEditingMappingId(null);
  }, []);

  const handleStartEdit = useCallback((id: string) => {
    setEditingMappingId(id);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedMappingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedMappingIds.size === paginatedMappings.length && paginatedMappings.length > 0) {
      setSelectedMappingIds(new Set());
    } else {
      setSelectedMappingIds(new Set(paginatedMappings.map(m => m.id)));
    }
  }, [paginatedMappings, selectedMappingIds]);

  const handleBulkApprove = useCallback(() => {
    selectedMappingIds.forEach(id => {
      onUpdateMapping(id, { status: 'APPROVED' });
    });
    setSelectedMappingIds(new Set());
  }, [selectedMappingIds, onUpdateMapping]);

  const handleBulk410 = useCallback(() => {
    selectedMappingIds.forEach(id => {
      onUpdateMapping(id, { 
        status: 'GONE_410', 
        statusCode: 410,
        targetUrl: '/410-gone',
        strategy: 'GONE_410'
      });
    });
    setSelectedMappingIds(new Set());
  }, [selectedMappingIds, onUpdateMapping]);

  const handleBulk404 = useCallback(() => {
    selectedMappingIds.forEach(id => {
      onUpdateMapping(id, { 
        status: 'MANUAL', 
        statusCode: 404,
        targetUrl: '/404-not-found',
        strategy: 'MANUAL_OVERRIDE'
      });
    });
    setSelectedMappingIds(new Set());
  }, [selectedMappingIds, onUpdateMapping]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls & Filter Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
          
          {/* Left Column: Search & Filters */}
          <div className="flex flex-col gap-4 w-full lg:w-2/3">
            {/* Advanced Multi-Condition Search Builder */}
            <FilterBuilder
              conditions={conditions}
              onAddCondition={addCondition}
              onUpdateCondition={updateCondition}
              onRemoveCondition={removeCondition}
            />

            {/* Dropdown Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-1/2">
                <select
                  value={strategyFilter}
                  onChange={(e) => setStrategyFilter(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2.5 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-300 focus:outline-none focus:border-brand-500/50 cursor-pointer shadow-sm"
                >
                  <option value="ALL">All Strategies</option>
                  <option value="EXACT_PATH">Exact Path</option>
                  <option value="EXACT_TITLE_H1">Exact Title/H1</option>
                  <option value="HIGH_FUZZY">High Fuzzy Match</option>
                  <option value="MEDIUM_FUZZY">Medium Fuzzy Match</option>
                  <option value="MANUAL_OVERRIDE">Manual Override</option>
                  <option value="UNMAPPED">Unmapped</option>
                  <option value="GONE_410">410 Gone</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative w-full sm:w-1/2">
                <select
                  value={canonicalFilter}
                  onChange={(e) => setCanonicalFilter(e.target.value as any)}
                  className="appearance-none w-full pl-3 pr-8 py-2.5 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-300 focus:outline-none focus:border-brand-500/50 cursor-pointer shadow-sm"
                >
                  <option value="ALL">All Pages (Inc. Parameters)</option>
                  <option value="CANONICAL_ONLY">Canonical Pages Only</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Right Column: Status Quick Filters */}
          <div className="flex flex-wrap items-start justify-start lg:justify-end gap-1.5 w-full lg:w-1/3 pt-2 lg:pt-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 dark:bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              All ({mappings.length})
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'APPROVED'
                  ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter('NEEDS_REVIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'NEEDS_REVIEW'
                  ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Needs Review
            </button>
            <button
              onClick={() => setStatusFilter('UNMAPPED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'UNMAPPED'
                  ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Unmapped
            </button>
            <button
              onClick={() => setStatusFilter('HIGH_RISK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'HIGH_RISK'
                  ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              High Risk
            </button>
            <button
              onClick={() => setStatusFilter('GONE_410')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'GONE_410'
                  ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              410 Gone
            </button>
          </div>
        </div>

        {/* Sensitivity Slider */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <Sliders className="h-4 w-4 text-brand-500 dark:text-brand-400" />
            <span className="text-slate-700 dark:text-slate-300 font-semibold">Auto-Match Threshold:</span>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={confidenceThreshold}
              onChange={(e) => onUpdateThreshold(parseInt(e.target.value, 10))}
              className="w-32 accent-brand-500 cursor-pointer"
            />
            <span className="font-mono font-bold text-brand-400">{confidenceThreshold}%</span>
          </div>

          <div className="text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-slate-900 dark:text-white font-mono">{filteredMappings.length}</span> of{' '}
            <span className="font-mono">{mappings.length}</span> mappings
          </div>
        </div>
      </div>

      {/* Bulk Actions Banner */}
      {selectedMappingIds.size > 0 && (
        <div className="bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 rounded-xl p-3 flex items-center justify-between text-brand-600 dark:text-brand-300 animate-in fade-in slide-in-from-top-2">
          <div className="text-sm font-semibold pl-2">
            {selectedMappingIds.size} mapping{selectedMappingIds.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBulkApprove}
              className="px-4 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-500/20 hover:bg-brand-200 dark:hover:bg-brand-500/30 text-brand-600 dark:text-brand-300 text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Approve Selected</span>
            </button>
            <button
              onClick={handleBulk404}
              className="px-4 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-500/20 text-slate-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-300 border border-slate-200 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-500/30 text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Mark as 404</span>
            </button>
            <button
              onClick={handleBulk410}
              className="px-4 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-300 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-500/30 text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Ban className="h-4 w-4" />
              <span>Mark as 410</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl dark:shadow-2xl flex flex-col flex-1 min-h-0">
        <div className="overflow-auto flex-1 w-full relative">
          <div className="w-full text-left text-xs min-w-[800px] block">
            <div className="bg-slate-50 dark:bg-slate-950/90 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 flex">
              <div className="py-3.5 pl-4 pr-2 shrink-0 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={paginatedMappings.length > 0 && selectedMappingIds.size === paginatedMappings.length}
                  onChange={handleSelectAll}
                  className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-brand-500 focus:ring-brand-500/50 focus:ring-offset-0 cursor-pointer"
                />
              </div>
              <div className="py-3.5 px-3 w-[35%] shrink-0">Source URL (Old Site)</div>
              <div className="py-3.5 px-4 w-[35%] shrink-0">301 Target URL (New Site)</div>
              <div className="py-3.5 px-4 w-32 shrink-0 text-left">Traffic</div>
              <div className="py-3.5 px-4 text-center w-24 shrink-0">Confidence</div>
              <div className="py-3.5 px-4 text-right w-28 shrink-0">Actions</div>
            </div>

            <div className="w-full relative">
              {paginatedMappings.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-500 py-24">
                  <Ban className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No mappings found matching your filters.</p>
                </div>
              ) : (
                paginatedMappings.map((m) => {
                  const isEditing = editingMappingId === m.id;

                  return (
                    <UrlMappingTableRow
                      key={m.id}
                      m={m}
                      isEditing={isEditing}
                      targetEntries={targetEntries}
                      targetCount={targetCounts.get(m.targetUrl.toLowerCase()) || 0}
                      isSelected={selectedMappingIds.has(m.id)}
                      onToggleSelect={handleToggleSelect}
                      onApprove={handleApprove}
                      onSet410={handleSet410}
                      onSaveCustomTarget={handleSaveCustomTarget}
                      onCancelEdit={handleCancelEdit}
                      onSelectTarget={handleSelectTargetFromDropdown}
                      onStartEdit={handleStartEdit}
                      onShowDuplicates={() => setDuplicateModalTarget(m.targetUrl)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        {/* Pagination Footer */}
        {filteredMappings.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-between shrink-0">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredMappings.length)}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{filteredMappings.length}</span> results
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm dark:shadow-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="text-sm font-mono text-slate-700 dark:text-slate-300 px-2">
                Page {currentPage} of {totalPages}
              </div>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm dark:shadow-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {duplicateModalTarget && (
        <DuplicateMappingsModal
          targetUrl={duplicateModalTarget}
          mappings={mappings}
          targetEntries={targetEntries}
          onClose={() => setDuplicateModalTarget(null)}
          onUpdateMapping={onUpdateMapping}
        />
      )}
    </div>
  );
};
