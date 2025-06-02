// src/config.js
const config = {
  // REACT_APP_BACKEND_URL'i kullan (sizin environment variable'ınız)
  API_URL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001',
  
  // API endpoints
  ENDPOINTS: {
    WORDS: '/api/words',
    QUESTIONS: '/api/questions',
    GENERATE_QUESTIONS: '/api/questions/generate',
    DATABASE_INFO: '/api/database-info'
  }
};

export default config;