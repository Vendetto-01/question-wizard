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

// Routes
app.use('/api/health', require('./routes/health')); // YENİ: Health check route
app.use('/api/words', require('./routes/words'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/test', require('./routes/test-gemini'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🧠 Question Generator API',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      words: '/api/words',
      questions: '/api/questions',
      test: '/api/test'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Question Generator Server running on port ${PORT}`);
  console.log(`📊 Health check available at: /api/health`);
});