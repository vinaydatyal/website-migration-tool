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
import { MigrationChecklist } from './components/MigrationChecklist';
import { ArchitectureView } from './components/ArchitectureView';
import { ExportModal } from './components/ExportModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { HistorySidebar } from './components/HistorySidebar';
import { 
  CrawlEntry, 
  UrlMapping, 
  SynthesizedPattern, 
  MigrationSummaryStats,
  MigrationSnapshot,
  MigrationProfile
} from './types/migration';
import { matchSourceAndTargetEntriesAsync } from './utils/matcher';
import { calculateMigrationStats } from './utils/parityAuditor';
import { synthesizeRegexPatterns } from './utils/exporters';
import { slugify } from './utils/text';
import { 
  saveProjectToIndexedDB, 
  getAllProjectsFromIndexedDB, 
  deleteProjectFromIndexedDB,
  saveSnapshotToIndexedDB,
  getSnapshotsForProject,
  deleteSnapshotFromIndexedDB
} from './utils/storage';
import { SAMPLE_ECOMMERCE_OLD_SITE, SAMPLE_ECOMMERCE_NEW_SITE } from './data/sampleData';

export function App() {
  const [sourceEntries, setSourceEntries] = useState<CrawlEntry[] | null>(null);
  const [targetEntries, setTargetEntries] = useState<CrawlEntry[] | null>(null);
  const [mappings, setMappings] = useState<UrlMapping[]>([]);
  const [patterns, setPatterns] = useState<SynthesizedPattern[]>([]);
  const [stats, setStats] = useState<MigrationSummaryStats | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<MigrationSnapshot[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);

  // Project Metadata State
  const [projectId, setProjectId] = useState<string>(() => crypto.randomUUID());
  const [projectName, setProjectName] = useState<string>('Untitled Project');
  const [projectProfile, setProjectProfile] = useState<MigrationProfile>('UNKNOWN');
  const [projectCreatedAt, setProjectCreatedAt] = useState<string>('');
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>({});

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
    const snaps = await getSnapshotsForProject(projectId);
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
    await saveSnapshotToIndexedDB(snap);
    await loadSnapshots();
  };

  const handleRestoreSnapshot = (snap: MigrationSnapshot) => {
    setMappings(snap.mappings);
    setStats(snap.stats);
    toast.success(`Restored to snapshot: ${snap.description}`);
  };

  const handleDeleteSnapshot = async (snapId: string) => {
    await deleteSnapshotFromIndexedDB(snapId);
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
    if (isRestoring || !sourceEntries || !targetEntries || !stats) return;

    const timer = setTimeout(() => {
      saveProjectToIndexedDB({
        id: projectId,
        name: projectName,
        profile: projectProfile,
        sourceFileName: '',
        targetFileName: '',
        sourceDomain: '',
        targetDomain: '',
        sourceEntries,
        targetEntries,
        mappings,
        patterns,
        stats,
        checklistProgress,
        confidenceThreshold,
        createdAt: projectCreatedAt,
        updatedAt: new Date().toISOString()
      });
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [sourceEntries, targetEntries, mappings, patterns, stats, checklistProgress, confidenceThreshold, isRestoring, projectId, projectName, projectProfile, projectCreatedAt]);

  // Trigger full matching pipeline when entries or threshold changes
  const runPipeline = async (src: CrawlEntry[], tgt: CrawlEntry[], threshold = confidenceThreshold, profile = projectProfile) => {
    setIsProcessing(true);
    setProcessProgress(0);

    try {
      const computedMappings = await matchSourceAndTargetEntriesAsync(src, tgt, threshold, profile, (prog) => {
        setProcessProgress(prog);
      });
      const computedPatterns = synthesizeRegexPatterns(computedMappings);
      const computedStats = calculateMigrationStats(src, tgt, computedMappings, profile);
      
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
    profile: MigrationProfile
  ) => {
    setProjectProfile(profile);
    await runPipeline(src, tgt, confidenceThreshold, profile);
    toast.success(`Successfully analyzed ${src.length} source URLs against ${tgt.length} target URLs.`);
    navigate(`/${slugify(projectName)}/dashboard`);
  };

  const handleLoadSample = async () => {
    const newId = crypto.randomUUID();
    setProjectId(newId);
    setProjectName('Apex Athletics Demo');
    setProjectProfile('CMS_SWITCH');
    setProjectCreatedAt(new Date().toISOString());
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
    navigate('/');
  };

  const handleRestartPipeline = async () => {
    const confirmed = window.confirm('Are you sure you want to re-run the matching algorithm? This will clear all manual overrides you have made and start fresh from your uploaded files.');
    if (!confirmed) return;

    if (sourceEntries && targetEntries) {
      await runPipeline(sourceEntries, targetEntries, confidenceThreshold);
      toast.success('Successfully restarted the migration pipeline!');
    }
  };

  const handleUpdateMapping = (mappingId: string, updates: Partial<UrlMapping>) => {
    const updated = mappings.map(m => {
      if (m.id === mappingId) {
        return { ...m, ...updates };
      }
      return m;
    });
    setMappings(updated);

    if (sourceEntries && targetEntries) {
      setStats(calculateMigrationStats(sourceEntries, targetEntries, updated, projectProfile));
    }
    toast.success('Updated 301 URL mapping.');
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

  const hasData = Boolean(sourceEntries && targetEntries && mappings.length > 0 && stats);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500/20 selection:text-brand-300">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Top Navigation */}
      <Navbar 
        stats={stats}
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        onRestartPipeline={handleRestartPipeline}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenHistory={async () => {
          await loadSnapshots();
          setIsHistoryOpen(true);
        }}
        onOpenProjectManager={() => setIsProjectManagerOpen(true)}
        onNewProject={handleReset}
        hasData={!!stats}
        projectName={projectName}
        setProjectName={setProjectName}
        onSaveVersion={handleCreateManualSnapshot}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
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
                  />
                )
              } />

              <Route path="/:projectSlug/mapping" element={
                <UrlMappingTable
                  mappings={mappings}
                  targetEntries={targetEntries || []}
                  onUpdateMapping={handleUpdateMapping}
                  confidenceThreshold={confidenceThreshold}
                  onUpdateThreshold={handleUpdateThreshold}
                />
              } />

              <Route path="/:projectSlug/parity" element={
                <SeoParityView mappings={mappings} />
              } />

              <Route path="/:projectSlug/architecture" element={
                <ArchitectureView 
                  sourceEntries={sourceEntries || []} 
                  targetEntries={targetEntries || []} 
                  mappings={mappings}
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
                    confidenceThreshold,
                    createdAt: projectCreatedAt,
                    updatedAt: new Date().toISOString()
                  }}
                  onUpdateProgress={setChecklistProgress}
                />
              } />
              <Route path="*" element={<Navigate to={`/${slugify(projectName || 'Untitled Project')}/dashboard`} replace />} />
            </Routes>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <p>MigrateShield • Built for SEO Agencies, Dev Teams & Enterprise Migrations</p>
      </footer>

      {/* Export Configuration Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        mappings={mappings}
        patterns={patterns}
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
    </div>
  );
}

export default App;
