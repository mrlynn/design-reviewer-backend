import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.join(__dirname, 'templates');

try {
  await fs.mkdir(TEMPLATE_DIR, { recursive: true });
} catch (error) {
  console.error('Failed to create templates directory:', error);
}

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Verify OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware to verify OpenAI key
app.use((req, res, next) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key is not configured');
    return res.status(500).json({ 
      error: 'OpenAI API key is not configured',
      details: 'Server configuration error'
    });
  }
  next();
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { customerName, reviewDate, primaryContact, additionalConsiderations, transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ 
        error: 'No transcript provided',
        details: 'Request validation failed'
      });
    }

    const systemPrompt = `You are an expert MongoDB solutions architect creating a design review document. 
    Generate a professional Markdown-formatted design review document based on the provided template and responses.
    
    Start the document with this exact YAML frontmatter format (including the dashes):
    
    ---
    title: "{templateName} Design Review"
    customer: "{customerName}"
    date: "{date}"
    type: "{templateType}"
    version: "{version}"
    ---
    
    Then structure the rest of the document with proper Markdown:
    
    # {templateName} Design Review
    
    ## Document Information
    - **Customer:** {customerName}
    - **Date:** {date}
    - **Type:** {templateType}
    - **Version:** {version}
    
    ## Executive Summary
    [Brief overview of the design review]
    
    [Rest of the document...]
    
    Use the following Markdown features consistently throughout:
    1. # For main headers
    2. ## For section headers
    3. ### For subsection headers
    4. \`\`\`javascript, \`\`\`json, or \`\`\`shell for code blocks
    5. > For important notes or quotes
    6. * For unordered lists
    7. 1. For ordered lists
    8. **Bold** for emphasis
    9. \`inline code\` for technical terms
    10. Tables for structured data
    11. --- for horizontal rules between major sections
    
    Structure the main content with:
    1. ## Executive Summary
    2. ## Architecture Overview
    3. ## Detailed Analysis
    4. ## Key Findings
    5. ## Recommendations
    6. ## Next Steps
    7. ## References
    
    Format all MongoDB commands, queries, and configuration examples in proper code blocks with appropriate syntax highlighting.
    
    Ensure all technical recommendations are specific and actionable, with proper MongoDB terminology and version-specific features.
    
    Remember to maintain consistent Markdown formatting throughout the entire document, starting from the very first line.`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript }
      ],
      response_format: { type: "json_object" }
    });
    
    const analysis = JSON.parse(completion.choices[0].message.content);
    res.json(analysis);
  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      openAIError: error.response?.data || 'No OpenAI response data'
    });
    
    res.status(500).json({ 
      error: 'Analysis failed',
      details: error.message,
      type: error.type || 'UnknownError'
    });
  }
});

// Add a health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'design-reviewer-backend',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/templates', async (req, res) => {
  try {
    console.log('Loading templates from:', TEMPLATE_DIR);
    
    // Load YAML templates
    const yamlTemplates = [];
    try {
      const files = await fs.readdir(TEMPLATE_DIR);
      console.log('Files found in template directory:', files);
      
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          console.log('Processing YAML file:', file);
          const filePath = path.join(TEMPLATE_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          console.log('YAML content:', content.substring(0, 100) + '...'); // Debug log
          
          const template = YAML.parse(content);
          template.source = 'yaml';
          yamlTemplates.push(template);
          console.log('Successfully loaded YAML template:', template.name);
        }
      }
    } catch (err) {
      console.error('Error loading YAML templates:', err);
    }

    // Load JavaScript templates
    let jsTemplates = [];
    try {
      console.log('Loading JavaScript templates...');
      const jsTemplatePath = path.join(__dirname, '..', 'frontend', 'design-review-app', 'src', 'data', 'reviewTemplates.js');
      const { reviewTemplates } = await import(jsTemplatePath);
      jsTemplates = Object.values(reviewTemplates).map(template => ({
        ...template,
        source: 'javascript'
      }));
      console.log('Loaded JavaScript templates:', jsTemplates.length);
    } catch (err) {
      console.error('Error loading JavaScript templates:', err);
    }

    // Combine templates
    const templates = [...yamlTemplates, ...jsTemplates];

    console.log('Template summary:');
    console.log('- YAML templates:', yamlTemplates.length);
    console.log('- JavaScript templates:', jsTemplates.length);
    console.log('- Total templates:', templates.length);

    res.json(templates);
  } catch (error) {
    console.error('Error in /api/templates:', error);
    res.status(500).json({ 
      error: 'Failed to load templates',
      details: error.message 
    });
  }
});

