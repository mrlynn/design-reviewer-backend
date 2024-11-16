import mongoose from 'mongoose';

// Change the export name to match what's being imported
export const dbConnectionCheck = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database unavailable',
      details: 'Database connection is not ready',
      status: mongoose.STATES[mongoose.connection.readyState]
    });
  }
  next();
};