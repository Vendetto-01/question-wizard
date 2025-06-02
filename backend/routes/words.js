const express = require('express');
const router = express.Router();

// GET /api/words - Sadeleştirilmiş kelime listesi + pagination
router.get('/', async (req, res) => {
  try {
    // Pagination parametreleri
    const page = parseInt(req.query.page) || 1;
    const limit = 50; // Sabit 50 item per page
    const offset = (page - 1) * limit;

    console.log(`📋 Words listesi istendi - Sayfa: ${page}, Limit: ${limit}`);

    // Toplam kelime sayısını al
    const { count: totalCount, error: countError } = await req.supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (countError) {
      throw new Error(`Count hatası: ${countError.message}`);
    }

    // Sayfalanmış kelime verilerini al
    const { data: words, error: wordsError } = await req.supabase
      .from('words')
      .select(`
        id, 
        word, 
        meaning_id,
        questions(count)
      `)
      .eq('is_active', true)
      .order('word', { ascending: true })
      .range(offset, offset + limit - 1);

    if (wordsError) {
      throw new Error(`Words hatası: ${wordsError.message}`);
    }

    // Response formatı - sadece gerekli alanlar
    const formattedWords = (words || []).map(word => ({
      id: word.id,
      word: word.word,
      meaning_id: word.meaning_id,
      question_count: word.questions?.[0]?.count || 0
    }));

    // Pagination bilgileri
    const totalPages = Math.ceil(totalCount / limit);

    console.log(`✅ ${formattedWords.length} kelime döndürüldü (Sayfa ${page}/${totalPages})`);

    res.json({
      words: formattedWords,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_items: totalCount,
        items_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Words endpoint hatası:', error);
    res.status(500).json({
      error: 'Kelime listesi alınırken hata oluştu',
      message: error.message
    });
  }
});

module.exports = router;