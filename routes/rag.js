// backend/routes/rag.js
import express from 'express';
import multer from 'multer';
import { ragService } from '../../rag/src/services/ragService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure upload directory
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// Ensure upload directory exists
import fs from 'fs/promises';
try {
    await fs.access(UPLOAD_DIR);
} catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `document-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ storage });

// Error handler wrapper
const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        console.error('RAG Route Error:', {
            endpoint: req.path,
            method: req.method,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
        next(error);
    }
};

// Upload and process new documents
router.post('/ingest', upload.array('documents'), asyncHandler(async (req, res) => {
    console.log('Processing uploads:', {
        filesReceived: req.files?.length,
        uploadDir: UPLOAD_DIR
    });

    const results = await Promise.all(
        req.files.map(async file => {
            console.log('Processing file:', {
                originalName: file.originalname,
                savedPath: file.path,
                size: file.size
            });

            return ragService.ingestDocument(file.path, {
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                uploadTimestamp: new Date().toISOString()
            });
        })
    );

    console.log('Upload processing complete');
    res.json(results);
}));

// Get all documents
router.get('/documents', asyncHandler(async (req, res) => {
    console.log('Fetching documents...');
    const documents = await ragService.getAllDocuments();
    console.log(`Found ${documents.length} documents`);
    
    res.json(documents.map(doc => ({
        id: doc._id,
        name: doc.metadata?.sourceFile || 'Unnamed Document',
        type: doc.metadata?.fileType || 'unknown',
        status: 'processed',
        embeddingCount: 1,
        updatedAt: doc.metadata?.timestamp || new Date()
    })));
}));

// Get system stats
router.get('/stats', asyncHandler(async (req, res) => {
    console.log('Fetching stats...');
    const stats = await ragService.getStats();
    console.log('Stats retrieved:', stats);
    res.json(stats);
}));

// Delete a document
router.delete('/documents/:documentId', asyncHandler(async (req, res) => {
    console.log('Deleting document:', req.params.documentId);
    await ragService.deleteDocument(req.params.documentId);
    console.log('Document deleted successfully');
    res.json({ success: true });
}));

// Reprocess a document
router.post('/reprocess/:documentId', asyncHandler(async (req, res) => {
    console.log('Reprocessing document:', req.params.documentId);
    const result = await ragService.reprocessDocument(req.params.documentId);
    console.log('Document reprocessed successfully');
    res.json(result);
}));

const ensureInitialized = async (req, res, next) => {
    try {
        if (!ragService.initialized) {
            console.log('RAG service not initialized, initializing now...');
            await ragService.initialize();
        }
        next();
    } catch (error) {
        console.error('Failed to initialize RAG service:', error);
        res.status(500).json({
            error: 'Service initialization failed',
            details: error.message
        });
    }
};

router.post('/ask', ensureInitialized, async (req, res) => {
    try {
        console.log('Received ask request:', {
            body: req.body,
            questionLength: req.body.question?.length,
            contentType: req.headers['content-type']
        });

        const { question } = req.body;

        if (!question) {
            console.log('No question provided in request');
            return res.status(400).json({ 
                error: 'Question is required',
                details: 'Please provide a question in the request body'
            });
        }

        console.log('Querying knowledge base with question:', question);

        // Get answer from RAG service
        const answer = await ragService.queryKnowledgeBase(question);
        
        if (!answer) {
            console.error('No answer generated from knowledge base');
            throw new Error('No answer generated');
        }

        console.log('Successfully generated answer:', {
            questionLength: question.length,
            answerLength: answer.length
        });

        res.json({ answer });

    } catch (error) {
        console.error('Error in /ask endpoint:', {
            error: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        res.status(500).json({ 
            error: 'Failed to process question',
            details: error.message || 'Internal server error',
            type: error.name
        });
    }
});
  

// Test RAG enhancement
router.post('/test-enhance', asyncHandler(async (req, res) => {
    try {
        const { prompt, responses } = req.body;
        
        if (!prompt) {
            throw new Error('Prompt is required');
        }

        console.log('Testing RAG enhancement with:', {
            promptLength: prompt.length,
            responseFields: Object.keys(responses || {})
        });

        // Get the original prompt
        const originalPrompt = prompt;

        // Enhance the prompt
        const enhancedPrompt = await ragService.enhancePromptWithContext(prompt, responses);

        // Get search terms for debugging
        const searchTerms = ragService.ragService.extractSearchTerms(responses);

        res.json({
            original: {
                prompt: originalPrompt,
                length: originalPrompt.length
            },
            enhanced: {
                prompt: enhancedPrompt,
                length: enhancedPrompt.length
            },
            searchTerms,
            wasEnhanced: enhancedPrompt.length > originalPrompt.length,
            addedContextLength: enhancedPrompt.length - originalPrompt.length
        });

    } catch (error) {
        console.error('RAG enhancement test failed:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}));

export default router;