import { MigrationProfile } from '../types/migration';

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ChecklistPhase {
  title: string;
  items: ChecklistItem[];
}

export interface PlaybookChecklist {
  profile: MigrationProfile;
  title: string;
  description: string;
  phases: ChecklistPhase[];
}

export const MIGRATION_CHECKLISTS: Record<string, PlaybookChecklist> = {
  CMS_SWITCH: {
    profile: 'CMS_SWITCH',
    title: 'Website CMS Migration Checklist',
    description: 'Comprehensive playbook for migrating to a completely new Content Management System (e.g. Magento to Shopify, Webflow to Framer).',
    phases: [
      {
        title: 'Before Migration',
        items: [
          { id: 'cms_before_1', label: 'Crawl & export all URLs' },
          { id: 'cms_before_2', label: 'Backup meta tags, headings, schema, alt texts' },
          { id: 'cms_before_3', label: 'Backup robots.txt & sitemap.xml' },
          { id: 'cms_before_4', label: 'Record internal linking/navigation structure' },
          { id: 'cms_before_5', label: 'Backup analytics/tracking scripts' },
          { id: 'cms_before_6', label: 'Benchmark current site speed' },
          { id: 'cms_before_7', label: 'Audit canonical tags' },
          { id: 'cms_before_8', label: 'Ensure plugins/apps integration requirements are documented' },
        ]
      },
      {
        title: 'After Migration',
        items: [
          { id: 'cms_after_1', label: 'Verify URLs & set 301 redirects if needed' },
          { id: 'cms_after_2', label: 'Check meta tags, H1s, schema markup' },
          { id: 'cms_after_3', label: 'Ensure content & product descriptions are intact' },
          { id: 'cms_after_4', label: 'Review navigation, breadcrumbs, internal links' },
          { id: 'cms_after_5', label: 'Test page speed & Core Web Vitals' },
          { id: 'cms_after_6', label: 'Confirm GA4, GSC, GTM, and pixel tracking' },
          { id: 'cms_after_7', label: 'Check robots.txt & sitemap.xml' },
          { id: 'cms_after_8', label: 'Crawl site for errors (404s, noindex, duplicates)' },
          { id: 'cms_after_9', label: 'Monitor rankings, traffic & indexing in GSC' },
        ]
      }
    ]
  },
  WORDPRESS_MIGRATION: {
    profile: 'WORDPRESS_MIGRATION',
    title: 'WordPress Migration Runbook',
    description: 'Specialized, battle-tested playbook for WordPress migrations. Combines your standard checklist with a strict phased approach to minimize risk and prevent SEO equity loss.',
    phases: [
      {
        title: 'Phase 0: Access & Baselines',
        items: [
          { id: 'wp_phase0_1', label: 'Confirm access to GSC, GA4, WordPress Admin, and Hosting/DNS' },
          { id: 'wp_before_1', label: 'Export All URLs, SiteMap URLs, Page Titles & Headings' },
          { id: 'wp_before_5', label: 'Export Meta Descriptions, Canonical tags & Schema Markups' },
          { id: 'wp_before_6', label: 'Record Internal Linking & Inlinks' },
          { id: 'wp_before_8', label: 'Record Page Speed Insights' },
          { id: 'wp_before_10', label: 'Export Images URLs with alt text' },
          { id: 'wp_before_11', label: 'Export PagesSitemap.xml and PostSitemap.xml' },
          { id: 'wp_phase0_2', label: 'Export 16 months of Search Console page & query data' },
          { id: 'wp_before_14', label: 'Record Backlinks Data / Referring Domain' },
          { id: 'wp_phase0_3', label: 'Record the current Indexed Pages (GSC)' },
          { id: 'wp_phase0_4', label: 'Export Analytics landing pages and record Measurement ID / Analytics Mes. ID' },
          { id: 'wp_before_16', label: 'Backup Robots.Txt file' },
          { id: 'wp_before_18', label: 'Record Top Keywords & Top Performing Pages' },
          { id: 'wp_before_20', label: 'Record Open graph, Redirections & All Tags' },
          { id: 'wp_phase0_5', label: 'Save a copy of the old sitemap (old-sitemap.xml)' },
          { id: 'wp_phase0_6', label: 'Turn on Position Tracking for top commercial keywords' },
        ]
      },
      {
        title: 'Phase 1: Pre-Launch Technical & Yoast',
        items: [
          { id: 'wp_phase1_1', label: 'Run a site audit on the staging environment (bypass password protection)' },
          { id: 'wp_phase1_2', label: 'Configure Yoast: Organization Name, Logo, and Social Profiles' },
          { id: 'wp_phase1_3', label: 'Yoast: Fix the global title template and site name (remove dev/staging suffixes)' },
          { id: 'wp_phase1_4', label: 'Yoast: Verify XML sitemaps feature is enabled and inspect the sitemap index' },
          { id: 'wp_phase1_5', label: 'Yoast: Turn off crawl optimization bloat (feeds, shortlinks, rsd)' },
          { id: 'wp_phase1_6', label: 'Ensure only one SEO/Redirect plugin is active (avoid conflicts)' },
          { id: 'wp_phase1_7', label: 'Check canonical tags point to production domain, not dev' },
        ]
      },
      {
        title: 'Phase 2: Launch Day Cutover',
        items: [
          { id: 'wp_phase2_1', label: 'Take a server/droplet snapshot before making DNS changes' },
          { id: 'wp_phase2_2', label: 'Remove the password protection from WordPress' },
          { id: 'wp_phase2_3', label: 'Turn off search-engine blocking (Settings > Reading)' },
          { id: 'wp_phase2_4', label: 'Verify noindex tags are completely gone from the source code' },
          { id: 'wp_phase2_5', label: 'Point the domain at WordPress (DNS Change)' },
          { id: 'wp_phase2_6', label: 'Install Redirection plugin & import the 301 Redirect Map' },
          { id: 'wp_phase2_7', label: 'Confirm HTTPS and the SSL certificate are active' },
        ]
      },
      {
        title: 'Phase 3: Post-Launch Monitoring',
        items: [
          { id: 'wp_after_1', label: 'Verify URLs & set 301 redirects if needed' },
          { id: 'wp_after_2', label: 'Check meta tags, H1s, schema markup' },
          { id: 'wp_after_3', label: 'Ensure content & descriptions are intact' },
          { id: 'wp_phase3_1', label: 'Hand-test 10-15 critical redirects in the browser' },
          { id: 'wp_phase3_2', label: 'Run a full crawler on all old URLs to confirm 301s (zero 404s/chains)' },
          { id: 'wp_phase3_3', label: 'Confirm Analytics/GA4, GTM, and pixel tracking are actively recording real-time traffic' },
          { id: 'wp_phase3_4', label: 'Submit the new sitemap_index.xml in Google Search Console' },
          { id: 'wp_phase3_5', label: 'Upload and submit old-sitemap.xml to force Google to process redirects' },
          { id: 'wp_phase3_6', label: 'Test every contact/lead form on the live site' },
          { id: 'wp_after_5', label: 'Monitor GSC 404 reports, check Search Console errors and monitor indexing daily for 7-10 days' },
        ]
      }
    ]
  },
  THEME_UPGRADE: {
    profile: 'THEME_UPGRADE',
    title: 'Theme Migration Checklist',
    description: 'Playbook for upgrading or changing the visual theme of your website while staying on the same CMS.',
    phases: [
      {
        title: 'Before Migration',
        items: [
          { id: 'theme_before_1', label: 'Backup old theme (download ZIP)' },
          { id: 'theme_before_2', label: 'Export all products, collections, pages, blogs' },
          { id: 'theme_before_3', label: 'Export redirects list' },
          { id: 'theme_before_4', label: 'Save all custom codes (CSS, JS, Liquid)' },
          { id: 'theme_before_5', label: 'Export meta titles & descriptions' },
          { id: 'theme_before_6', label: 'Backup schema/snippets' },
          { id: 'theme_before_7', label: 'List all apps connected to the theme' },
          { id: 'theme_before_8', label: 'Save tracking codes (GA4, GTM)' },
          { id: 'theme_before_9', label: 'Staging Theme Setup: Duplicate Theme (e.g. Shopify)' },
          { id: 'theme_before_10', label: 'Add all code and design changes in staging first' },
        ]
      },
      {
        title: 'After Migration',
        items: [
          { id: 'theme_after_1', label: 'SEO Validations: All meta titles/descriptions still visible' },
          { id: 'theme_after_2', label: 'SEO Validations: Structured data working on products' },
          { id: 'theme_after_3', label: 'SEO Validations: Sitemap & robots.txt active' },
          { id: 'theme_after_4', label: 'App & Tracking Check: GA4, GTM, Pixel events firing correctly' },
          { id: 'theme_after_5', label: 'Mobile & Desktop Speed Check' },
          { id: 'theme_after_6', label: 'Final Monitoring: Check Search Console errors and monitor indexing for 7-10 days' },
        ]
      }
    ]
  },
  CROSS_DOMAIN: {
    profile: 'CROSS_DOMAIN',
    title: 'Domain Migration Checklist',
    description: 'Playbook for migrating from one domain to a completely new domain name.',
    phases: [
      {
        title: 'Before Migration',
        items: [
          { id: 'domain_before_1', label: 'Backup Website' },
          { id: 'domain_before_2', label: 'Audit Current Domain Settings' },
          { id: 'domain_before_3', label: 'Prepare 301 Redirects map' },
          { id: 'domain_before_4', label: 'Update Links in Content (absolute to relative/new)' },
          { id: 'domain_before_5', label: 'Pre-migration SEO Audit' },
          { id: 'domain_before_6', label: 'Test New Domain Environment' },
          { id: 'domain_before_7', label: 'Google Search Console (GSC) Setup & Change of Address Submission' },
        ]
      },
      {
        title: 'After Migration',
        items: [
          { id: 'domain_after_1', label: 'SEO Validations: All meta titles/descriptions still visible' },
          { id: 'domain_after_2', label: 'SEO Validations: Structured data working on products' },
          { id: 'domain_after_3', label: 'SEO Validations: Sitemap & robots.txt active' },
          { id: 'domain_after_4', label: 'App & Tracking Check: GA4, GTM, Pixel events firing correctly' },
          { id: 'domain_after_5', label: 'Mobile & Desktop Speed Check' },
          { id: 'domain_after_6', label: 'Final Monitoring: Check Search Console errors and monitor indexing for 7-10 days' },
        ]
      }
    ]
  }
};
