import React, { useState, useEffect } from 'react';
import './App.css';
import config from './config';

// Minimal Types - Sadece gerekli alanlar
interface Word {
  id: number;
  word: string;
  meaning_id: number;
  question_count: number;
}

interface DatabaseInfo {
  words_table: {
    total_rows: number;
    columns: string[];
    column_count: number;
  };
  questions_table: {
    total_rows: number;
    columns: string[];
    column_count: number;
  };
}

interface WordsResponse {
  words: Word[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

const App: React.FC = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<WordsResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch database info
  const fetchDatabaseInfo = async () => {
    try {
      const response = await fetch(`${config.API_URL}${config.ENDPOINTS.DATABASE_INFO}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      setDatabaseInfo(data);
      console.log('✅ Database info yüklendi');
    } catch (err) {
      console.error('❌ Database info hatası:', err);
    }
  };

  // Fetch words with pagination
  const fetchWords = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${config.API_URL}${config.ENDPOINTS.WORDS}?page=${page}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data: WordsResponse = await response.json();
      setWords(data.words);
      setPagination(data.pagination);
      setCurrentPage(page);
      
      console.log(`✅ Sayfa ${page}: ${data.words.length} kelime yüklendi`);
    } catch (err) {
      console.error('❌ Words fetch hatası:', err);
      setError(err instanceof Error ? err.message : 'Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    Promise.all([fetchDatabaseInfo(), fetchWords(1)]);
  }, []);

  // Handle word selection
  const handleSelectWord = (wordId: number) => {
    const newSelected = new Set(selectedWordIds);
    if (newSelected.has(wordId)) {
      newSelected.delete(wordId);
    } else {
      newSelected.add(wordId);
    }
    setSelectedWordIds(newSelected);
  };

  // Handle select all on current page
  const handleSelectAllPage = () => {
    const currentPageWordIds = words.map(w => w.id);
    const newSelected = new Set(selectedWordIds);
    
    const allCurrentSelected = currentPageWordIds.every(id => newSelected.has(id));
    
    if (allCurrentSelected) {
      // Deselect all current page
      currentPageWordIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all current page
      currentPageWordIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedWordIds(newSelected);
  };

  // Generate questions
  const handleGenerateQuestions = async () => {
    if (selectedWordIds.size === 0) {
      alert('Lütfen en az bir kelime seçin!');
      return;
    }

    const confirmed = window.confirm(
      `${selectedWordIds.size} kelime için sorular oluşturulsun mu?\n\n` +
      `⚠️ Bu işlem ${selectedWordIds.size} dakika kadar sürebilir.`
    );
    if (!confirmed) return;

    try {
      setIsGenerating(true);
      console.log(`🚀 ${selectedWordIds.size} kelime için soru oluşturma başladı...`);

      const response = await fetch(`${config.API_URL}${config.ENDPOINTS.GENERATE_QUESTIONS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordIds: Array.from(selectedWordIds) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      const successMsg = `✅ Soru oluşturma tamamlandı!\n\n` +
        `📊 Başarılı: ${result.successful}\n` +
        `❌ Hatalı: ${result.failed}\n` +
        `📈 Başarı oranı: ${result.success_rate}`;
      
      alert(successMsg);
      
      // Refresh data
      await Promise.all([fetchDatabaseInfo(), fetchWords(currentPage)]);
      setSelectedWordIds(new Set());
      
    } catch (err) {
      console.error('❌ Generate questions hatası:', err);
      alert('❌ Soru oluşturulurken hata: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Page navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= (pagination?.total_pages || 1)) {
      fetchWords(page);
    }
  };

  if (loading && !words.length) {
    return (
      <div className="app">
        <div className="loading">
          <div>🔄</div>
          <p>Veriler yükleniyor...</p>
          <small>Backend: {config.API_URL}</small>
        </div>
      </div>
    );
  }

  if (error && !words.length) {
    return (
      <div className="app">
        <div className="error">
          <h2>❌ Bağlantı Hatası</h2>
          <p>{error}</p>
          <small>Backend: {config.API_URL}</small>
          <button onClick={() => fetchWords(1)}>🔄 Tekrar Dene</button>
        </div>
      </div>
    );
  }

  const allCurrentPageSelected = words.length > 0 && words.every(w => selectedWordIds.has(w.id));

  return (
    <div className="app">
      <header className="header">
        <h1>🧠 Question Generator</h1>
        <p>Basit soru oluşturma arayüzü</p>
      </header>

      {/* Database Info */}
      {databaseInfo && (
        <div className="database-info">
          <div className="db-card">
            <h3>📚 Words Tablosu</h3>
            <div className="db-stat">
              <span>Toplam Kayıt:</span>
              <strong>{databaseInfo.words_table.total_rows.toLocaleString()}</strong>
            </div>
            <div className="db-stat">
              <span>Sütun Sayısı:</span>
              <strong>{databaseInfo.words_table.column_count}</strong>
            </div>
          </div>
          <div className="db-card">
            <h3>❓ Questions Tablosu</h3>
            <div className="db-stat">
              <span>Toplam Kayıt:</span>
              <strong>{databaseInfo.questions_table.total_rows.toLocaleString()}</strong>
            </div>
            <div className="db-stat">
              <span>Sütun Sayısı:</span>
              <strong>{databaseInfo.questions_table.column_count}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Words List */}
      <div className="words-section">
        <div className="words-header">
          <h3>📋 Kelime Kombinasyonları</h3>
          {pagination && (
            <div className="pagination-info">
              Sayfa {pagination.current_page}/{pagination.total_pages} | 
              Toplam: {pagination.total_items.toLocaleString()} | 
              Seçili: {selectedWordIds.size}
            </div>
          )}
        </div>

        <div className="words-list">
          {/* Select All Header */}
          <div className="word-item" style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={allCurrentPageSelected}
              onChange={handleSelectAllPage}
              disabled={isGenerating}
            />
            <div className="word-info">
              <span>Tümünü Seç/Bırak (Bu Sayfa)</span>
              <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                {words.length} kombinasyon
              </span>
            </div>
          </div>

          {/* Words */}
          {words.map((word) => (
            <div 
              key={word.id} 
              className={`word-item ${selectedWordIds.has(word.id) ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedWordIds.has(word.id)}
                onChange={() => handleSelectWord(word.id)}
                disabled={isGenerating}
              />
              <div className="word-info">
                <div>
                  <span className="word-text">{word.word}</span>
                  <span className="meaning-id"> (meaning_id: {word.meaning_id})</span>
                </div>
                <span className={`question-count ${word.question_count > 0 ? 'has-questions' : 'no-questions'}`}>
                  {word.question_count} soru
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="pagination">
            <button 
              onClick={() => goToPage(currentPage - 1)}
              disabled={!pagination.has_prev}
            >
              ◀ Önceki
            </button>
            
            <button className="current-page">
              {pagination.current_page}
            </button>
            
            <button 
              onClick={() => goToPage(currentPage + 1)}
              disabled={!pagination.has_next}
            >
              Sonraki ▶
            </button>
            
            <span style={{ marginLeft: '1rem', color: '#6b7280' }}>
              / {pagination.total_pages} sayfa
            </span>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <div className="selection-info">
          {selectedWordIds.size > 0 
            ? `${selectedWordIds.size} kombinasyon seçildi` 
            : 'Kombinasyon seçilmedi'
          }
          {isGenerating && (
            <div style={{ color: '#f59e0b', fontWeight: 'bold', marginTop: '0.5rem' }}>
              🔄 Sorular oluşturuluyor...
            </div>
          )}
        </div>
        
        <button 
          onClick={handleGenerateQuestions}
          disabled={selectedWordIds.size === 0 || isGenerating}
          className="generate-btn"
        >
          {isGenerating 
            ? '⏳ Oluşturuluyor...' 
            : `🤖 Sorular Oluştur (${selectedWordIds.size})`
          }
        </button>
      </div>
    </div>
  );
};

export default App;