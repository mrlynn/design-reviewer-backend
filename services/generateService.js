import openaiConfig from '../config/openai.js';
import { ragService } from './ragService.js';

class GenerateService {
    static async generateFromTemplate(templateId, responses) {
        try {
            console.log('Building prompt for template:', templateId);
            const prompt = this.buildPrompt(responses);

            const openai = openaiConfig.getClient();

            if (!openai) {
                throw new Error('OpenAI client not initialized');
            }

            // Make sure RAG service is initialized before using it
            await ragService.ensureInitialized();

            // Get enhanced prompt using RAG
            const enhancedPrompt = await ragService.enhancePromptWithContext(prompt, responses);

            console.log('Sending request to OpenAI with enhanced prompt');
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are a MongoDB Solutions Architect specializing in application design reviews."
                    },
                    {
                        role: "user",
                        content: enhancedPrompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 4000
            });

            console.log('OpenAI response received successfully');

            const result = {
                content: completion.choices[0].message.content,
                metadata: {
                    templateId,
                    generatedAt: new Date().toISOString(),
                    responsesSummary: {
                        sections: Object.keys(responses).length,
                        completedFields: Object.values(responses).filter(v => v).length
                    }
                }
            };

            return result;

        } catch (error) {
            console.error('GenerateService error:', {
                name: error.name,
                message: error.message,
                templateId,
                responsesCount: Object.keys(responses).length
            });
            throw error;
        }
    }

    static buildPrompt(responses) {
        try {
            const promptText = `You are a MongoDB Solutions Architect analyzing a new application design.
      Please review the following responses and generate a comprehensive analysis report.

      Customer Details:
      ${responses['customer-name'] ? `Customer: ${responses['customer-name']}` : 'No customer name provided'}
      ${responses['project-name'] ? `Project: ${responses['project-name']}` : ''}
      ${responses['industry'] ? `Industry: ${responses['industry']}` : ''}

      Response Details:
      ${Object.entries(responses)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n')}

      Format the response in markdown with clear sections:

      1. Executive Summary
      2. Architecture Overview
      3. Design Analysis
         - Schema Design
         - Query Patterns
         - Indexing Strategy
      4. Recommendations
      5. Next Steps

      Use markdown formatting for better readability.`;

            console.log('Built prompt:', {
                promptLength: promptText.length,
                responsesIncluded: Object.keys(responses).length
            });

            return promptText;

        } catch (error) {
            console.error('Error building prompt:', error);
            throw new Error('Failed to build prompt: ' + error.message);
        }
    }
}

export { GenerateService };