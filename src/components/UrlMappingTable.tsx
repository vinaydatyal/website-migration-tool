import React, { useState, useMemo, useCallback, useEffect, useDeferredValue } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  FileWarning,
  Copy,
  Eye,
  EyeOff
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
  onBulkUpdateMappings?: (updatesList: { id: string, updates: Partial<UrlMapping> }[]) => void;
  onFilteredMappingsChange?: (mappings: UrlMapping[]) => void;
  confidenceThreshold: number;
  onUpdateThreshold: (threshold: number) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  sourceEntries?: CrawlEntry[] | null;
}

export const UrlMappingTable: React.FC<UrlMappingTableProps> = ({
  mappings,
  targetEntries,
  onUpdateMapping,
  onBulkUpdateMappings,
  onFilteredMappingsChange,
  confidenceThreshold,
  onUpdateThreshold,
  onUndo,
  canUndo,
  sourceEntries,
}) => {

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'NEEDS_REVIEW' | 'UNMAPPED' | 'HIGH_RISK' | 'GONE_410' | 'CONFLICTS' | 'HIDDEN'>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<string>('ALL');
  const [canonicalFilter, setCanonicalFilter] = useState<'ALL' | 'CANONICAL_ONLY'>('ALL');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: crypto.randomUUID(), operator: 'CONTAINS', value: '' }
  ]);
  const deferredConditions = useDeferredValue(conditions);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [duplicateModalTarget, setDuplicateModalTarget] = useState<string | null>(null);
  const [selectedMappingIds, setSelectedMappingIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: 'source' | 'target' | 'traffic' | 'confidence', direction: 'NONE' | 'ASC' | 'DESC' }>({ key: 'source', direction: 'NONE' });
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  const [isPending, startTransition] = React.useTransition();

  // Defer search to prevent typing lag
  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addCondition = () => {
    setConditions(prev => [...prev, { id: crypto.randomUUID(), operator: 'CONTAINS' as const, value: '' }]);
  };

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

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

  const statusCounts = useMemo(() => {
    const counts = { all: 0, approved: 0, needsReview: 0, unmapped: 0, highRisk: 0, gone410: 0, conflicts: 0, hidden: 0 };
    for (const m of mappings) {
      if (m.isHidden) {
        counts.hidden++;
        continue;
      }
      counts.all++;
      if (m.status === 'APPROVED' || m.status === 'MANUAL') counts.approved++;
      if (m.status === 'NEEDS_REVIEW') counts.needsReview++;
      if (m.strategy === 'UNMAPPED') counts.unmapped++;
      if (m.riskScore >= 50) counts.highRisk++;
      if (m.status === 'GONE_410') counts.gone410++;
      if (m.targetUrl && m.status !== 'GONE_410' && m.strategy !== 'UNMAPPED') {
        const c = targetCounts.get(m.targetUrl.toLowerCase()) || 0;
        if (c > 1) counts.conflicts++;
      }
    }
    return counts;
  }, [mappings, targetCounts]);

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

      if (statusFilter !== 'HIDDEN' && m.isHidden) return false;
      if (statusFilter === 'HIDDEN' && !m.isHidden) return false;

      // Status filter
      if (statusFilter === 'APPROVED' && m.status !== 'APPROVED' && m.status !== 'MANUAL') return false;
      if (statusFilter === 'NEEDS_REVIEW' && m.status !== 'NEEDS_REVIEW') return false;
      if (statusFilter === 'UNMAPPED' && m.strategy !== 'UNMAPPED') return false;
      if (statusFilter === 'HIGH_RISK' && m.riskScore < 50) return false;
      if (statusFilter === 'GONE_410' && m.status !== 'GONE_410') return false;
      if (statusFilter === 'CONFLICTS') {
        if (!m.targetUrl || m.status === 'GONE_410' || m.strategy === 'UNMAPPED') return false;
        const count = targetCounts.get(m.targetUrl.toLowerCase()) || 0;
        if (count <= 1) return false;
      }

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

  // Reset page when filters, sort, or pagination size change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedMappingIds(new Set());
  }, [deferredConditions, statusFilter, strategyFilter, canonicalFilter, sortConfig, itemsPerPage]);

  useEffect(() => {
    if (onFilteredMappingsChange) {
      onFilteredMappingsChange(filteredMappings);
    }
  }, [filteredMappings, onFilteredMappingsChange]);

  const sortedMappings = useMemo(() => {
    if (sortConfig.direction === 'NONE') return filteredMappings;
    return [...filteredMappings].sort((a, b) => {
      let cmp = 0;
      if (sortConfig.key === 'source') {
        cmp = a.source.url.localeCompare(b.source.url);
      } else if (sortConfig.key === 'target') {
        const aTgt = a.targetUrl || '';
        const bTgt = b.targetUrl || '';
        cmp = aTgt.localeCompare(bTgt);
      } else if (sortConfig.key === 'traffic') {
        const visitsA = a.source.visits || 0;
        const visitsB = b.source.visits || 0;
        cmp = visitsA - visitsB;
      } else if (sortConfig.key === 'confidence') {
        cmp = a.confidenceScore - b.confidenceScore;
      }
      return sortConfig.direction === 'ASC' ? cmp : -cmp;
    });
  }, [filteredMappings, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedMappings.length / itemsPerPage));
  const paginatedMappings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedMappings.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedMappings, currentPage, itemsPerPage]);

  // Handle page change: reset selection
  useEffect(() => {
    setSelectedMappingIds(new Set());
  }, [currentPage]);

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

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedMappingIds(new Set(filteredMappings.map(m => m.id)));
  }, [filteredMappings]);

  const allPageItemsSelected = paginatedMappings.length > 0 && paginatedMappings.every(m => selectedMappingIds.has(m.id));

  const handleSelectAll = useCallback(() => {
    if (allPageItemsSelected) {
      setSelectedMappingIds(new Set());
    } else {
      const next = new Set(selectedMappingIds);
      paginatedMappings.forEach(m => next.add(m.id));
      setSelectedMappingIds(next);
    }
  }, [paginatedMappings, selectedMappingIds, allPageItemsSelected]);

  const handleBulkApprove = useCallback(() => {
    if (onBulkUpdateMappings) {
      const updates = Array.from(selectedMappingIds).map(id => ({
        id,
        updates: { status: 'APPROVED' as const }
      }));
      onBulkUpdateMappings(updates);
    } else {
      selectedMappingIds.forEach(id => {
        onUpdateMapping(id, { status: 'APPROVED' });
      });
    }
    setSelectedMappingIds(new Set());
  }, [selectedMappingIds, onUpdateMapping, onBulkUpdateMappings]);

  const handleBulk410 = useCallback(() => {
    if (onBulkUpdateMappings) {
      const updates = Array.from(selectedMappingIds).map(id => ({
        id,
        updates: { 
          status: 'GONE_410' as const, 
          statusCode: 410,
          targetUrl: '/410-gone',
          strategy: 'GONE_410' as const
        }
      }));
      onBulkUpdateMappings(updates);
    } else {
      selectedMappingIds.forEach(id => {
        onUpdateMapping(id, { 
          status: 'GONE_410', 
          statusCode: 410,
          targetUrl: '/410-gone',
          strategy: 'GONE_410'
        });
      });
    }
    setSelectedMappingIds(new Set());
  }, [selectedMappingIds, onUpdateMapping, onBulkUpdateMappings]);

  const handleBulk404 = useCallback(() => {
    if (onBulkUpdateMappings) {
      const updates = Array.from(selectedMappingIds).map(id => ({
        id,
        updates: { 
          status: 'MANUAL' as const, 
          statusCode: 404,
          targetUrl: '/404-not-found',
          strategy: 'MANUAL_OVERRIDE' as const
        }
      }));
      onBulkUpdateMappings(updates);
    } else {
      selectedMappingIds.forEach(id => {
        onUpdateMapping(id, { 
          status: 'MANUAL', 
          statusCode: 404,
          targetUrl: '/404-not-found',
          strategy: 'MANUAL_OVERRIDE'
        });
      });
    }
    setSelectedMappingIds(new Set());
  }, [selectedMappingIds, onUpdateMapping, onBulkUpdateMappings]);

  const handleSort = (key: 'source' | 'target' | 'traffic' | 'confidence') => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'NONE') return { key, direction: 'ASC' };
        if (prev.direction === 'ASC') return { key, direction: 'DESC' };
        return { key: 'source', direction: 'NONE' };
      }
      return { key, direction: 'ASC' };
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Horizontal Status Tabs */}
      <div className="flex overflow-x-auto pb-2 -mb-2 hide-scrollbar">
        <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 w-full px-1">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              statusFilter === 'ALL'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>All</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${statusFilter === 'ALL' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {statusCounts.all}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              statusFilter === 'APPROVED'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Approved</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${statusFilter === 'APPROVED' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {statusCounts.approved}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('NEEDS_REVIEW')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              statusFilter === 'NEEDS_REVIEW'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileWarning className="h-4 w-4" />
            <span>Needs Review</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${statusFilter === 'NEEDS_REVIEW' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {statusCounts.needsReview}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('UNMAPPED')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              statusFilter === 'UNMAPPED'
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <X className="h-4 w-4" />
            <span>Unmapped</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${statusFilter === 'UNMAPPED' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {statusCounts.unmapped}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('HIGH_RISK')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              statusFilter === 'HIGH_RISK'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>High Risk</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${statusFilter === 'HIGH_RISK' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {statusCounts.highRisk}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('GONE_410')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              statusFilter === 'GONE_410'
                ? 'border-slate-800 text-slate-800 dark:border-slate-300 dark:text-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Ban className="h-4 w-4" />
            <span>410 Gone</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${statusFilter === 'GONE_410' ? 'bg-slate-800 text-white dark:bg-slate-700 dark:text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {statusCounts.gone410}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('CONFLICTS')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              statusFilter === 'CONFLICTS'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Copy className="h-4 w-4" />
            <span>Conflicts</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${statusFilter === 'CONFLICTS' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {statusCounts.conflicts}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('HIDDEN')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              statusFilter === 'HIDDEN'
                ? 'border-slate-500 text-slate-700 dark:text-slate-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <EyeOff className="h-4 w-4" />
            <span>Hidden</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${statusFilter === 'HIDDEN' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {statusCounts.hidden}
            </span>
          </button>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col gap-4 w-full">
          <div className="flex justify-between items-center w-full">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Filtering & Controls</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Filter className="h-4 w-4" />
                <span>Advanced Filters</span>
              </button>
              {canUndo && (
                <button
                  onClick={onUndo}
                  className="px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
                >
                  Undo Last Action
                </button>
              )}
            </div>
          </div>
          
          {isAdvancedFiltersOpen && (
            <div className="flex flex-col gap-4 w-full pt-4 border-t border-slate-200 dark:border-slate-800">
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
          )}
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
            {allPageItemsSelected && selectedMappingIds.size < filteredMappings.length && (
              <span className="ml-3 border-l border-brand-200 dark:border-brand-500/50 pl-3">
                <button 
                  onClick={handleSelectAllFiltered}
                  className="hover:text-brand-800 dark:hover:text-brand-100 underline decoration-brand-500/50 font-bold transition-colors"
                >
                  Select all {filteredMappings.length} mappings in filter
                </button>
              </span>
            )}
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
            <button
              onClick={() => {
                if (onBulkUpdateMappings) {
                  onBulkUpdateMappings(Array.from(selectedMappingIds).map(id => ({ id, updates: { isHidden: true } })));
                } else {
                  selectedMappingIds.forEach(id => onUpdateMapping(id, { isHidden: true }));
                }
                setSelectedMappingIds(new Set());
              }}
              className="px-4 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <EyeOff className="h-4 w-4" />
              <span>Hide Selected</span>
            </button>
            <button
              onClick={() => {
                if (onBulkUpdateMappings) {
                  onBulkUpdateMappings(Array.from(selectedMappingIds).map(id => ({ id, updates: { isHidden: false } })));
                } else {
                  selectedMappingIds.forEach(id => onUpdateMapping(id, { isHidden: false }));
                }
                setSelectedMappingIds(new Set());
              }}
              className="px-4 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Eye className="h-4 w-4" />
              <span>Unhide Selected</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl dark:shadow-2xl flex flex-col flex-1 min-h-0">
        <div className="overflow-auto flex-1 w-full relative">
          <div className="w-full text-left text-xs md:min-w-[800px] block">
            <div className="bg-slate-50 dark:bg-slate-950/90 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 hidden md:flex">
              <div className="py-3.5 pl-4 pr-2 shrink-0 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={allPageItemsSelected}
                  onChange={handleSelectAll}
                  className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-brand-500 focus:ring-brand-500/50 focus:ring-offset-0 cursor-pointer"
                />
              </div>
              <div className="py-3.5 px-3 w-[35%] shrink-0 flex items-center justify-between group cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleSort('source')}>
                <span>Source URL (Old Site)</span>
                {sortConfig.key !== 'source' || sortConfig.direction === 'NONE' ? <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" /> : sortConfig.direction === 'ASC' ? <ArrowUp className="h-3.5 w-3.5 text-brand-500" /> : <ArrowDown className="h-3.5 w-3.5 text-brand-500" />}
              </div>
              <div className="py-3.5 px-4 w-[35%] shrink-0 flex items-center justify-between group cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleSort('target')}>
                <span>301 Target URL (New Site)</span>
                {sortConfig.key !== 'target' || sortConfig.direction === 'NONE' ? <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" /> : sortConfig.direction === 'ASC' ? <ArrowUp className="h-3.5 w-3.5 text-brand-500" /> : <ArrowDown className="h-3.5 w-3.5 text-brand-500" />}
              </div>
              <div className="py-3.5 px-4 w-32 shrink-0 text-left flex items-center justify-between group cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleSort('traffic')}>
                <span>Traffic</span>
                {sortConfig.key !== 'traffic' || sortConfig.direction === 'NONE' ? <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" /> : sortConfig.direction === 'ASC' ? <ArrowUp className="h-3.5 w-3.5 text-brand-500" /> : <ArrowDown className="h-3.5 w-3.5 text-brand-500" />}
              </div>
              <div className="py-3.5 px-4 text-center w-24 shrink-0 flex items-center justify-between group cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleSort('confidence')}>
                <span>Confidence</span>
                {sortConfig.key !== 'confidence' || sortConfig.direction === 'NONE' ? <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" /> : sortConfig.direction === 'ASC' ? <ArrowUp className="h-3.5 w-3.5 text-brand-500" /> : <ArrowDown className="h-3.5 w-3.5 text-brand-500" />}
              </div>
              <div className="py-3.5 px-4 text-right w-36 shrink-0">Actions</div>
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
                      targetCount={targetCounts.get((m.targetUrl || '').toLowerCase()) || 0}
                      isSelected={selectedMappingIds.has(m.id)}
                      onToggleSelect={handleToggleSelect}
                      onToggleHide={(id, isHidden) => onUpdateMapping(id, { isHidden })}
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
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Rows per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-md px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-sm"
                >
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
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
