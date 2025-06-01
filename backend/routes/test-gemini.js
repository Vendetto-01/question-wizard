const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.get('/test', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY missing' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });   
    const result = await model.generateContent("Test message");
    const text = result.response.text();

    res.json({ success: true, response: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;