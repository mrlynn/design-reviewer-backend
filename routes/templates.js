// backend/routes/templates.js
import express from 'express';
import { Template } from '../models/Template.js';

const router = express.Router();

// Error handler wrapper
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get all templates
router.get('/', asyncHandler(async (req, res) => {
  const { search, type, status, tags } = req.query;
  let query = {};

  if (type) query.type = type;
  if (status) query.status = status;
  if (tags) query.tags = { $in: tags.split(',') };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const templates = await Template.find(query)
    .select('-versions.content')  // Exclude version content for list view
    .sort({ updatedAt: -1 });

  res.json(templates);
}));

// Get single template with specific version
router.get('/:templateId', asyncHandler(async (req, res) => {
    const { version } = req.query;
    const template = await Template.findOne({ templateId: req.params.templateId });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
  
    // Find the correct version
    let selectedVersion;
    if (version) {
      selectedVersion = template.versions.find(v => v.version === version);
      if (!selectedVersion) {
        return res.status(404).json({ error: 'Version not found' });
      }
    } else {
      selectedVersion = template.versions.find(v => v.version === template.currentVersion);
    }
  
    // Normalize sections
    const currentContent = {
      ...selectedVersion.content,
      sections: selectedVersion.content.sections || [] // Ensure sections is always an array
    };
  
    res.json({
      ...template.toObject(),
      currentContent
    });
  }));
  

// Create template
router.post('/', asyncHandler(async (req, res) => {
    const {
      name,
      description,
      type,
      status = 'draft',
      tags = [],
      content = {}, // Default to empty object
      metadata = {}
    } = req.body;
  
    const templateId = `template-${Date.now()}`;
    const version = '1.0.0';
  
    // Normalize content
    const normalizedContent = {
      ...content,
      sections: content.sections || [] // Ensure sections is always an array
    };
  
    const template = new Template({
      templateId,
      name,
      description,
      type,
      status,
      tags,
      currentVersion: version,
      metadata,
      versions: [{
        content: normalizedContent,
        version,
        createdBy: 'system', // Replace with actual user ID when auth is implemented
        changelog: 'Initial version'
      }]
    });
  
    await template.save();
    res.status(201).json(template);
  }));
  
// Update template with new version
router.put('/:templateId', asyncHandler(async (req, res) => {
    const template = await Template.findOne({ templateId: req.params.templateId });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
  
    const {
      name,
      description,
      type,
      status,
      tags,
      content = {}, // Default to empty object
      metadata,
      changelog = ''
    } = req.body;
  
    // Create new version number
    const currentVersionParts = template.currentVersion.split('.');
    const newVersion = `${currentVersionParts[0]}.${currentVersionParts[1]}.${parseInt(currentVersionParts[2]) + 1}`;
  
    // Normalize content
    const normalizedContent = {
      ...content,
      sections: content.sections || [] // Ensure sections is always an array
    };
  
    // Update template
    template.name = name || template.name;
    template.description = description || template.description;
    template.type = type || template.type;
    template.status = status || template.status;
    template.tags = tags || template.tags;
    template.metadata = metadata || template.metadata;
    template.currentVersion = newVersion;
  
    // Add new version
    template.versions.push({
      content: normalizedContent,
      version: newVersion,
      createdBy: 'system', // Replace with actual user ID when auth is implemented
      changelog
    });
  
    await template.save();
    res.json(template);
  }));
  
// Get template history
router.get('/:templateId/history', asyncHandler(async (req, res) => {
  const template = await Template.findOne({ templateId: req.params.templateId });
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const history = template.versions.map(version => ({
    version: version.version,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    changelog: version.changelog
  }));

  res.json(history);
}));

export default router;