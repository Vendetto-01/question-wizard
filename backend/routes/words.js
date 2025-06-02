const express = require('express');
const router = express.Router();

// GET /api/words - Sadeleştirilmiş kelime listesi
router.get('/', async (req, res) => {
  try {
    const { data: words, error } = await req.supabase
      .from('words')
      .select(`
        id,
        word,
        meaning_id,
        part_of_speech,
        meaning_description,
        english_example,
        turkish_meaning,
        is_active,
        created_at,
        questions(count)
      `)
      .eq('is_active', true)
      .order('word', { ascending: true });

    if (error) throw error;

    // Soru sayısını düzelt ve sadece gerekli alanları döndür
    const formattedData = words.map(word => ({
      id: word.id,
      word: word.word,
      meaning_id: word.meaning_id,
      part_of_speech: word.part_of_speech,
      meaning_description: word.meaning_description,
      english_example: word.english_example,
      turkish_meaning: word.turkish_meaning,
      is_active: word.is_active,
      created_at: word.created_at,
      question_count: word.questions?.[0]?.count || 0
    }));

    console.log(`✅ ${formattedData.length} kelime kombinasyonu getirildi`);

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

module.exports = router;