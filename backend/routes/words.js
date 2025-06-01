const express = require('express');
const router = express.Router();

// GET /api/words - YENİ TABLO YAPISINA GÖRE kelimeleri getir
router.get('/', async (req, res) => {
  try {
    const { data: wordsWithQuestions, error } = await req.supabase
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
        initial_difficulty,
        final_difficulty,
        difficulty_reasoning,
        analysis_method,
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
      meaning_id: word.meaning_id,
      part_of_speech: word.part_of_speech,
      meaning_description: word.meaning_description,
      english_example: word.english_example,
      turkish_sentence: word.turkish_sentence,
      turkish_meaning: word.turkish_meaning,
      initial_difficulty: word.initial_difficulty,
      final_difficulty: word.final_difficulty,
      difficulty_reasoning: word.difficulty_reasoning,
      analysis_method: word.analysis_method,
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
      .select('final_difficulty, source, analysis_method')
      .eq('is_active', true);

    if (error) throw error;

    // Final zorluk seviyelerine göre grupla
    const difficultyStats = stats.reduce((acc, word) => {
      acc[word.final_difficulty] = (acc[word.final_difficulty] || 0) + 1;
      return acc;
    }, {});

    // Kaynak türlerine göre grupla
    const sourceStats = stats.reduce((acc, word) => {
      acc[word.source] = (acc[word.source] || 0) + 1;
      return acc;
    }, {});

    // Analiz metodlarına göre grupla
    const methodStats = stats.reduce((acc, word) => {
      acc[word.analysis_method] = (acc[word.analysis_method] || 0) + 1;
      return acc;
    }, {});

    res.json({
      total_words: stats.length,
      by_final_difficulty: difficultyStats,
      by_source: sourceStats,
      by_analysis_method: methodStats
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