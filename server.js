// backend/server.js
import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

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

Use the following Markdown features:
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

Structure the document with:
1. # Title and Overview
2. ## Executive Summary
3. ## Detailed Analysis (with subsections)
4. ## Recommendations
5. ## Next Steps
6. ## References

Format all MongoDB commands, queries, and configuration examples in proper code blocks with appropriate syntax highlighting.

Ensure all technical recommendations are specific and actionable, with proper MongoDB terminology and version-specific features.`;
    
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

// Add this to your server.js file

// Add to server.js

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
});