import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

class OpenAIConfig {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    try {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('OpenAI API key not found in environment variables');
        return;
      }

      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.initialized = true;
      console.log('OpenAI client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error);
      this.client = null;
    }
  }

  getClient() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.client;
  }

  isConfigured() {
    return !!this.client;
  }
}

export default new OpenAIConfig();