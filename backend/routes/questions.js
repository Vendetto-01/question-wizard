const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini API Key kontrolü
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable gerekli!');
}

// Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini'den soru oluştur - YENİ YAPIYA GÖRE
async function generateQuestion(wordData) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Aşağıdaki İngilizce kelime için quiz sorusu oluştur ve JSON formatında döndür:

Kelime: ${wordData.word}
Türkçe Anlamı: ${wordData.turkish_meaning}
Kelime Türü: ${wordData.part_of_speech}
Örnek Cümle: ${wordData.english_example}
Zorluk: ${wordData.difficulty}

Kurallar:
1. Verilen örnek cümleyi AYNEN kullan, değiştirme
2. Soru: "Bu cümlede '${wordData.word}' kelimesinin anlamı nedir?"
3. option_a = Doğru Türkçe anlam (verilen turkish_meaning kullan)
4. option_b, option_c, option_d = Benzer ama yanlış 3 Türkçe anlam oluştur
5. Yanlış anlamlar aynı kelime türünde olsun (${wordData.part_of_speech})
6. Sadece JSON döndür, başka metin yazma

JSON Format:
{
  "paragraph": "${wordData.english_example}",
  "question": "Bu cümlede '${wordData.word}' kelimesinin anlamı nedir?",
  "option_a": "${wordData.turkish_meaning}",
  "option_b": "Yanlış anlam 1",
  "option_c": "Yanlış anlam 2", 
  "option_d": "Yanlış anlam 3"
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();

  } catch (error) {
    console.error(`Gemini API hatası (${wordData.word}):`, error.message);
    throw new Error(`Gemini API hatası: ${error.message}`);
  }
}

// Gemini response'unu parse et
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
    if (!jsonData.paragraph || !jsonData.question || !jsonData.option_a || 
        !jsonData.option_b || !jsonData.option_c || !jsonData.option_d) {
      throw new Error('JSON response eksik alanlar içeriyor');
    }
    
    // Formatı döndür
    return {
      paragraph: jsonData.paragraph,
      question: jsonData.question,
      option_a: jsonData.option_a,      // Doğru cevap
      option_b: jsonData.option_b,      // Yanlış cevap 1
      option_c: jsonData.option_c,      // Yanlış cevap 2  
      option_d: jsonData.option_d       // Yanlış cevap 3
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
        turkish_meaning, 
        part_of_speech, 
        english_example,
        difficulty
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
            option_a: parsedQuestion.option_a,  // Doğru cevap
            option_b: parsedQuestion.option_b,  // Yanlış cevap 1
            option_c: parsedQuestion.option_c,  // Yanlış cevap 2
            option_d: parsedQuestion.option_d,  // Yanlış cevap 3
            difficulty: wordData.difficulty,
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
          difficulty: wordData.difficulty,
          status: 'success'
        });

        console.log(`✅ [${i+1}/${words.length}] "${wordData.word}" için soru başarıyla oluşturuldu`);

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
        words(word, turkish_meaning, part_of_speech, english_example, difficulty)
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
        words(word, turkish_meaning, part_of_speech, english_example, difficulty)
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