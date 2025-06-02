const express = require('express');
const router = express.Router();

// GET /api/database-info - Veritabanı tablo bilgileri
router.get('/', async (req, res) => {
  try {
    console.log('📊 Database info istendi...');

    // Words tablosu bilgileri
    const { count: wordsCount, error: wordsCountError } = await req.supabase
      .from('words')
      .select('*', { count: 'exact', head: true });

    if (wordsCountError) {
      throw new Error(`Words count hatası: ${wordsCountError.message}`);
    }

    // Questions tablosu bilgileri  
    const { count: questionsCount, error: questionsCountError } = await req.supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });

    if (questionsCountError) {
      throw new Error(`Questions count hatası: ${questionsCountError.message}`);
    }

    // Tablo yapıları (manuel tanımlı - Supabase'den otomatik schema okuma karmaşık)
    const tablesInfo = {
      words_table: {
        total_rows: wordsCount || 0,
        columns: [
          'id', 'word', 'meaning_id', 'part_of_speech', 
          'meaning_description', 'english_example', 'turkish_meaning',
          'is_active', 'created_at'
        ],
        column_count: 9
      },
      questions_table: {
        total_rows: questionsCount || 0,
        columns: [
          'id', 'word_id', 'paragraph', 'question_text',
          'option_a', 'option_b', 'option_c', 'option_d',
          'correct_answer', 'explanation', 'difficulty',
          'is_active', 'created_at', 'updated_at'
        ],
        column_count: 14
      }
    };

    console.log(`✅ Words: ${wordsCount}, Questions: ${questionsCount}`);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...tablesInfo
    });

  } catch (error) {
    console.error('❌ Database info hatası:', error);
    res.status(500).json({
      error: 'Veritabanı bilgileri alınırken hata oluştu',
      message: error.message
    });
  }
});

module.exports = router;