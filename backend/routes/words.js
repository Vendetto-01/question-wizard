const express = require('express');
const router = express.Router();

// GET /api/words - Yeni tablo yapısına göre kelimeleri getir
router.get('/', async (req, res) => {
  try {
    const { data: wordsWithQuestions, error } = await req.supabase
      .from('words')
      .select(`
        id,
        word,
        turkish_meaning,
        part_of_speech,
        english_example,
        difficulty,
        source,
        times_shown,
        times_correct,
        is_active,
        created_at,
        updated_at,
        questions(count)
      `)
      .eq('is_active', true)
      .order('word', { ascending: true });

    if (error) throw error;

    // Soru sayısını düzelt ve response formatını hazırla
    const formattedData = wordsWithQuestions.map(word => ({
      id: word.id,
      word: word.word,
      turkish_meaning: word.turkish_meaning,
      part_of_speech: word.part_of_speech,
      english_example: word.english_example,
      difficulty: word.difficulty,
      source: word.source,
      times_shown: word.times_shown,
      times_correct: word.times_correct,
      is_active: word.is_active,
      created_at: word.created_at,
      updated_at: word.updated_at,
      question_count: word.questions?.[0]?.count || 0
    }));

    console.log(`✅ ${formattedData.length} kelime başarıyla getirildi`);

    res.json({
      words: formattedData,
      total: formattedData.length,
      message: 'Words başarıyla getirildi'
    });

  } catch (error) {
    console.error('❌ Words listesi hatası:', error);
    res.status(500).json({
      error: 'Words listesi alınırken hata oluştu',
      message: error.message
    });
  }
});

// GET /api/words/stats - İstatistik bilgileri
router.get('/stats', async (req, res) => {
  try {
    const { data: stats, error } = await req.supabase
      .from('words')
      .select('difficulty, source')
      .eq('is_active', true);

    if (error) throw error;

    // Zorluk seviyelerine göre grupla
    const difficultyStats = stats.reduce((acc, word) => {
      acc[word.difficulty] = (acc[word.difficulty] || 0) + 1;
      return acc;
    }, {});

    // Kaynak türlerine göre grupla
    const sourceStats = stats.reduce((acc, word) => {
      acc[word.source] = (acc[word.source] || 0) + 1;
      return acc;
    }, {});

    res.json({
      total_words: stats.length,
      by_difficulty: difficultyStats,
      by_source: sourceStats
    });

  } catch (error) {
    console.error('❌ Words stats hatası:', error);
    res.status(500).json({
      error: 'İstatistikler alınırken hata oluştu',
      message: error.message
    });
  }
});

module.exports = router;