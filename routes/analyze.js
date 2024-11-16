import express from 'express';
import { generateSystemPrompt } from '../utils/promptGenerator.js';
import { openaiCheck } from '../middleware/openaiCheck.js';
import openaiConfig from '../config/openai.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = openaiConfig.getClient();
if (!openai) {
    console.error('Failed to initialize OpenAI: API key missing or invalid');
}

router.use(openaiCheck);


// Analyze transcript
router.post('/', async (req, res) => {
    try {
      const { customerName, reviewDate, primaryContact, additionalConsiderations, transcript } = req.body;
  
      if (!transcript) {
        return res.status(400).json({
          error: 'No transcript provided',
          details: 'Request validation failed'
        });
      }
  
      const openai = openaiConfig.getClient();
      if (!openai) {
        return res.status(503).json({
          error: 'OpenAI service unavailable',
          details: 'OpenAI client is not properly configured'
        });
      }
  
      const systemPrompt = generateSystemPrompt();
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

// Generate based on template responses
router.post('/generate', async (req, res) => {
    try {
        const { templateId, sections, responses } = req.body;

        if (!responses) {
            return res.status(400).json({
                error: 'Missing responses',
                details: 'No form responses provided'
            });
        }

        const prompt = `You are a MongoDB Solutions Architect analyzing a new application design.
    Please review the following responses and generate a comprehensive analysis report.

    Customer Details:
    ${responses['customer-name'] ? `Customer: ${responses['customer-name']}` : 'No customer name provided'}
    ${responses['project-name'] ? `Project: ${responses['project-name']}` : ''}
    ${responses['industry'] ? `Industry: ${responses['industry']}` : ''}

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

        if (!completion.choices?.[0]?.message?.content) {
            throw new Error('No content in OpenAI response');
        }

        const generatedContent = completion.choices[0].message.content;
        console.log('Generated content:', generatedContent.substring(0, 200) + '...');

        res.json({
            message: 'Document generated successfully',
            content: generatedContent,
            prompt,
            response: generatedContent,
            metadata: {
                templateId,
                generatedAt: new Date().toISOString(),
                responsesSummary: {
                    sections: Object.keys(responses).length,
                    completedFields: Object.values(responses).filter(v => v).length
                }
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

export default router;