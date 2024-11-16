import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables first
dotenv.config();

// Import configurations
import openaiConfig from './config/openai.js';
import connectDB from './config/database.js';

// Import services
import { ragService } from './services/ragService.js';  // Updated to use ragService

// Import routes
import analyzeRoutes from './routes/analyze.js';
import healthRoutes from './routes/health.js';
import templateRoutes from './routes/templates.js';
import generateRoutes from './routes/generate.js';
import ragRoutes from './routes/rag.js';

// Import middleware
import { dbConnectionCheck } from './middleware/dbConnection.js';
import { errorHandler } from './middleware/errorHandler.js';

// Setup directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Routes with database check
app.use('/api', dbConnectionCheck);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/rag', ragRoutes);

// Error handling
app.use(errorHandler);

// Application initialization
const initializeApp = async () => {
  try {
    console.log('Starting application initialization...');
    console.log('Environment:', process.env.NODE_ENV);
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('MongoDB connection successful');

    // Initialize OpenAI configuration
    console.log('Initializing OpenAI...');
    openaiConfig.initialize();
    console.log('OpenAI initialization successful');

    // Initialize RAG service
    console.log('Initializing RAG service...');
    await ragService.initialize();  // Updated to use ragService
    console.log('RAG service initialization successful');

    // Start server
    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log({
        environment: process.env.NODE_ENV || 'development',
        mongodbConnected: mongoose.connection.readyState === 1,
        openaiConfigured: openaiConfig.isConfigured(),
        ragInitialized: ragService.initialized,  // Updated to use ragService
        port: PORT
      });
    });

    // Setup shutdown handlers
    process.on('SIGINT', async () => {
      try {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');

        // Close RAG service
        if (ragService.initialized) {  // Updated to use ragService
          await ragService.shutdown();
          console.log('RAG service shutdown complete.');
        }

        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Start the application
initializeApp().catch(error => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});

export default app;