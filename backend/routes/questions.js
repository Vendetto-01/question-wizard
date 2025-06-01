const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini API Key kontrolü
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable gerekli!');
}

// Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini'den soru oluştur - YENİ BASIT VE TEMİZ YAPIYA GÖRE
async function generateQuestion(wordData) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Aşağıdaki İngilizce kelime için çoktan seçmeli quiz sorusu oluştur:

Kelime: ${wordData.word}
Türkçe Anlamı: ${wordData.turkish_meaning}
Kelime Türü: ${wordData.part_of_speech}
Anlam Açıklaması: ${wordData.meaning_description}
İngilizce Örnek Cümle: ${wordData.english_example}
Türkçe Örnek Cümle: ${wordData.turkish_sentence}
Zorluk Seviyesi: ${wordData.final_difficulty}

Görev:
1. Verilen İngilizce örnek cümleyi AYNEN kullan
2. Soru: "Bu cümlede '${wordData.word}' kelimesinin anlamı nedir?"
3. 4 şık oluştur: 1 doğru, 3 yanlış
4. Doğru şık verilen Türkçe anlamı olacak
5. Yanlış şıkları sen belirle (benzer olmaları gerekmiyor)

SADECE JSON döndür, başka metin yazma:

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
}

NOT: correct_answer kesinlikle A, B, C veya D olmalı ve doğru şıkkı göstermeli.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();

  } catch (error) {
    console.error(`Gemini API hatası (${wordData.word}):`, error.message);
    throw new Error(`Gemini API hatası: ${error.message}`);
  }
}

// Gemini response'unu parse et - YENİ FORMAT
function parseGeminiResponse(response) {
  try {
    // JSON'u temizle (bazen başında/sonunda extra metin olabiliyor)
    let cleanJson = response.trim();
    
    // ```json ve ``` etiketlerini kaldır
    cleanJson = cleanJson.replace(/```json\n?/g, '');
    cleanJson = cleanJson.replace(/```\n?/g, '');
    cleanJson = cleanJson.trim();
    
    // JSON parse et
    const jsonData = JSON.parse(cleanJson);
    
    // Validation - gerekli alanlar var mı?
    if (!jsonData.paragraph || !jsonData.question || !jsonData.options || 
        !jsonData.correct_answer || !jsonData.explanation) {
      throw new Error('JSON response eksik alanlar içeriyor');
    }

    // Options kontrolü
    if (!jsonData.options.A || !jsonData.options.B || 
        !jsonData.options.C || !jsonData.options.D) {
      throw new Error('Options A, B, C, D eksik');
    }

    // Correct answer kontrolü
    if (!['A', 'B', 'C', 'D'].includes(jsonData.correct_answer)) {
      throw new Error('correct_answer A, B, C veya D olmalı');
    }
    
    // Yeni formatı döndür
    return {
      paragraph: jsonData.paragraph,
      question: jsonData.question,
      option_a: jsonData.options.A,
      option_b: jsonData.options.B,
      option_c: jsonData.options.C,
      option_d: jsonData.options.D,
      correct_answer: jsonData.correct_answer, // A, B, C veya D
      explanation: jsonData.explanation
    };
    
  } catch (error) {
    console.error('JSON parse hatası:', error.message);
    console.error('Raw response:', response);
    throw new Error(`JSON parse hatası: ${error.message}`);
  }
}

// POST /api/questions/generate - Seçilen kelimeler için sorular oluştur
router.post('/generate', async (req, res) => {
  try {
    const { wordIds } = req.body;

    // Input validation
    if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      return res.status(400).json({
        error: 'Kelime ID listesi gerekli',
        message: 'wordIds array formatında olmalı ve boş olmamalı'
      });
    }

    if (wordIds.length > 50) {
      return res.status(400).json({
        error: 'Çok fazla kelime seçildi',
        message: 'Maksimum 50 kelime için soru oluşturabilirsiniz'
      });
    }

    console.log(`🚀 ${wordIds.length} kelime için soru oluşturma başladı...`);

    // Yeni tablo yapısına göre kelime bilgilerini al
    const { data: words, error: wordsError } = await req.supabase
      .from('words')
      .select(`
        id, 
        word, 
        meaning_id,
        part_of_speech,
        meaning_description,
        english_example,
        turkish_sentence,
        turkish_meaning,
        final_difficulty
      `)
      .in('id', wordIds)
      .eq('is_active', true);

    if (wordsError) {
      console.error('Supabase words fetch hatası:', wordsError);
      throw new Error(`Kelimeler alınamadı: ${wordsError.message}`);
    }

    if (!words || words.length === 0) {
      return res.status(404).json({
        error: 'Seçilen kelimeler bulunamadı',
        message: 'Belirtilen ID\'lerde aktif kelime bulunamadı'
      });
    }

    const results = [];
    const errors = [];

    // Her kelime için soru oluştur
    for (let i = 0; i < words.length; i++) {
      const wordData = words[i];
      
      try {
        console.log(`📝 [${i+1}/${words.length}] "${wordData.word}" için soru oluşturuluyor...`);
        
        // Gemini'den soru oluştur
        const geminiResponse = await generateQuestion(wordData);
        
        // Response'u parse et
        const parsedQuestion = parseGeminiResponse(geminiResponse);
        
        // Soruyu veritabanına kaydet - YENİ YAPIYA GÖRE
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
            correct_answer: parsedQuestion.correct_answer, // A, B, C veya D
            explanation: parsedQuestion.explanation,
            difficulty: wordData.final_difficulty,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error(`DB insert hatası (${wordData.word}):`, insertError);
          throw new Error(`Veritabanı hatası: ${insertError.message}`);
        }

        results.push({
          word_id: wordData.id,
          word: wordData.word,
          question_id: question.id,
          difficulty: wordData.final_difficulty,
          correct_answer: parsedQuestion.correct_answer,
          status: 'success'
        });

        console.log(`✅ [${i+1}/${words.length}] "${wordData.word}" için soru başarıyla oluşturuldu (Doğru: ${parsedQuestion.correct_answer})`);

        // Rate limiting için kısa bekleme
        if (i < words.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ "${wordData.word}" için soru oluşturulamadı:`, error.message);
        errors.push({
          word_id: wordData.id,
          word: wordData.word,
          error: error.message,
          status: 'failed'
        });
      }
    }

    // Sonuç döndür
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

// GET /api/questions/word/:wordId - Belirli bir kelime için soruları getir
router.get('/word/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params;

    if (!wordId || isNaN(wordId)) {
      return res.status(400).json({
        error: 'Geçersiz kelime ID'
      });
    }

    const { data: questions, error } = await req.supabase
      .from('questions')
      .select(`
        *,
        words(word, turkish_meaning, part_of_speech, meaning_description, english_example, final_difficulty)
      `)
      .eq('word_id', wordId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Questions fetch hatası:', error);
      throw error;
    }

    res.json({
      word_id: parseInt(wordId),
      questions: questions || [],
      count: questions?.length || 0
    });

  } catch (error) {
    console.error('❌ Questions fetch hatası:', error);
    res.status(500).json({
      error: 'Sorular alınırken hata oluştu',
      message: error.message
    });
  }
});

// GET /api/questions - Tüm soruları getir (sayfalama ile)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { data: questions, error, count } = await req.supabase
      .from('questions')
      .select(`
        *,
        words(word, turkish_meaning, part_of_speech, meaning_description, english_example, final_difficulty)
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      questions: questions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
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