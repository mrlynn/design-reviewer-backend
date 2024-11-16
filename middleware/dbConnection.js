import mongoose from 'mongoose';

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

export const getConnectionStatus = () => ({
  isConnected: mongoose.connection.readyState === 1,
  state: mongoose.STATES[mongoose.connection.readyState],
  host: mongoose.connection.host
});