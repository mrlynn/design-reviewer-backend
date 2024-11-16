import express from 'express';
import { GenerateService } from '../services/generateService.js';
import openaiConfig from '../config/openai.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { templateId, responses } = req.body;
    
    console.log('Generate request received:', {
      templateId,
      responsesCount: responses ? Object.keys(responses).length : 0
    });

    // Verify OpenAI is configured
    if (!openaiConfig.isConfigured()) {
      throw new Error('OpenAI is not properly configured');
    }
    
    if (!templateId) {
      return res.status(400).json({ 
        error: 'Missing required data',
        details: 'Template ID is required'
      });
    }

    if (!responses || Object.keys(responses).length === 0) {
      return res.status(400).json({ 
        error: 'Missing required data',
        details: 'Responses are required and cannot be empty'
      });
    }

    console.log('Calling GenerateService.generateFromTemplate');
    const generatedContent = await GenerateService.generateFromTemplate(templateId, responses);
    
    console.log('Generation successful, sending response');
    res.json(generatedContent);
    
  } catch (error) {
    console.error('Generate route error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;