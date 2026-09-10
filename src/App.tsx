import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Toaster, toast } from 'sonner';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { UploadZone } from './components/UploadZone';
import { DashboardOverview } from './components/DashboardOverview';
import { UrlMappingTable } from './components/UrlMappingTable';
import { SeoParityView } from './components/SeoParityView';
import { RegexSynthesizerView } from './components/RegexSynthesizerView';
import { ValidationView } from './components/ValidationView';
import { LinkAuditorView } from './components/LinkAuditorView';
import { CrawlDataView } from './components/CrawlDataView';
import { MigrationChecklist } from './components/MigrationChecklist';
import { ArchitectureView } from './components/ArchitectureView';
import { InfrastructureAuditorView } from './components/InfrastructureAuditorView';
import { ExportModal } from './components/ExportModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { HistorySidebar } from './components/HistorySidebar';
import { DataSourcesModal } from './components/DataSourcesModal';
import { DeltaReportModal, DeltaReport } from './components/DeltaReportModal';
import { DomainSwapModal } from './components/DomainSwapModal';
import { ImportMapModal } from './components/ImportMapModal';
import { RestartPipelineModal } from './components/RestartPipelineModal';
import { KnowledgeBaseSidebar } from './components/KnowledgeBaseSidebar';
import { 
  CrawlEntry, 
  UrlMapping, 
  SynthesizedPattern, 
  MigrationSnapshot,
  MigrationProfile,
  ProjectMetadata,
  MigrationSummaryStats
} from './types/migration';
import { matchSourceAndTargetEntriesAsync } from './utils/matcher';
import { calculateMigrationStats, evaluateParityDiscrepancies } from './utils/parityAuditor';
import { synthesizeRegexPatterns } from './utils/exporters';
import { slugify } from './utils/text';
import { 
  saveProjectToIndexedDB, 
  getAllProjectsFromIndexedDB, 
  deleteProjectFromIndexedDB,
  saveSnapshot,
  getSnapshots,
  deleteSnapshot
} from './utils/storage';
import { SAMPLE_ECOMMERCE_OLD_SITE, SAMPLE_ECOMMERCE_NEW_SITE } from './data/sampleData';

