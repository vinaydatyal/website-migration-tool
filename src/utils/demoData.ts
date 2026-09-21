import { MigrationProject, MigrationProfile } from '../types/migration';
import { SAMPLE_ECOMMERCE_OLD_SITE, SAMPLE_ECOMMERCE_NEW_SITE } from '../data/sampleData';
import { matchSourceAndTargetEntriesAsync } from './matcher';
import { calculateMigrationStats } from './parityAuditor';
import { synthesizeRegexPatterns } from './exporters';
import { getAllProjectsFromIndexedDB, saveProjectToIndexedDB } from './storage';
import { slugify } from './text';

/**
 * Creates or retrieves the isolated Apex Athletics Demo project.
 * Ensures demo data is always isolated in its own dedicated project folder.
 */
export async function createOrGetDemoProject(): Promise<MigrationProject> {
  try {
    const projects = await getAllProjectsFromIndexedDB();
    const existing = projects.find(
      p => p.isDemo || 
           slugify(p.name || '') === 'apex-athletics-demo' || 
           slugify(p.name || '') === 'apex-athletics'
    );

    if (existing && existing.sourceEntries && existing.sourceEntries.length > 0) {
      return existing;
    }

    const profile: MigrationProfile = 'CMS_SWITCH';
    const threshold = 75;
    const computedMappings = await matchSourceAndTargetEntriesAsync(
      SAMPLE_ECOMMERCE_OLD_SITE,
      SAMPLE_ECOMMERCE_NEW_SITE,
      threshold,
      profile
    );
    const computedPatterns = synthesizeRegexPatterns(computedMappings);
    const computedStats = calculateMigrationStats(
      SAMPLE_ECOMMERCE_OLD_SITE,
      SAMPLE_ECOMMERCE_NEW_SITE,
      computedMappings,
      profile,
      {}
    );

    const now = new Date().toISOString();
    const demoProject: MigrationProject = {
      id: existing?.id || 'demo_apex_athletics',
      name: 'Apex Athletics Demo',
      profile,
      sourceFileName: 'apex_legacy_magento.csv',
      targetFileName: 'apex_shopify_plus.csv',
      sourceDomain: 'https://apexathletics.com',
      targetDomain: 'https://apexathletics.store',
      sourceEntries: SAMPLE_ECOMMERCE_OLD_SITE,
      targetEntries: SAMPLE_ECOMMERCE_NEW_SITE,
      mappings: computedMappings,
      patterns: computedPatterns,
      stats: computedStats,
      checklistProgress: {},
      metadata: {
        isDemo: true,
        description: 'E-commerce Demo: Magento to Shopify Plus'
      },
      resolvedDiscrepancies: {},
      confidenceThreshold: threshold,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      isDemo: true
    };

    await saveProjectToIndexedDB(demoProject);
    return demoProject;
  } catch (error) {
    console.error('Failed to create or get demo project:', error);
    throw error;
  }
}
