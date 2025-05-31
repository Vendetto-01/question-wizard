const express = require('express');
const router = express.Router();

// GET /api/words - Üçlü kombinasyonları getir (soru sayılarıyla)
router.get('/', async (req, res) => {
  try {
    const { data: wordsWithQuestions, error } = await req.supabase
      .from('words')
      .select(`
        id,
        word,
        part_of_speech,
        definition,
        questions(count)
      `)
      .eq('is_active', true)
      .order('word', { ascending: true });

    if (error) throw error;

    // Soru sayısını düzelt
    const formattedData = wordsWithQuestions.map(word => ({
      ...word,
      question_count: word.questions?.[0]?.count || 0,
      questions: undefined // Remove the nested questions object
    }));

    res.json({
      words: formattedData,
      total: formattedData.length
    });

  } catch (error) {
    console.error('❌ Words listesi hatası:', error);
    res.status(500).json({
      error: 'Words listesi alınırken hata oluştu',
      message: error.message
    });
  }
});

module.exports = router;