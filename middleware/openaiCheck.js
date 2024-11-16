import openai from '../config/openai.js';
import dotenv from 'dotenv';

dotenv.config();

export const openaiCheck = (req, res, next) => {
    if (!process.env.OPENAI_API_KEY || !openaiConfig.isConfigured()) {
        return res.status(503).json({
            error: 'OpenAI service unavailable',
            details: 'OpenAI API is not properly configured',
        });
    }
    next();
};