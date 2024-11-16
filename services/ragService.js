import path from 'path';
import { fileURLToPath } from 'url';
import { ragService as coreRagService } from '@design-reviewer/rag';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RAGIntegrationService {
    constructor() {
        this.ragService = coreRagService;
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            try {
                console.log('Initializing RAG Integration Service...');
                await this.ragService.initialize();
                this.initialized = true;
                console.log('RAG Integration Service initialized successfully');
            } catch (error) {
                console.error('Failed to initialize RAG Integration Service:', error);
                throw error;
            }
        }
    }

    async getAllDocuments() {
        await this.ensureInitialized();
        return this.ragService.getAllDocuments();
    }

    async getStats() {
        await this.ensureInitialized();
        return this.ragService.getStats();
    }

    async ingestDocument(filePath, metadata) {
        await this.ensureInitialized();
        console.log('Ingesting document:', {
            filePath,
            metadata
        });
        
        // Use the file path as-is since multer already saved it in the right place
        return this.ragService.ingestDocument(filePath, {
            ...metadata,
            processedAt: new Date().toISOString()
        });
    }

    async askQuestion(question) {
        try {
            console.log('Processing question:', question);

            // Get relevant documents using embeddings
            const relevantDocs = await embeddingService.search(question, 3);
            console.log(`Found ${relevantDocs.length} relevant documents`);

            // Format context from relevant documents
            const context = relevantDocs.map((doc, i) => `
Document ${i + 1} (Relevance: ${doc.score.toFixed(2)})
Source: ${doc.metadata?.sourceFile || 'Unknown'}
Content: ${doc.content}
`).join('\n\n');

            const systemPrompt = `You are a MongoDB database design and architecture expert. Analyze the user's question using the provided context from MongoDB documentation and provide a clear, detailed response.

Consider:
- Schema design and modeling best practices
- Indexing strategies
- Query patterns and performance
- Data consistency and integrity
- Scaling considerations
- Security best practices

Context from MongoDB Documentation:
${context}

Format your response in clear paragraphs. Include:
1. Direct answer to the question
2. Specific MongoDB best practices
3. Example scenarios or implementations where relevant
4. Any important caveats or considerations
5. References to official MongoDB documentation when applicable

Keep your response focused on MongoDB architecture and implementation details.`;

            console.log('Sending request to OpenAI...');
            
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: question }
                ],
                temperature: 0.7,
                max_tokens: 1500
            });

            const answer = completion.choices[0].message.content;
            console.log('Generated answer successfully');

            return answer;

        } catch (error) {
            console.error('Error in askQuestion:', error);
            throw new Error(`Failed to generate answer: ${error.message}`);
        }
    }
    

    async deleteDocument(documentId) {
        await this.ensureInitialized();
        return this.ragService.deleteDocument(documentId);
    }

    async reprocessDocument(documentId) {
        await this.ensureInitialized();
        return this.ragService.reprocessDocument(documentId);
    }

    async enhancePromptWithContext(prompt, responses) {
        await this.ensureInitialized();
        return this.ragService.enhancePromptWithContext(prompt, responses);
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async shutdown() {
        if (this.initialized) {
            await this.ragService.shutdown();
            this.initialized = false;
        }
    }
}

// Create and export the singleton instance as ragService
export const ragService = new RAGIntegrationService();

// Also export the class if needed
export { RAGIntegrationService };