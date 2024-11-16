// backend/models/Template.js
import mongoose from 'mongoose';

const TemplateVersionSchema = new mongoose.Schema({
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  version: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: String,
    required: true
  },
  changelog: {
    type: String
  }
});

const TemplateSchema = new mongoose.Schema({
  templateId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['design-review', 'data-model', 'performance', 'migration', 'custom'],
    default: 'design-review'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  tags: [{
    type: String
  }],
  currentVersion: {
    type: String,
    required: true
  },
  versions: [TemplateVersionSchema],
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add indexes
TemplateSchema.index({ templateId: 1 });
TemplateSchema.index({ tags: 1 });
TemplateSchema.index({ status: 1 });
TemplateSchema.index({ 'versions.version': 1 });

export const Template = mongoose.model('Template', TemplateSchema);