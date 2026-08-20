import React, { useState, useRef } from 'react';
import { X, UploadCloud, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { parseRedirectMapCsv } from '../utils/parser';
import { UrlMapping, CrawlEntry } from '../types/migration';

interface ImportMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: UrlMapping[];
  sourceEntries: CrawlEntry[] | null;
  targetEntries: CrawlEntry[] | null;
  onBulkUpdate: (updates: { id: string, updates: Partial<UrlMapping> }[]) => void;
}

export const ImportMapModal: React.FC<ImportMapModalProps> = ({
  isOpen,
  onClose,
  mappings,
  sourceEntries,
  targetEntries,
  onBulkUpdate
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    if (!sourceEntries || !targetEntries) {
      toast.error('Please upload source and target crawls first.');
      return;
    }

    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported for custom maps.');
      return;
    }

    setIsProcessing(true);
    try {
      const parsedMappings = await parseRedirectMapCsv(file);
      if (parsedMappings.length === 0) {
        toast.error('No mappings found in the CSV. Make sure you have "Source URL" and "Target URL" columns.');
        setIsProcessing(false);
        return;
      }

      // Map over existing mappings and apply updates
      let updatedCount = 0;
      let missingSourceCount = 0;
      const updatesList: { id: string, updates: Partial<UrlMapping> }[] = [];

      for (const row of parsedMappings) {
        const matchingSource = sourceEntries.find(s => s.url === row.sourceUrl || s.normalizedPath === new URL(row.sourceUrl, 'http://dummy.com').pathname);
        if (matchingSource) {
          const mapping = mappings.find(m => m.source.url === matchingSource.url);
          if (mapping) {
            // Find target entry if it exists to establish confidence/match type
            const targetEntry = targetEntries.find(t => t.url === row.targetUrl || t.normalizedPath === new URL(row.targetUrl, 'http://dummy.com').pathname);
            
            updatesList.push({
              id: mapping.id,
              updates: {
                target: targetEntry ? targetEntry : undefined,
                targetUrl: row.targetUrl || '',
                strategy: 'MANUAL_OVERRIDE',
                confidenceScore: 100
              }
            });
            updatedCount++;
          }
        } else {
          missingSourceCount++;
        }
      }

      if (updatesList.length > 0) {
        onBulkUpdate(updatesList);
        toast.success(`Successfully imported ${updatedCount} redirects.`);
      } else {
        toast.error('None of the source URLs in the CSV matched the current project.');
      }

      if (missingSourceCount > 0) {
        toast.warning(`${missingSourceCount} URLs in your CSV were not found in the source crawl.`);
      }

      onClose();
    } catch (err: any) {
      toast.error('Failed to parse file: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import Custom Redirect Map</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex gap-3 text-amber-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="text-sm">
              <p className="font-semibold mb-1">CSV Format Required</p>
              <p className="opacity-80">
                Your CSV must include columns named <strong>Source URL</strong> and <strong>Target URL</strong>. This tool will cross-reference the targets against the staging crawl to flag any 404s.
              </p>
            </div>
          </div>

          <div 
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
              dragActive 
                ? 'border-brand-500 bg-brand-500/5' 
                : 'border-slate-700 bg-slate-800/20 hover:border-slate-500 hover:bg-slate-800/40'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleChange}
            />
            
            <div className="mx-auto w-12 h-12 mb-4 bg-slate-800 rounded-full flex items-center justify-center">
              <UploadCloud className={`h-6 w-6 ${dragActive ? 'text-brand-400' : 'text-slate-400'}`} />
            </div>
            <p className="text-sm font-medium text-slate-300 mb-1">
              Drag and drop your custom CSV map here
            </p>
            <p className="text-xs text-slate-500 mb-6">
              or click to browse your files
            </p>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Processing Map...' : 'Select File'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
