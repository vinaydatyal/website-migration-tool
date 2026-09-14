import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { DashboardOverview } from '../components/DashboardOverview';
import { UrlMappingTable } from '../components/UrlMappingTable';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { MigrationProject } from '../types/migration';

export const SharedDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<MigrationProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        if (!id) throw new Error('No project ID provided');
        
        const { data, error } = await supabase
          .from('migrationProjects')
          .select('project_data')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Project not found');

        setProject(data.project_data as MigrationProject);
      } catch (err: any) {
        setError(err.message || 'Failed to load shared project');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-4" />
        <p>Loading shared dashboard...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Link Expired or Invalid</h2>
        <p className="max-w-md">{error}</p>
        <Link to="/" className="mt-6 px-4 py-2 bg-brand-500 text-slate-950 rounded font-bold hover:bg-brand-400">
          Go to Homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Read-Only Banner */}
      <div className="bg-brand-500/10 border-b border-brand-500/20 py-2 px-4 text-center text-sm text-brand-600 dark:text-brand-400 font-medium flex items-center justify-center gap-2 print:hidden">
        <ShieldCheck className="w-4 h-4" />
        You are viewing a read-only snapshot of this migration project.
      </div>
      
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <DashboardOverview
          stats={project.stats}
          mappings={project.mappings}
          onNavigateTab={() => {}}
          onOpenExport={() => {}}
          onUpdateTargetData={() => {}}
          onSwapDomain={() => {}}
          onMergeGscData={() => {}}
          isGscConnected={false}
          onGscConnected={() => {}}
          snapshots={[]}
          isReadOnly={true}
        />
        
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 print:hidden">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">URL Mappings Overview</h3>
          <UrlMappingTable
            mappings={project.mappings}
            targetEntries={project.targetEntries || []}
            onUpdateMapping={() => {}}
            onDeleteMapping={() => {}}
            onBulkUpdateMappings={() => {}}
            onBulkDeleteMapping={() => {}}
          />
        </div>
      </div>
    </div>
  );
};
