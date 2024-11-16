import openai from '../config/openai.js';
import { generateSystemPrompt } from '../utils/promptGenerator.js';

export class AnalyzeService {
  static async analyzeTranscript(transcript, metadata = {}) {
    const systemPrompt = generateSystemPrompt();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
  }
}