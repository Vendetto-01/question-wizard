const express = require('express');
const router = express.Router();

// Batching ile tüm kelimeleri getir
async function fetchAllWords(supabase) {
  let allWords = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  console.log('📦 Kelimeler batching ile getiriliyor...');

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from('words')
      .select(`
        id, word, meaning_id, part_of_speech, meaning_description,
        english_example, turkish_meaning, is_active, created_at,
        questions(count)
      `)
      .eq('is_active', true)
      .order('word', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) throw error;

    if (!batch || batch.length === 0) break;

    allWords.push(...batch);
    offset += batchSize;

    // Güvenlik: Sonsuz döngü önleme
    if (offset > 100000) {
      console.warn('⚠️ 100k limit aşıldı, durduruluyor');
      break;
    }

    // Son batch kontrolü
    if (batch.length < batchSize) {
      hasMore = false;
    }
  }

  console.log(`✅ Toplam ${allWords.length} kelime yüklendi`);
  return allWords;
}

// GET /api/words - Tüm kelimeleri getir
router.get('/', async (req, res) => {
  try {
    const wordsData = await fetchAllWords(req.supabase);

    const formattedData = wordsData.map(word => ({
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

    res.json({
      words: formattedData,
      total: formattedData.length,
      message: `${formattedData.length} kelime başarıyla getirildi`
    });

  } catch (error) {
    console.error('❌ Words endpoint hatası:', error);
    res.status(500).json({
      error: 'Words listesi alınırken hata oluştu',
      message: error.message
    });
  }
});

module.exports = router;