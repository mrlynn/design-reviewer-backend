export const errorHandler = (err, req, res, next) => {
    console.error('Error Handler:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body
    });
  
    // Handle specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.message
      });
    }
  
    if (err.name === 'OpenAIError') {
      return res.status(500).json({
        error: 'OpenAI API Error',
        details: err.message
      });
    }
  
    // Default error response
    res.status(err.status || 500).json({
      error: 'Internal Server Error',
      details: err.message || 'An unexpected error occurred',
      path: req.path,
      timestamp: new Date().toISOString()
    });
  };