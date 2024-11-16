import express from 'express';
import mongoose from 'mongoose';
import { OpenAI } from 'openai';

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    // Test OpenAI connection
    let openaiStatus = 'unconfigured';
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        await openai.models.list();
        openaiStatus = 'connected';
      } catch (error) {
        openaiStatus = 'error';
        console.error('OpenAI connection test failed:', error);
      }
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: {
          status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          details: {
            host: mongoose.connection.host,
            name: mongoose.connection.name,
            readyState: mongoose.connection.readyState
          }
        },
        openai: {
          status: openaiStatus,
          configured: !!process.env.OPENAI_API_KEY
        }
      },
      environment: {
        node_env: process.env.NODE_ENV,
        frontend_url: process.env.FRONTEND_URL
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health checks
router.get('/mongodb', async (req, res) => {
  try {
    const status = {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      collections: []
    };

    if (status.connected) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      status.collections = collections.map(c => c.name);
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'MongoDB health check failed',
      details: error.message
    });
  }
});

router.get('/openai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        configured: false,
        error: 'OpenAI API key not configured'
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const models = await openai.models.list();
    
    res.json({
      configured: true,
      connected: true,
      models: models.data.map(m => m.id)
    });
  } catch (error) {
    res.status(500).json({
      configured: true,
      connected: false,
      error: error.message
    });
  }
});

export default router;