// backend/server.js - update the template loading endpoint

app.get('/api/templates/:id', async (req, res) => {
  try {
    const templateId = req.params.id;
    console.log('Loading template with ID:', templateId);
    
    // First try to find YAML template
    try {
      console.log('Checking YAML template in:', TEMPLATE_DIR);
      const files = await fs.readdir(TEMPLATE_DIR);
      console.log('Available template files:', files);
      
      // Try both with and without -yaml suffix
      const possibleFilenames = [
        `${templateId}.yaml`,
        `${templateId.replace('-yaml', '')}.yaml`,
        templateId.includes('-') ? `${templateId.split('-')[0]}.yaml` : `${templateId}.yaml`
      ];
      
      console.log('Looking for files:', possibleFilenames);
      
      for (const filename of possibleFilenames) {
        try {
          const yamlPath = path.join(TEMPLATE_DIR, filename);
          console.log('Trying path:', yamlPath);
          const content = await fs.readFile(yamlPath, 'utf-8');
          const template = YAML.parse(content);
          template.source = 'yaml';
          console.log('Found YAML template:', template.name);
          return res.json(template);
        } catch (err) {
          console.log(`No template at ${filename}`);
        }
      }
    } catch (err) {
      console.log('Error reading YAML template:', err.message);
    }

    // Fallback to JavaScript templates
    try {
      console.log('Falling back to JavaScript templates');
      const jsTemplatePath = path.join(__dirname, '..', 'frontend', 'design-review-app', 'src', 'data', 'reviewTemplates.js');
      const { reviewTemplates } = await import(jsTemplatePath);
      
      // Try to find the template with or without the -yaml suffix
      const template = reviewTemplates[templateId] || 
                      reviewTemplates[templateId.replace('-yaml', '')] ||
                      (templateId.includes('-') ? reviewTemplates[templateId.split('-')[0]] : null);
      
      if (template) {
        console.log('Found JavaScript template:', template.name);
        return res.json({
          ...template,
          source: 'javascript'
        });
      }
    } catch (err) {
      console.log('Error reading JavaScript template:', err.message);
    }

    console.log('No template found with ID:', templateId);
    res.status(404).json({ 
      error: 'Template not found',
      templateId,
      message: 'Could not find template in either YAML or JavaScript format'
    });

  } catch (error) {
    console.error('Error loading template:', error);
    res.status(500).json({ 
      error: 'Failed to load template',
      details: error.message 
    });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const template = req.body;
    
    if (!template.id) {
      return res.status(400).json({ 
        error: 'Template ID is required' 
      });
    }

    const filePath = path.join(TEMPLATE_DIR, `${template.id}.yaml`);
    await fs.writeFile(filePath, YAML.stringify(template), 'utf-8');
    
    res.json({
      message: 'Template saved successfully',
      template
    });

  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ 
      error: 'Failed to save template',
      details: error.message 
    });
  }
});

