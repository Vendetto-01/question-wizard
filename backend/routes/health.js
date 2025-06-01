const express = require('express');
const router = express.Router();

// GET /health - Health check endpoint for monitoring (standart convention)
router.get('/', (req, res) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  
  res.status(200).json({
    status: 'OK',
    message: 'Question Generator Backend is running',
    timestamp: timestamp,
    uptime: `${Math.floor(uptime)} seconds`,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// GET /health/ping - Minimal ping endpoint (UptimeRobot için)
router.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

module.exports = router;