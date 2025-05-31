const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini'den soru oluştur
async function generateQuestion(word, partOfSpeech, definition) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
Aşağıdaki İngilizce kelime için Türkçe bir quiz sorusu oluştur:

Kelime: ${word}
Kelime türü: ${partOfSpeech}
Tanım: ${definition}

Görev:
1. Bu kelimeyi doğru anlamda kullanan 1 cümlelik İngilizce paragraf yaz
2. "Bu paragraftaki '${word}' kelimesinin anlamı nedir?" sorusunu sor
3. 4 tane Türkçe şık oluştur (1 doğru, 3 yanlış)

Format:
PARAGRAF: [paragraf buraya]
SORU: Bu paragraftaki '${word}' kelimesinin anlamı nedir?
A) [doğru türkçe anlam]
B) [yanlış türkçe anlam]
C) [yanlış türkçe anlam]
D) [yanlış türkçe anlam]
DOĞRU: A
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();

  } catch (error) {
    throw new Error(`Gemini API hatası: ${error.message}`);
  }
}

// POST /api/questions/generate - Seçilen kelimeler için sorular oluştur
router.post('/generate', async (req, res) => {
  try {
    const { wordIds } = req.body;

    if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      return res.status(400).json({
        error: 'Kelime ID listesi gerekli'
      });
    }

    // TODO: Gemini entegrasyonu ve soru oluşturma
    res.json({
      messag