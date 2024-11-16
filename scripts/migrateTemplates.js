// backend/scripts/migrateTemplates.js
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import YAML from 'yaml';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Template } from '../models/Template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

dotenv.config();

async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function loadYAMLTemplates() {
  const templates = [];
  const errors = [];

  try {
    const files = await fs.readdir(TEMPLATE_DIR);
    console.log(`Found ${files.length} files in templates directory`);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          console.log(`Processing ${file}...`);
          const content = await fs.readFile(path.join(TEMPLATE_DIR, file), 'utf-8');
          const template = YAML.parse(content);
          
          if (!template || !template.id) {
            throw new Error('Invalid template or missing ID');
          }

          templates.push({
            file,
            content: template,
            originalContent: content // Keep original content for backup
          });
          
          console.log(`Successfully parsed ${file}`);
        } catch (error) {
          console.error(`Error processing ${file}:`, error.message);
          errors.push({ file, error: error.message });
        }
      }
    }
  } catch (error) {
    console.error('Error reading template directory:', error);
    process.exit(1);
  }

  return { templates, errors };
}

async function backupTemplates(templates) {
  const backupDir = path.join(__dirname, '../backups', `templates_${Date.now()}`);
  
  try {
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDir}`);

    for (const template of templates) {
      const backupPath = path.join(backupDir, template.file);
      await fs.writeFile(backupPath, template.originalContent);
    }

    // Create a migration log
    const migrationLog = {
      timestamp: new Date().toISOString(),
      templatesProcessed: templates.map(t => ({ 
        file: t.file, 
        id: t.content.id 
      }))
    };
    
    await fs.writeFile(
      path.join(backupDir, 'migration_log.json'),
      JSON.stringify(migrationLog, null, 2)
    );

    console.log('Backup completed successfully');
  } catch (error) {
    console.error('Error creating backup:', error);
    process.exit(1);
  }
}

async function migrateToMongoDB(templates) {
  const results = {
    success: [],
    failures: []
  };

  for (const template of templates) {
    try {
      console.log(`Migrating template: ${template.content.id}`);
      
      // Check if template already exists
      const existing = await Template.findOne({ templateId: template.content.id });
      
      if (existing) {
        console.log(`Template ${template.content.id} already exists, updating...`);
        
        // Add as new version if content is different
        const latestVersion = existing.versions.find(v => v.version === existing.currentVersion);
        const contentChanged = JSON.stringify(latestVersion.content) !== JSON.stringify(template.content);
        
        if (contentChanged) {
          const newVersion = semver.inc(existing.currentVersion, 'minor');
          existing.versions.push({
            content: template.content,
            version: newVersion,
            createdBy: 'migration',
            changelog: 'Migrated from YAML file'
          });
          existing.currentVersion = newVersion;
          await existing.save();
        }
      } else {
        // Create new template
        const newTemplate = new Template({
          templateId: template.content.id,
          name: template.content.name,
          description: template.content.description,
          type: template.content.type || 'design-review',
          status: 'published',
          tags: template.content.metadata?.tags || [],
          currentVersion: '1.0.0',
          versions: [{
            content: template.content,
            version: '1.0.0',
            createdBy: 'migration',
            changelog: 'Initial migration from YAML'
          }],
          metadata: {
            ...template.content.metadata,
            originalFile: template.file,
            migratedAt: new Date().toISOString()
          }
        });

        await newTemplate.save();
      }

      results.success.push(template.content.id);
      console.log(`Successfully migrated ${template.content.id}`);
    } catch (error) {
      console.error(`Error migrating ${template.content.id}:`, error);
      results.failures.push({
        id: template.content.id,
        error: error.message
      });
    }
  }

  return results;
}

async function generateMigrationReport(results, errors) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.success.length + results.failures.length,
      successful: results.success.length,
      failed: results.failures.length,
      parseErrors: errors.length
    },
    successfulMigrations: results.success,
    failedMigrations: results.failures,
    parseErrors: errors
  };

  const reportPath = path.join(__dirname, '../logs', `migration_report_${Date.now()}.json`);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log('\nMigration Report:');
  console.log('================');
  console.log(`Total templates processed: ${report.summary.total}`);
  console.log(`Successfully migrated: ${report.summary.successful}`);
  console.log(`Failed migrations: ${report.summary.failed}`);
  console.log(`Parse errors: ${report.summary.parseErrors}`);
  console.log(`\nFull report written to: ${reportPath}`);
}

async function main() {
  try {
    await connectToMongoDB();

    // Load templates
    console.log('Loading YAML templates...');
    const { templates, errors } = await loadYAMLTemplates();
    
    if (templates.length === 0) {
      console.log('No templates found to migrate');
      process.exit(0);
    }

    // Create backup
    console.log('\nCreating backup...');
    await backupTemplates(templates);

    // Migrate to MongoDB
    console.log('\nMigrating templates to MongoDB...');
    const results = await migrateToMongoDB(templates);

    // Generate report
    await generateMigrationReport(results, errors);

    console.log('\nMigration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Add command line options
import { program } from 'commander';

program
  .option('-d, --dry-run', 'Perform a dry run without actually migrating')
  .option('-f, --force', 'Force migration even if templates already exist')
  .parse(process.argv);

const options = program.opts();

if (options.dryRun) {
  console.log('Performing dry run...');
}

main().catch(console.error);