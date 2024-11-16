// backend/services/templateService.js
import { Template } from '../models/Template.js';
import semver from 'semver';

export class TemplateService {
  static async createTemplate(templateData, userId) {
    const version = '1.0.0';
    
    const template = new Template({
      templateId: templateData.id,
      name: templateData.name,
      description: templateData.description,
      type: templateData.type,
      tags: templateData.metadata?.tags || [],
      currentVersion: version,
      versions: [{
        content: templateData,
        version,
        createdBy: userId,
        changelog: 'Initial version'
      }],
      metadata: templateData.metadata
    });

    return await template.save();
  }

  static async updateTemplate(templateId, templateData, userId) {
    const template = await Template.findOne({ templateId });
    if (!template) {
      throw new Error('Template not found');
    }

    // Calculate new version
    const currentVersion = template.currentVersion;
    const newVersion = semver.inc(currentVersion, 'minor');

    // Add new version to versions array
    template.versions.push({
      content: templateData,
      version: newVersion,
      createdBy: userId,
      changelog: templateData.changelog || `Updated to version ${newVersion}`
    });

    // Update template fields
    template.name = templateData.name;
    template.description = templateData.description;
    template.type = templateData.type;
    template.tags = templateData.metadata?.tags || [];
    template.currentVersion = newVersion;
    template.metadata = templateData.metadata;

    return await template.save();
  }

  static async getTemplate(templateId, version) {
    const template = await Template.findOne({ templateId });
    if (!template) {
      throw new Error('Template not found');
    }

    if (version) {
      const specificVersion = template.versions.find(v => v.version === version);
      if (!specificVersion) {
        throw new Error('Version not found');
      }
      return {
        ...specificVersion.content,
        id: template.templateId,
        version: specificVersion.version,
        createdAt: specificVersion.createdAt,
        status: template.status,
        metadata: template.metadata
      };
    }

    // Return latest version
    const latestVersion = template.versions.find(v => v.version === template.currentVersion);
    return {
      ...latestVersion.content,
      id: template.templateId,
      version: latestVersion.version,
      createdAt: latestVersion.createdAt,
      status: template.status,
      metadata: template.metadata
    };
  }

  static async listTemplates(query = {}) {
    try {
      const {
        status,
        tags,
        type,
        search,
        page = 1,
        limit = 10
      } = query;

      const filter = {};
      
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (tags) filter.tags = { $all: Array.isArray(tags) ? tags : [tags] };
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const templates = await Template
        .find(filter)
        .sort({ updatedAt: -1 });

      // Transform the templates to match the expected format
      const transformedTemplates = templates.map(template => {
        const latestVersion = template.versions.find(v => v.version === template.currentVersion);
        return {
          id: template.templateId, // Map MongoDB _id to id
          name: template.name,
          description: template.description,
          type: template.type,
          version: template.currentVersion,
          status: template.status,
          metadata: {
            ...template.metadata,
            author: template.metadata?.author || 'MongoDB',
            tags: template.metadata?.tags || [],
            createdAt: template.createdAt,
            updatedAt: template.updatedAt
          },
          sections: latestVersion?.content?.sections || [],
          globalPromptContext: latestVersion?.content?.globalPromptContext,
          analysisPromptTemplate: latestVersion?.content?.analysisPromptTemplate,
          source: 'mongodb'
        };
      });

      console.log(`Retrieved ${transformedTemplates.length} templates from MongoDB`);
      return {
        templates: transformedTemplates,
        pagination: {
          total: transformedTemplates.length,
          page,
          limit,
          pages: Math.ceil(transformedTemplates.length / limit)
        }
      };
    } catch (error) {
      console.error('Error in listTemplates:', error);
      throw error;
    }
  }
  
  static async getTemplateHistory(templateId) {
    const template = await Template.findOne({ templateId });
    if (!template) {
      throw new Error('Template not found');
    }

    return template.versions.map(version => ({
      version: version.version,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      changelog: version.changelog
    })).sort((a, b) => semver.compare(b.version, a.version));
  }

  static async revertToVersion(templateId, version, userId) {
    const template = await Template.findOne({ templateId });
    if (!template) {
      throw new Error('Template not found');
    }

    const targetVersion = template.versions.find(v => v.version === version);
    if (!targetVersion) {
      throw new Error('Version not found');
    }

    const newVersion = semver.inc(template.currentVersion, 'minor');

    // Add reverted version as new version
    template.versions.push({
      content: targetVersion.content,
      version: newVersion,
      createdBy: userId,
      changelog: `Reverted to version ${version}`
    });

    template.currentVersion = newVersion;
    return await template.save();
  }
}