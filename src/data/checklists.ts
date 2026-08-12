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
    title: 'WordPress Migration Checklist',
    description: 'Specialized playbook for migrating a WordPress site (e.g., host-to-host, or pushing staging to production).',
    phases: [
      {
        title: 'Before Migration',
        items: [
          { id: 'wp_before_1', label: 'All URLs' },
          { id: 'wp_before_2', label: 'SiteMap URLs' },
          { id: 'wp_before_3', label: 'Page Titles' },
          { id: 'wp_before_4', label: 'Page Headings' },
          { id: 'wp_before_5', label: 'Meta Descriptions' },
          { id: 'wp_before_6', label: 'Internal Linking' },
          { id: 'wp_before_7', label: 'Inlinks' },
          { id: 'wp_before_8', label: 'Page Speed Insights' },
          { id: 'wp_before_9', label: 'Canonical tags' },
          { id: 'wp_before_10', label: 'Images URLs with alt text' },
          { id: 'wp_before_11', label: 'PagesSitemap.xml' },
          { id: 'wp_before_12', label: 'PostSitemap.xml' },
          { id: 'wp_before_13', label: 'Analytics Mes. ID' },
          { id: 'wp_before_14', label: 'Backlinks Data / Referring Domain' },
          { id: 'wp_before_15', label: 'Indexed Pages (GSC)' },
          { id: 'wp_before_16', label: 'Robots.Txt file' },
          { id: 'wp_before_17', label: 'Schema Markups' },
          { id: 'wp_before_18', label: 'Top Keywords' },
          { id: 'wp_before_19', label: 'Top Performing Pages' },
          { id: 'wp_before_20', label: 'Open graph' },
          { id: 'wp_before_21', label: 'Redirections' },
          { id: 'wp_before_22', label: 'All Tags' },
          { id: 'wp_before_23', label: 'Measurement ID' },
        ]
      },
      {
        title: 'After Migration',
        items: [
          { id: 'wp_after_1', label: 'Verify URLs & set 301 redirects if needed' },
          { id: 'wp_after_2', label: 'Check meta tags, H1s, schema markup' },
          { id: 'wp_after_3', label: 'Ensure content & descriptions are intact' },
          { id: 'wp_after_4', label: 'Confirm GA4, GSC, GTM, and pixel tracking' },
          { id: 'wp_after_5', label: 'Check Search Console errors and monitor indexing for 7-10 days' },
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
