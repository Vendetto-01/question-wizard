const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini API Key kontrolü
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable gerekli!');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini'den soru oluştur - Sadeleştirilmiş
async function generateQuestion(wordData) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

    const prompt = `
Aşağıdaki İngilizce kelime için çoktan seçmeli quiz sorusu oluştur:

Kelime: ${wordData.word}
Türkçe Anlamı: ${wordData.turkish_meaning}
Kelime Türü: ${wordData.part_of_speech}
Anlam Açıklaması: ${wordData.meaning_description}
İngilizce Örnek Cümle: ${wordData.english_example}

Görev:
1. Verilen İngilizce örnek cümleyi AYNEN kullan
2. Soru: "Bu cümlede '${wordData.word}' kelimesinin anlamı nedir?"
3. 4 şık oluştur: 1 doğru, 3 yanlış
4. Doğru şık verilen Türkçe anlamı olacak

SADECE JSON döndür:

{
  "paragraph": "${wordData.english_example}",
  "question": "Bu cümlede '${wordData.word}' kelimesinin anlamı nedir?",
  "options": {
    "A": "Şık A metni",
    "B": "Şık B metni", 
    "C": "Şık C metni",
    "D": "Şık D metni"
  },
  "correct_answer": "A",
  "explanation": "Kısa açıklama"
}`;

    const result = await model.generateContent(prompt);
    return result.response.text();

  } catch (error) {
    console.error(`Gemini API hatası (${wordData.word}):`, error.message);
    throw new Error(`Gemini API hatası: ${error.message}`);
  }
}

// Gemini response'unu parse et - Sadeleştirilmiş
function parseGeminiResponse(response) {
  try {
    let cleanJson = response.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const jsonData = JSON.parse(cleanJson);
    
    // Basit validation
    const required = ['paragraph', 'question', 'options', 'correct_answer', 'explanation'];
    for (const field of required) {
      if (!jsonData[field]) {
        throw new Error(`Eksik alan: ${field}`);
      }
    }

    const options = ['A', 'B', 'C', 'D'];
    for (const option of options) {
      if (!jsonData.options[option]) {
        throw new Error(`Eksik şık: ${option}`);
      }
    }

    if (!options.includes(jsonData.correct_answer)) {
      throw new Error('correct_answer A, B, C veya D olmalı');
    }
    
    return {
      paragraph: jsonData.paragraph,
      question: jsonData.question,
      option_a: jsonData.options.A,
      option_b: jsonData.options.B,
      option_c: jsonData.options.C,
      option_d: jsonData.options.D,
      correct_answer: jsonData.correct_answer,
      explanation: jsonData.explanation
    };
    
  } catch (error) {
    console.error('JSON parse hatası:', error.message);
    console.error('Raw response:', response);
    throw new Error(`JSON parse hatası: ${error.message}`);
  }
}

// POST /api/questions/generate - Soru oluştur
router.post('/generate', async (req, res) => {
  try {
    const { wordIds } = req.body;

    // Basit validation
    if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      return res.status(400).json({
        error: 'Kelime ID listesi gerekli'
      });
    }

    if (wordIds.length > 50) {
      return res.status(400).json({
        error: 'Maksimum 50 kelime için soru oluşturabilirsiniz'
      });
    }

    console.log(`🚀 ${wordIds.length} kelime için soru oluşturma başladı...`);

    // Kelime bilgilerini al - Sadece gerekli alanlar
    const { data: words, error: wordsError } = await req.supabase
      .from('words')
      .select(`
        id, word, meaning_id, part_of_speech, 
        meaning_description, english_example, turkish_meaning
      `)
      .in('id', wordIds)
      .eq('is_active', true);

    if (wordsError) {
      throw new Error(`Kelimeler alınamadı: ${wordsError.message}`);
    }

    if (!words || words.length === 0) {
      return res.status(404).json({
        error: 'Seçilen kelimeler bulunamadı'
      });
    }

    const results = [];
    const errors = [];

    // Her kelime için soru oluştur
    for (let i = 0; i < words.length; i++) {
      const wordData = words[i];
      
      try {
        console.log(`📝 [${i+1}/${words.length}] "${wordData.word}" için soru oluşturuluyor...`);
        
        const geminiResponse = await generateQuestion(wordData);
        const parsedQuestion = parseGeminiResponse(geminiResponse);
        
        // Veritabanına kaydet
        const { data: question, error: insertError } = await req.supabase
          .from('questions')
          .insert({
            word_id: wordData.id,
            paragraph: parsedQuestion.paragraph,
            question_text: parsedQuestion.question,
            option_a: parsedQuestion.option_a,
            option_b: parsedQuestion.option_b,
            option_c: parsedQuestion.option_c,
            option_d: parsedQuestion.option_d,
            correct_answer: parsedQuestion.correct_answer,
            explanation: parsedQuestion.explanation,
            difficulty: 'intermediate', // Default değer
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Veritabanı hatası: ${insertError.message}`);
        }

        results.push({
          word_id: wordData.id,
          word: wordData.word,
          question_id: question.id,
          correct_answer: parsedQuestion.correct_answer,
          status: 'success'
        });

        console.log(`✅ [${i+1}/${words.length}] "${wordData.word}" başarılı`);

        // Rate limiting
        if (i < words.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ "${wordData.word}" hata:`, error.message);
        errors.push({
          word_id: wordData.id,
          word: wordData.word,
          error: error.message,
          status: 'failed'
        });
      }
    }

    console.log(`🎉 Tamamlandı: ${results.length} başarılı, ${errors.length} hatalı`);
    
    res.json({
      message: `${results.length} soru başarıyla oluşturuldu`,
      total_requested: wordIds.length,
      successful: results.length,
      failed: errors.length,
      success_rate: `${((results.length / wordIds.length) * 100).toFixed(1)}%`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Generate questions genel hatası:', error);
    res.status(500).json({
      error: 'Sorular oluşturulurken hata oluştu',
      message: error.message
    });
  }
});

// GET /api/questions - Basit soru listesi
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000; // Yüksek default limit

    const { data: questions, error } = await req.supabase
      .from('questions')
      .select(`
        id, word_id, paragraph, question_text, option_a, option_b, 
        option_c, option_d, correct_answer, explanation, difficulty,
        is_active, created_at, updated_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      questions: questions || [],
      total: questions?.length || 0
    });

  } catch (error) {
    console.error('❌ Questions list hatası:', error);
    res.status(500).json({
      error: 'Sorular alınırken hata oluştu',
      message: error.message
    });
  }
});

module.exports = router;