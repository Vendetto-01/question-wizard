const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini API Key kontrolü
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable gerekli!');
}

// Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini'den soru oluştur
async function generateQuestion(word, partOfSpeech, definition) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Aşağıdaki İngilizce kelime için Türkçe quiz sorusu oluştur ve JSON formatında döndür:

Kelime: ${word}
Kelime türü: ${partOfSpeech}
Tanım: ${definition}

Kurallar:
1. TEK CÜMLELİK İngilizce paragraf yaz (kelimeyi doğru anlamda kullan)
2. Soru: "Bu paragraftaki '${word}' kelimesinin anlamı nedir?"
3. 1 doğru + 3 yanlış Türkçe anlam oluştur
4. Sadece JSON döndür, başka metin yazma

JSON Format:
{
  "paragraph": "Tek cümlelik İngilizce paragraf burada",
  "question": "Bu paragraftaki '${word}' kelimesinin anlamı nedir?",
  "correct_answer": "Doğru Türkçe anlam",
  "wrong_answers": ["Yanlış anlam 1", "Yanlış anlam 2", "Yanlış anlam 3"]
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();

  } catch (error) {
    console.error(`Gemini API hatası (${word}):`, error.message);
    throw new Error(`Gemini API hatası: ${error.message}`);
  }
}

// Gemini response'unu parse et
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
    if (!jsonData.paragraph || !jsonData.question || !jsonData.correct_answer || !jsonData.wrong_answers) {
      throw new Error('JSON response eksik alanlar içeriyor');
    }
    
    if (!Array.isArray(jsonData.wrong_answers) || jsonData.wrong_answers.length !== 3) {
      throw new Error('wrong_answers 3 elemanlı array olmalı');
    }
    
    // Yeni formata dönüştür
    return {
      paragraph: jsonData.paragraph,
      question: jsonData.question,
      option_a: jsonData.correct_answer,      // Doğru cevap hep A
      option_b: jsonData.wrong_answers[0],    // 1. yanlış cevap
      option_c: jsonData.wrong_answers[1],    // 2. yanlış cevap  
      option_d: jsonData.wrong_answers[2]     // 3. yanlış cevap
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

    // Kelime bilgilerini al
    const { data: words, error: wordsError } = await req.supabase
      .from('words')
      .select('id, word, part_of_speech, definition')
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
      const word = words[i];
      
      try {
        console.log(`📝 [${i+1}/${words.length}] "${word.word}" için soru oluşturuluyor...`);
        
        // Gemini'den soru oluştur
        const geminiResponse = await generateQuestion(
          word.word, 
          word.part_of_speech, 
          word.definition
        );
        
        // Response'u parse et
        const parsedQuestion = parseGeminiResponse(geminiResponse);
        
        /// Soruyu veritabanına kaydet
        const { data: question, error: insertError } = await req.supabase
          .from('questions')
          .insert({
            word_id: word.id,
            paragraph: parsedQuestion.paragraph,
            question_text: parsedQuestion.question,
            option_a: parsedQuestion.option_a,  // Doğru cevap
            option_b: parsedQuestion.option_b,  // Yanlış cevap 1
            option_c: parsedQuestion.option_c,  // Yanlış cevap 2
            option_d: parsedQuestion.option_d,  // Yanlış cevap 3
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error(`DB insert hatası (${word.word}):`, insertError);
          throw new Error(`Veritabanı hatası: ${insertError.message}`);
        }

        results.push({
          word_id: word.id,
          word: word.word,
          question_id: question.id,
          status: 'success'
        });

        console.log(`✅ [${i+1}/${words.length}] "${word.word}" için soru başarıyla oluşturuldu`);

        // Rate limiting için kısa bekleme
        if (i < words.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ "${word.word}" için soru oluşturulamadı:`, error.message);
        errors.push({
          word_id: word.id,
          word: word.word,
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
        words(word, part_of_speech, definition)
      `)
      .eq('word_id', wordId)
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
        words(word, part_of_speech, definition)
      `, { count: 'exact' })
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