export function App() {
  const [sourceEntries, setSourceEntries] = useState<CrawlEntry[] | null>(null);
  const [targetEntries, setTargetEntries] = useState<CrawlEntry[] | null>(null);
  const [mappings, setMappings] = useState<UrlMapping[]>([]);
  const [activeFilteredMappings, setActiveFilteredMappings] = useState<UrlMapping[]>([]);
  const [mappingsHistory, setMappingsHistory] = useState<UrlMapping[][]>([]);
  const [redoStack, setRedoStack] = useState<UrlMapping[][]>([]);
  const [patterns, setPatterns] = useState<SynthesizedPattern[]>([]);
  const [stats, setStats] = useState<MigrationSummaryStats | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportMapOpen, setIsImportMapOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpContext, setHelpContext] = useState<string | undefined>();
  const [snapshots, setSnapshots] = useState<MigrationSnapshot[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);

  // Incremental Updates State
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const [deltaReport, setDeltaReport] = useState<DeltaReport | null>(null);
  const [isDomainSwapOpen, setIsDomainSwapOpen] = useState(false);

  // Project Metadata State
  const [projectId, setProjectId] = useState<string>(() => crypto.randomUUID());
  const [projectName, setProjectName] = useState<string>('Untitled Project');
  const [projectProfile, setProjectProfile] = useState<MigrationProfile>('UNKNOWN');
  const [projectCreatedAt, setProjectCreatedAt] = useState<string>('');
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>({});
  const [isGscConnected, setIsGscConnected] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata>({});
  const [resolvedDiscrepancies, setResolvedDiscrepancies] = useState<Record<string, boolean>>({});

  const navigate = useNavigate();
  const location = useLocation();

  const loadProjectIntoState = (project: any, skipNavigate = false) => {
    setProjectId(project.id);
    setProjectName(project.name || 'Untitled Project');
    setProjectProfile(project.profile || 'UNKNOWN');
    setProjectCreatedAt(project.createdAt || new Date().toISOString());
    setSourceEntries(project.sourceEntries);
    setTargetEntries(project.targetEntries);
    setMappings(project.mappings);
    setPatterns(project.patterns);
    setStats(project.stats);
    setChecklistProgress(project.checklistProgress || {});
    setProjectMetadata(project.metadata || {});
    setResolvedDiscrepancies(project.resolvedDiscrepancies || {});
    setConfidenceThreshold(project.confidenceThreshold || 75);
    if (!skipNavigate) {
      navigate(`/${slugify(project.name || 'Untitled Project')}/dashboard`);
    }
  };

  // Restore most recent project from IndexedDB on mount
  useEffect(() => {
    async function restore() {
      const projects = await getAllProjectsFromIndexedDB();
      const parts = location.pathname.split('/');
      const urlSlug = parts[1];

      if (projects.length > 0 && urlSlug) {
        const found = projects.find(p => slugify(p.name || 'Untitled Project') === urlSlug);
        if (found) {
          loadProjectIntoState(found, true);
          toast.success(`Loaded project: ${found.name || 'Untitled Project'}`);
        }
      }
      
      if (projects.length === 0) {
        setProjectCreatedAt(new Date().toISOString());
      }
      setIsRestoring(false);
    }
    restore();
  }, []);

  useEffect(() => {
    if (!isRestoring && projectName) {
      const currentSlug = slugify(projectName);
      const parts = location.pathname.split('/');
      if (parts[1] && parts[1] !== currentSlug) {
        const view = parts[2] || 'dashboard';
        navigate(`/${currentSlug}/${view}`, { replace: true });
      }
    }
  }, [projectName, isRestoring, navigate, location.pathname]);

  // --- Snapshot Management ---
  const loadSnapshots = async () => {
    const snaps = await getSnapshots(projectId);
    setSnapshots(snaps);
  };

  const takeSnapshot = async (desc: string, currentMappings: UrlMapping[], currentStats: MigrationSummaryStats) => {
    const snap: MigrationSnapshot = {
      id: crypto.randomUUID(),
      projectId,
      description: desc,
      timestamp: new Date().toISOString(),
      stats: currentStats,
      mappings: currentMappings
    };
    await saveSnapshot(projectId, snap);
    await loadSnapshots();
  };

  const handleRestoreSnapshot = (snap: MigrationSnapshot) => {
    setMappings(snap.mappings);
    setStats(snap.stats);
    toast.success(`Restored to snapshot: ${snap.description}`);
  };

  const handleDeleteSnapshot = async (snapId: string) => {
    await deleteSnapshot(snapId);
    await loadSnapshots();
    toast.info('Snapshot deleted.');
  };

  const handleCreateManualSnapshot = () => {
    if (!stats || mappings.length === 0) return;
    takeSnapshot('Manual user snapshot', mappings, stats);
    toast.success('Snapshot created successfully!');
  };

  // Debounced auto-save to IndexedDB whenever critical state changes
  useEffect(() => {
    if (isRestoring) return;
    
    // Don't auto-save if absolutely nothing is loaded and it's untouched
    if (!sourceEntries && !targetEntries && projectName === 'Untitled Project' && !isGscConnected) {
      return;
    }

    const timer = setTimeout(() => {
      saveProjectToIndexedDB({
        id: projectId,
        name: projectName,
        profile: projectProfile,
        sourceFileName: '',
        targetFileName: '',
        sourceDomain: '',
        targetDomain: '',
        sourceEntries: sourceEntries || [],
        targetEntries: targetEntries || [],
        mappings,
        patterns,
        stats: stats || {
          totalSourceUrls: 0,
          totalTargetUrls: 0,
          autoMatchedCount: 0,
          exactPathCount: 0,
          exactTitleCount: 0,
          fuzzyMatchCount: 0,
          needsReviewCount: 0,
          unmappedCount: 0,
          highRiskCount: 0,
          criticalDiscrepanciesCount: 0,
          readinessScore: 0,
          totalInlinksPreserved: 0,
          totalInlinksAtRisk: 0
        },
        checklistProgress,
        metadata: projectMetadata,
        resolvedDiscrepancies,
        confidenceThreshold,
        createdAt: projectCreatedAt,
        updatedAt: new Date().toISOString()
      });
    }, 3000); // 3.0s debounce

    return () => clearTimeout(timer);
  }, [
    projectId, projectName, projectProfile, sourceEntries, targetEntries,
    mappings, patterns, stats, checklistProgress, projectMetadata,
    resolvedDiscrepancies, projectCreatedAt, isRestoring, isGscConnected
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoMapping();
        } else {
          handleUndoMapping();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoMapping();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mappingsHistory, redoStack, mappings, sourceEntries, targetEntries, projectProfile, resolvedDiscrepancies]);

  // Trigger full matching pipeline when entries or threshold changes
  const runPipeline = async (src: CrawlEntry[], tgt: CrawlEntry[], threshold = confidenceThreshold, profile = projectProfile, keepManualOverrides = false) => {
    setIsProcessing(true);
    setProcessProgress(0);

    try {
      let computedMappings = await matchSourceAndTargetEntriesAsync(src, tgt, threshold, profile, (prog) => {
        setProcessProgress(prog);
      });

      if (keepManualOverrides) {
        const oldMappingsMap = new Map(mappings.map(m => [m.source.url, m]));
        
        computedMappings = computedMappings.map(newM => {
          const oldM = oldMappingsMap.get(newM.source.url);
          if (oldM) {
            // Always preserve notes and hidden state
            newM.notes = oldM.notes;
            newM.isHidden = oldM.isHidden;
            
            // If the mapping was explicitly overridden, approved, rejected, or hidden (410), keep the entire old mapping
            if (oldM.status === 'MANUAL' || oldM.status === 'APPROVED' || oldM.status === 'REJECTED' || oldM.status === 'GONE_410' || oldM.strategy === 'MANUAL_OVERRIDE') {
              return oldM;
            }
          }
          return newM;
        });
      }

      const computedPatterns = synthesizeRegexPatterns(computedMappings);
      const computedStats = calculateMigrationStats(src, tgt, computedMappings, profile, resolvedDiscrepancies);
      
      setPatterns(prev => {
        const customPatterns = prev.filter(p => p.type === 'CUSTOM');
        return [...customPatterns, ...computedPatterns];
      });

      setSourceEntries(src);
      setTargetEntries(tgt);
      setMappings(computedMappings);
      setStats(computedStats);

      // Take a snapshot automatically
      takeSnapshot('Initial matching completed', computedMappings, computedStats);

      if (computedStats.readinessScore >= 80) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.85 }
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataParsed = async (
    src: CrawlEntry[], 
    tgt: CrawlEntry[], 
    srcName: string, 
    tgtName: string,
    profile: MigrationProfile,
    customProjectName?: string
  ) => {
    setProjectProfile(profile);
    const finalProjectName = customProjectName?.trim() ? customProjectName.trim() : projectName;
    if (customProjectName?.trim()) {
      setProjectName(customProjectName.trim());
    }
    await runPipeline(src, tgt, confidenceThreshold, profile);
    toast.success(`Successfully analyzed ${src.length} source URLs against ${tgt.length} target URLs.`);
    navigate(`/${slugify(finalProjectName)}/dashboard`);
  };

  const handleLoadSample = async () => {
    const newId = crypto.randomUUID();
    setProjectId(newId);
    setProjectName('Apex Athletics Demo');
    setProjectProfile('CMS_SWITCH');
    setProjectCreatedAt(new Date().toISOString());
    setResolvedDiscrepancies({});
    setChecklistProgress({});
    setProjectMetadata({});
    await runPipeline(SAMPLE_ECOMMERCE_OLD_SITE, SAMPLE_ECOMMERCE_NEW_SITE, confidenceThreshold, 'CMS_SWITCH');
    toast.success('Loaded Apex Athletics E-Commerce Demo Dataset!');
    navigate(`/${slugify('Apex Athletics')}/dashboard`);
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to start a new project? Any unsaved changes will be lost.')) return;
    
    setProjectId(crypto.randomUUID());
    setProjectName('Untitled Project');
    setProjectProfile('UNKNOWN');
    setSourceEntries(null);
    setTargetEntries(null);
    setMappings([]);
    setPatterns([]);
    setStats(null);
    setChecklistProgress({});
    setProjectMetadata({});
    setResolvedDiscrepancies({});
    navigate('/');
  };

  const pushToHistory = () => {
    setMappingsHistory(prev => {
      const next = [...prev, mappings];
      if (next.length > 20) next.shift(); // keep last 20 actions
      return next;
    });
    setRedoStack([]); // clear redo stack on new action
  };

  const handleUndoMapping = () => {
    if (mappingsHistory.length === 0) return;
    const previous = mappingsHistory[mappingsHistory.length - 1];
    setMappingsHistory(prev => prev.slice(0, prev.length - 1));
    setRedoStack(prev => [...prev, mappings]);
    
    setMappings(previous);
    if (sourceEntries && targetEntries) {
      setStats(calculateMigrationStats(sourceEntries, targetEntries, previous, projectProfile, resolvedDiscrepancies));
    }
    toast.success('Undo successful');
  };

  const handleRedoMapping = () => {
    if (redoStack.length === 0) return;
    const nextMapping = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, prev.length - 1));
    setMappingsHistory(prev => [...prev, mappings]);
    
    setMappings(nextMapping);
    if (sourceEntries && targetEntries) {
      setStats(calculateMigrationStats(sourceEntries, targetEntries, nextMapping, projectProfile, resolvedDiscrepancies));
    }
    toast.success('Redo successful');
  };

  const handleUpdateMapping = (mappingId: string, updates: Partial<UrlMapping>) => {
    pushToHistory();
    const updated = mappings.map(m => {
      if (m.id === mappingId) {
        return { ...m, ...updates };
      }
      return m;
    });
    setMappings(updated);

    if (sourceEntries && targetEntries) {
      setStats(calculateMigrationStats(sourceEntries, targetEntries, updated, projectProfile, resolvedDiscrepancies));
    }
    toast.success('Updated 301 URL mapping.');
  };

  const handleUpdateMetadata = (updates: Partial<ProjectMetadata>) => {
    setProjectMetadata(prev => ({ ...prev, ...updates }));
    toast.success('Project metadata saved.');
  };

  const handleBulkUpdateMappings = (updatesList: { id: string, updates: Partial<UrlMapping> }[]) => {
    pushToHistory();
    const updatesMap = new Map(updatesList.map(u => [u.id, u.updates]));
    
    const updated = mappings.map(m => {
      if (updatesMap.has(m.id)) {
        return { ...m, ...updatesMap.get(m.id) };
      }
      return m;
    });
    setMappings(updated);

    if (sourceEntries && targetEntries) {
      setStats(calculateMigrationStats(sourceEntries, targetEntries, updated, projectProfile, resolvedDiscrepancies));
    }
    toast.success(`Updated ${updatesList.length} URL mappings.`);
  };

  const handleTogglePattern = (id: string) => {
    setPatterns(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const handleAddCustomPattern = (pattern: SynthesizedPattern) => {
    setPatterns(prev => [pattern, ...prev]);
    toast.success('Custom rule created!');
  };

  const handleDeleteCustomPattern = (id: string) => {
    setPatterns(prev => prev.filter(p => p.id !== id));
    toast.info('Custom rule deleted.');
  };

  const handleUpdateThreshold = (threshold: number) => {
    setConfidenceThreshold(threshold);
    if (sourceEntries && targetEntries) {
      runPipeline(sourceEntries, targetEntries, threshold);
    }
  };

  const handleUpdateTargetData = async (newTargetEntries: CrawlEntry[]) => {
    setIsProcessing(true);
    
    if (!sourceEntries || sourceEntries.length === 0) {
      setTargetEntries(newTargetEntries);
      setIsProcessing(false);
      return;
    }

    try {
      // Run the matching logic against new target data
      const baseNewMappings = await matchSourceAndTargetEntriesAsync(
        sourceEntries, 
        newTargetEntries, 
        confidenceThreshold, 
        projectProfile,
        (progress: number) => setProcessProgress(Math.round(progress))
      );

    let fixedCount = 0;
    let regressionCount = 0;
    let newMatchCount = 0;
    let totalPreserved = 0;

    const mergedMappings = baseNewMappings.map(newMapping => {
      const oldMapping = mappings.find(m => m.source.url === newMapping.source.url);
      if (!oldMapping) return newMapping;

      totalPreserved++;

      const merged = {
        ...newMapping,
        notes: oldMapping.notes,
        isHidden: oldMapping.isHidden,
        status: oldMapping.status,
      };

      // Preserve manual targets and recalculate parity
      if (oldMapping.status === 'MANUAL' || oldMapping.status === 'APPROVED') {
        if (oldMapping.targetUrl && oldMapping.targetUrl !== newMapping.targetUrl) {
          const overrideTargetEntry = newTargetEntries.find(t => t.url === oldMapping.targetUrl);
          merged.targetUrl = oldMapping.targetUrl;
          merged.target = overrideTargetEntry;
          merged.strategy = oldMapping.strategy;
          merged.confidenceScore = oldMapping.confidenceScore;
          
          if (overrideTargetEntry) {
            merged.discrepancies = evaluateParityDiscrepancies(merged.source, overrideTargetEntry, projectProfile);
          } else {
            merged.discrepancies = [{ id: '404', type: 'TARGET_404_OR_500', severity: 'CRITICAL', title: 'Target Not Found in Crawl', description: 'The previously mapped target URL was not found in the new crawl.', sourceValue: '', targetValue: '', recommendation: 'Check if the page still exists.' }];
          }
        }
      }

      if (oldMapping.strategy === 'UNMAPPED' && merged.strategy !== 'UNMAPPED') {
        newMatchCount++;
      }
      
      const oldDiscrepancies = oldMapping.discrepancies.length;
      const newDiscrepancies = merged.discrepancies.length;

      if (newDiscrepancies < oldDiscrepancies) fixedCount++;
      if (newDiscrepancies > oldDiscrepancies) regressionCount++;

      return merged;
    });

    pushToHistory();
    setTargetEntries(newTargetEntries);
    setMappings(mergedMappings);
    
    const newStats = calculateMigrationStats(sourceEntries, newTargetEntries, mergedMappings, projectProfile, resolvedDiscrepancies);
    setStats(newStats);
    
      setDeltaReport({ fixedCount, regressionCount, newMatchCount, totalPreserved });
    } catch (err: any) {
      console.error("Matching pipeline failed:", err);
      toast.error(`Matching failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwapDomain = (oldDomain: string, newDomain: string) => {
    setIsDomainSwapOpen(false);
    setIsProcessing(true);

    if (!targetEntries || mappings.length === 0) {
      setIsProcessing(false);
      return;
    }

    pushToHistory();

    const replaceDomain = (url: string | undefined) => {
      if (!url) return url;
      return url.replace(oldDomain, newDomain);
    };

    const newTargetEntries: CrawlEntry[] = targetEntries.map(t => ({
      ...t,
      url: replaceDomain(t.url) as string,
      canonical: replaceDomain(t.canonical) || '',
    }));

    const newMappings = mappings.map(m => {
      const merged = { ...m };
      if (merged.targetUrl) {
        merged.targetUrl = replaceDomain(merged.targetUrl) || '';
      }
      if (merged.target) {
        merged.target = {
          ...merged.target,
          url: replaceDomain(merged.target.url) as string,
          canonical: replaceDomain(merged.target.canonical) || '',
        } as CrawlEntry;
      }
      
      return merged;
    });

    setTargetEntries(newTargetEntries);
    setMappings(newMappings);
    
    if (sourceEntries) {
      const newStats = calculateMigrationStats(sourceEntries, newTargetEntries, newMappings, projectProfile, resolvedDiscrepancies);
      setStats(newStats);
    }

    setIsProcessing(false);
    toast.success(`Successfully swapped domain to ${newDomain}`);
  };

  const handleToggleDiscrepancyResolution = (discrepancyId: string) => {
    setResolvedDiscrepancies(prev => {
      const next = { ...prev, [discrepancyId]: !prev[discrepancyId] };
      if (sourceEntries && targetEntries) {
        setStats(calculateMigrationStats(sourceEntries, targetEntries, mappings, projectProfile, next));
      }
      return next;
    });
  };

  const hasData = Boolean(sourceEntries && targetEntries && mappings.length > 0 && stats);

  const handleMergeGscData = (gscData: any[]) => {
    if (!sourceEntries) return;

    // Create a map of URL to GSC data for fast lookup
    // Ignore trailing slashes for better matching
    const gscMap = new Map(gscData.map(d => [d.url.replace(/\/$/, ''), d]));

    const updatedEntries = sourceEntries.map(entry => {
      const match = gscMap.get(entry.url.replace(/\/$/, ''));
      if (match) {
        return {
          ...entry,
          visits: match.clicks, // use clicks as visits
          revenue: match.impressions // temp map impressions to revenue to reuse visual indicators if needed
        };
      }
      return entry;
    });

    setSourceEntries(updatedEntries);
    toast.success('GSC metrics merged with source URLs');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-brand-500/20 selection:text-brand-300 transition-colors duration-200">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Top Navigation */}
      <Navbar 
        stats={stats}
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        onRestartPipeline={() => setIsRestartModalOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenImportMap={() => setIsImportMapOpen(true)}
        onOpenHistory={async () => {
          await loadSnapshots();
          setIsHistoryOpen(true);
        }}
        onOpenProjectManager={() => setIsProjectManagerOpen(true)}
        onOpenHelp={() => {
          let context;
          const view = location.pathname.split('/')[2] || 'dashboard';
          if (view === 'parity') context = 'parity';
          else if (view === 'regex') context = 'matching';
          else if (view === 'data' || view === 'dashboard') context = 'workflow';
          else if (view === 'architecture') context = 'process';
          else if (view === 'validation') context = 'manual';
          
          setHelpContext(context);
          setIsHelpOpen(true);
        }}
        onNewProject={handleReset}
        hasData={hasData}
        projectName={projectName}
        setProjectName={setProjectName}
        onSaveVersion={() => takeSnapshot('Manual Snapshot', mappings, stats!)}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Loading / Restoring Overlay */}
        {(isProcessing || isRestoring) && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center">
            <div className="w-96 p-6 rounded-2xl bg-slate-900 border border-brand-500/30 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-400"></div>
                <h3 className="text-sm font-bold text-white">
                  {isRestoring ? 'Restoring previous session...' : 'Analyzing & Matching URLs...'}
                </h3>
              </div>
              {!isRestoring && (
                <>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${processProgress}%` }}
                    />
                  </div>
                  <p className="text-xs font-mono text-slate-400 text-right">{processProgress}% complete</p>
                </>
              )}
            </div>
          </div>
        )}

        {(!hasData && !isRestoring) ? (
          <UploadZone 
            onDataParsed={handleDataParsed}
            onLoadSample={handleLoadSample}
          />
        ) : (
          <div className="space-y-6">
            <Routes>
              <Route path="/:projectSlug/dashboard" element={
                stats && (
                  <DashboardOverview
                    stats={stats}
                    mappings={mappings}
                    onNavigateTab={(tab) => navigate(`/${slugify(projectName)}/${tab}`)}
                    onOpenExport={() => setIsExportOpen(true)}
                    onUpdateTargetData={() => setIsDataSourcesOpen(true)}
                    onSwapDomain={() => setIsDomainSwapOpen(true)}
                    onMergeGscData={handleMergeGscData}
                    isGscConnected={isGscConnected}
                    onGscConnected={() => setIsGscConnected(true)}
                    snapshots={snapshots}
                  />
                )
              } />

              <Route path="/:projectSlug/mapping" element={
                <UrlMappingTable
                  mappings={mappings}
                  sourceEntries={sourceEntries || []}
                  targetEntries={targetEntries || []}
                  onUpdateMapping={handleUpdateMapping}
                  onBulkUpdateMappings={handleBulkUpdateMappings}
                  confidenceThreshold={confidenceThreshold}
                  onUpdateThreshold={setConfidenceThreshold}
                  onUndo={handleUndoMapping}
                  canUndo={mappingsHistory.length > 0}
                  onFilteredMappingsChange={setActiveFilteredMappings}
                />
              } />

              <Route path="/:projectSlug/parity" element={
                <SeoParityView 
                  mappings={mappings} 
                  resolvedDiscrepancies={resolvedDiscrepancies}
                  onToggleDiscrepancyResolution={handleToggleDiscrepancyResolution}
                  onUpdateMapping={handleUpdateMapping}
                  onBulkUpdateMappings={handleBulkUpdateMappings}
                />
              } />

              <Route path="/:projectSlug/architecture" element={
                <ArchitectureView 
                  sourceEntries={sourceEntries || []} 
                  targetEntries={targetEntries || []} 
                  mappings={mappings}
                  onUpdateMapping={handleUpdateMapping}
                />
              } />

              <Route path="/:projectSlug/infrastructure" element={
                <InfrastructureAuditorView 
                  projectMetadata={projectMetadata}
                />
              } />

              <Route path="/:projectSlug/regex" element={
                <RegexSynthesizerView
                  patterns={patterns}
                  mappings={mappings}
                  onTogglePattern={handleTogglePattern}
                  onAddCustomPattern={handleAddCustomPattern}
                  onDeleteCustomPattern={handleDeleteCustomPattern}
                />
              } />

              <Route path="/:projectSlug/playbook" element={
                <MigrationChecklist
                  project={{
                    id: projectId,
                    name: projectName,
                    profile: projectProfile,
                    sourceFileName: '',
                    targetFileName: '',
                    sourceDomain: '',
                    targetDomain: '',
                    sourceEntries: sourceEntries || [],
                    targetEntries: targetEntries || [],
                    mappings,
                    patterns,
                    stats: stats!,
                    checklistProgress,
                    metadata: projectMetadata,
                    confidenceThreshold,
                    createdAt: projectCreatedAt,
                    updatedAt: new Date().toISOString()
                  }}
                  onUpdateProgress={setChecklistProgress}
                  onUpdateMetadata={handleUpdateMetadata}
                />
              } />

              <Route path="/:projectSlug/validation" element={
                <ValidationView mappings={mappings} />
              } />

              <Route path="/:projectSlug/link-audit" element={
                <LinkAuditorView targetEntries={targetEntries || []} mappings={mappings} />
              } />
              
              <Route path="/:projectSlug/crawl-data" element={
                <CrawlDataView sourceEntries={sourceEntries} targetEntries={targetEntries} />
              } />

              <Route path="*" element={<Navigate to={`/${slugify(projectName || 'Untitled Project')}/dashboard`} replace />} />
            </Routes>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm py-4 text-center text-xs text-slate-500">
        <p>MigrateFlow • Built for SEO Agencies, Dev Teams & Enterprise Migrations</p>
      </footer>

      {/* Export Configuration Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        mappings={activeFilteredMappings.length > 0 ? activeFilteredMappings : mappings}
        patterns={patterns}
        stats={stats}
        projectMetadata={projectMetadata}
        checklistProgress={checklistProgress}
        targetEntries={targetEntries || []}
      />

      {/* Project Manager Modal */}
      <ProjectManagerModal
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        onLoadProject={(project) => {
          loadProjectIntoState(project);
          toast.success(`Loaded project: ${project.name || 'Untitled Project'}`);
        }}
        onNewProject={handleReset}
        currentProjectId={projectId}
      />

      {/* History Sidebar */}
      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        snapshots={snapshots}
        onRestore={handleRestoreSnapshot}
        onDelete={handleDeleteSnapshot}
      />

      {isDataSourcesOpen && (
        <DataSourcesModal
          isOpen={isDataSourcesOpen}
          onClose={() => setIsDataSourcesOpen(false)}
          onDataParsed={(entries) => {
            // Note: DataSourcesModal currently returns targetEntries here 
            // for the initial crawl/upload, unless it's doing source.
            // Wait, this callback is for the "Smart Merge". In the current logic,
            // DataSourcesModal just returns the target entries to this prop.
            handleUpdateTargetData(entries);
            setIsDataSourcesOpen(false);
          }}
          sourceEntries={sourceEntries || undefined}
          onMergeAnalytics={(enriched) => {
            setSourceEntries(enriched);
            toast.success('Analytics data successfully merged!');
          }}
        />
      )}

      {isRestartModalOpen && (
        <RestartPipelineModal 
          onClose={() => setIsRestartModalOpen(false)}
          onRestart={(keepManual) => {
            setIsRestartModalOpen(false);
            runPipeline(sourceEntries!, targetEntries!, confidenceThreshold, projectProfile, keepManual);
          }}
        />
      )}

      <ImportMapModal
        isOpen={isImportMapOpen}
        onClose={() => setIsImportMapOpen(false)}
        mappings={mappings}
        sourceEntries={sourceEntries}
        targetEntries={targetEntries}
        onBulkUpdate={handleBulkUpdateMappings}
      />
      
      <DeltaReportModal
        isOpen={deltaReport !== null}
        onClose={() => setDeltaReport(null)}
        report={deltaReport}
      />

      <DomainSwapModal
        isOpen={isDomainSwapOpen}
        onClose={() => setIsDomainSwapOpen(false)}
        onSwap={handleSwapDomain}
      />

      <KnowledgeBaseSidebar
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        activeContext={helpContext}
      />

    </div>
  );
}

export default App;
