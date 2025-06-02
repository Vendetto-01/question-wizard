const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Supabase middleware
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Health check endpoints (simple & direct)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Question Generator Backend is running',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`
  });
});

app.get('/health/ping', (req, res) => {
  res.status(200).send('pong');
});

// API Routes
app.use('/api/words', require('./routes/words'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/database-info', require('./routes/database-info'));
app.use('/api/test', require('./routes/test-gemini'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🧠 Question Generator API',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      ping: '/health/ping',
      words: '/api/words',
      questions: '/api/questions',
      database_info: '/api/database-info',
      test: '/api/test'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Question Generator Server running on port ${PORT}`);
  console.log(`📊 Health check available at: /health`);
  console.log(`🏓 Ping endpoint available at: /health/ping`);
  console.log(`📊 Database info available at: /api/database-info`);
});