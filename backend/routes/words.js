const express = require('express');
const router = express.Router();

// DEBUG: Supabase bağlantısını test et
router.get('/debug', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Supabase connection test...');
    
    // Önce toplam sayı kontrolü
    const { count, error: countError } = await req.supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (countError) {
      console.error('❌ Count error:', countError);
      return res.status(500).json({ error: 'Count hatası', details: countError });
    }

    console.log(`📊 Toplam aktif words sayısı: ${count}`);

    // Şimdi gerçek veriyi çek (limit olmadan)
    const { data: words, error: dataError } = await req.supabase
      .from('words')
      .select('id, word, meaning_id, is_active')
      .eq('is_active', true)
      .order('word', { ascending: true });

    if (dataError) {
      console.error('❌ Data error:', dataError);
      return res.status(500).json({ error: 'Data hatası', details: dataError });
    }

    console.log(`📦 Gelen data length: ${words?.length || 0}`);

    res.json({
      debug: true,
      totalCountFromDB: count,
      actualDataLength: words?.length || 0,
      isLimited: (words?.length || 0) < count,
      firstFew: words?.slice(0, 5).map(w => ({ id: w.id, word: w.word, meaning_id: w.meaning_id })),
      message: words?.length === count ? 'Tüm veri geldi ✅' : '⚠️ Veri kesiliyor, limit var!'
    });

  } catch (error) {
    console.error('❌ Debug hatası:', error);
    res.status(500).json({
      error: 'Debug hatası',
      message: error.message,
      stack: error.stack
    });
  }
});

// GET /api/words - Ana endpoint (geliştirilmiş debug ile)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Words endpoint çağrıldı...');
    
    // Önce count al
    const { count, error: countError } = await req.supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (countError) {
      console.error('❌ Count error:', countError);
      throw countError;
    }

    console.log(`📊 Veritabanında toplam ${count} aktif kelime var`);

    // Veriyi çek
    const { data: wordsData, error: dataError } = await req.supabase
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

    if (dataError) {
      console.error('❌ Data error:', dataError);
      throw dataError;
    }

    console.log(`📦 API'den ${wordsData?.length || 0} kelime geldi`);

    if ((wordsData?.length || 0) < count) {
      console.warn('⚠️ DİKKAT: Gelen veri sayısı, toplam sayıdan az!');
      console.warn(`⚠️ Beklenen: ${count}, Gelen: ${wordsData?.length || 0}`);
    }

    // Format data
    const formattedData = (wordsData || []).map(word => ({
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

    console.log(`✅ ${formattedData.length} kelime formatlandı ve gönderiliyor`);

    res.json({
      words: formattedData,
      total: formattedData.length,
      dbTotal: count,
      isComplete: formattedData.length === count,
      message: `${formattedData.length} kelime getirildi (DB'de toplam: ${count})`
    });

  } catch (error) {
    console.error('❌ Words endpoint hatası:', error);
    res.status(500).json({
      error: 'Words listesi alınırken hata oluştu',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;