// backend/server.js
app.post('/api/generate', async (req, res) => {
  try {
    const { templateId, sections, responses } = req.body;
    
    // Log the incoming request
    console.log('Generate request received:', {
      templateId,
      hasResponses: !!responses,
      responsesKeys: responses ? Object.keys(responses) : []
    });

    // Validate request
    if (!responses) {
      return res.status(400).json({ 
        error: 'Missing responses',
        details: 'No form responses provided'
      });
    }

    // Build the analysis prompt
    const prompt = `You are a MongoDB Solutions Architect analyzing a new application design. 
    Please review the following responses and generate a comprehensive analysis report.

    Customer Details:
    ${responses['customer-name'] ? `Customer: ${responses['customer-name']}` : 'No customer name provided'}
    ${responses['project-name'] ? `Project: ${responses['project-name']}` : ''}
    ${responses['industry'] ? `Industry: ${responses['industry']}` : ''}

    Project Overview:
    ${responses['project-description'] ? `Description: ${responses['project-description']}` : ''}

    Technical Details:
    ${responses['deployment-type'] ? `Deployment: ${responses['deployment-type']}` : ''}
    ${responses['scale-requirements'] ? `Scale Requirements: ${JSON.stringify(responses['scale-requirements'], null, 2)}` : ''}

    Data Architecture:
    ${responses['data-model'] ? `Data Model: ${JSON.stringify(responses['data-model'], null, 2)}` : ''}
    ${responses['access-patterns'] ? `Access Patterns: ${JSON.stringify(responses['access-patterns'], null, 2)}` : ''}

    Security and Compliance:
    ${responses['security-requirements'] ? `Security Requirements: ${JSON.stringify(responses['security-requirements'], null, 2)}` : ''}
    ${responses['compliance-requirements'] ? `Compliance Requirements: ${JSON.stringify(responses['compliance-requirements'], null, 2)}` : ''}

    Please analyze these requirements and provide:
    1. Overall architecture assessment
    2. Data model evaluation
    3. Performance considerations
    4. Security recommendations
    5. Operational best practices

    Format the response in markdown with clear sections and actionable recommendations.`;

    console.log('Sending prompt to OpenAI:', prompt.substring(0, 200) + '...');

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: "You are a MongoDB Solutions Architect specializing in application design reviews." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    console.log('Received response from OpenAI');

    if (!completion.choices?.[0]?.message?.content) {
      throw new Error('No content in OpenAI response');
    }

    const analysis = {
      content: completion.choices[0].message.content,
      metadata: {
        generatedAt: new Date().toISOString(),
        templateName: templateId,
        responsesSummary: {
          sections: Object.keys(responses).length,
          completedFields: Object.values(responses).filter(v => v).length
        }
      }
    };

    console.log('Sending response to client');
    res.json(analysis);

  } catch (error) {
    console.error('Document generation error:', {
      message: error.message,
      stack: error.stack,
      openAIError: error.response?.data
    });
    
    res.status(500).json({ 
      error: 'Failed to generate document',
      details: error.message,
      type: error.type || 'UnknownError'
    });
  }
});
function generatePrompt(template, responses) {
  let prompt = template.globalPromptContext + '\n\n';

  template.sections.forEach(section => {
    prompt += `## ${section.title}\n`;
    
    section.questions.forEach(question => {
      const response = responses[question.id];
      if (response && question.promptContext) {
        prompt += `\n### ${question.label}\nResponse: ${JSON.stringify(response)}\n`;
        prompt += `Analysis Context:\n${question.promptContext}\n`;
      }
    });
  });

  prompt += '\n' + template.analysisPromptTemplate;

  return prompt;
}

app.post('/api/generate', async (req, res) => {
  try {
    const { templateName, templateType, sections, metadata } = req.body;
    
    if (!templateName || !sections) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Template name and sections are required'
      });
    }

    const systemPrompt = `You are an expert MongoDB solutions architect creating a design review document. 
Generate a professional Markdown-formatted design review document based on the provided template and responses.

The document should:
1. Include a clear header with metadata
2. Organize content into clear sections with proper Markdown formatting
3. Include specific, actionable MongoDB recommendations
4. Format code examples, configs, and technical details in proper Markdown code blocks
5. Add relevant MongoDB best practices and considerations
6. Include a clear summary and next steps section

Output should be in Markdown format with proper headers, lists, code blocks, and formatting.`;

    const userContent = `
Template: ${templateName}
Type: ${templateType}
Generated: ${metadata.generatedAt}
Version: ${metadata.templateVersion}

Review Information:
${JSON.stringify(sections, null, 2)}

Generate a comprehensive design review document based on this information.`;

    console.log('Generating document with prompt:', userContent);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
    });

    const generatedContent = completion.choices[0].message.content;
    
    // Log success but not the entire content
    console.log('Successfully generated document for:', templateName);

    res.json({
      message: 'Document generated successfully',
      content: generatedContent,
      metadata: {
        templateName,
        templateType,
        generatedAt: metadata.generatedAt,
        version: metadata.templateVersion
      }
    });

  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate document',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);
  console.log('Templates directory:', TEMPLATE_DIR);

});