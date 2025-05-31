// src/config.js
const config = {
  // Production'da environment variable'dan al, development'da localhost kullan
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
  
  // API endpoints
  ENDPOINTS: {
    WORDS: '/api/words',
    QUESTIONS: '/api/questions',
    GENERATE_QUESTIONS: '/api/questions/generate'
  }
};

export default config;