// backend/server.js
import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Verify OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware to verify OpenAI key
app.use((req, res, next) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key is not configured');
    return res.status(500).json({ 
      error: 'OpenAI API key is not configured',
      details: 'Server configuration error'
    });
  }
  next();
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      console.error('No transcript provided');
      return res.status(400).json({ 
        error: 'No transcript provided',
        details: 'Request validation failed'
      });
    }

    console.log('Analyzing transcript:', transcript.substring(0, 50) + '...');

    const systemPrompt = `You are a MongoDB database design expert and solutions architect specializing in MongoDB best practices and design patterns. Analyze the provided customer discussion transcript and create a structured report focused exclusively on MongoDB architecture and implementation.

Focus areas should include:
- Schema design and modeling
- Indexing strategies
- Query patterns and performance
- Data consistency and integrity
- Scaling considerations
- Security best practices
- MongoDB Atlas specific features when relevant

Create a report with four sections:

1. What We Heard: 
   - Summarize the key technical requirements and constraints
   - Identify the specific MongoDB use cases and data access patterns
   - Note any scale, performance, or availability requirements

2. Issues and Antipatterns: 
   - Identify MongoDB-specific antipatterns in the current or proposed design
   - Flag any practices that violate MongoDB best practices
   - Highlight scalability, performance, or operational risks
   - Note any misuse of MongoDB features or capabilities

3. Recommendations:
   - Provide specific, actionable MongoDB best practices based on official MongoDB documentation
   - Include concrete schema design suggestions
   - Specify recommended index types and strategies
   - Suggest specific MongoDB features and capabilities that address the requirements
   - Include example document structures where relevant

4. References:
   - Link to specific MongoDB documentation pages
   - Reference official MongoDB design pattern guides
   - Cite MongoDB blog posts and white papers
   - Include links to relevant MongoDB University courses
   - Reference MongoDB Atlas documentation when applicable

All recommendations must be based on current MongoDB best practices (version 7.0+) and official MongoDB documentation.

Format the response as a JSON object with the following structure:
{
  "whatWeHeard": "string",
  "issues": ["string"],
  "recommendations": ["string"],
  "references": [{
    "title": "string",
    "url": "string",
    "documentationType": "official_docs|blog|whitepaper|university",
    "relevance": "string"
  }]
}

Use only official MongoDB documentation sources:
- https://www.mongodb.com/docs/
- https://www.mongodb.com/blog/
- https://university.mongodb.com/
- https://www.mongodb.com/developer/

Ensure all recommendations follow MongoDB's official best practices for:
- Document model design
- Index design and implementation
- Query optimization
- Transaction usage
- Scaling patterns
- Security implementation
- Operational excellence`;

    console.log('Sending request to OpenAI...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript }
      ],
      response_format: { type: "json_object" }
    });

    console.log('Received response from OpenAI');
    
    const analysis = JSON.parse(completion.choices[0].message.content);
    
    console.log('Successfully parsed OpenAI response');
    
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

// Add a health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);
});