import React, { useState, useEffect } from 'react';
import './App.css';
import config from './config';

// GÜNCELLENMIŞ TYPES - YENİ TABLO YAPISINA GÖRE
interface Word {
  id: number;
  word: string;
  meaning_id: number;
  part_of_speech: string;
  meaning_description: string;
  english_example: string;
  turkish_sentence: string;
  turkish_meaning: string;
  initial_difficulty: string;
  final_difficulty: string;
  difficulty_reasoning: string;
  analysis_method: string;
  source: string;
  times_shown: number;
  times_correct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  question_count: number;
}

interface Question {
  id: number;
  word_id: number;
  paragraph: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  words: Word[];
  total: number;
  message?: string;
}

interface QuestionsApiResponse {
  questions: Question[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const App: React.FC = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<keyof Word>('word');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Sayfa boyutu seçenekleri
  const pageSizeOptions = [10, 20, 30, 50];

  // Fetch words and questions from backend
  useEffect(() => {
    Promise.all([fetchWords(), fetchQuestions()]);
  }, []);

  const fetchWords = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${config.API_URL}${config.ENDPOINTS.WORDS}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      setWords(data.words);
      console.log(`✅ ${data.words.length} kelime kombinasyonu yüklendi`);
      
    } catch (err) {
      console.error('❌ Fetch words hatası:', err);
      setError(err instanceof Error ? err.message : 'Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${config.API_URL}${config.ENDPOINTS.QUESTIONS}?limit=1000`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: QuestionsApiResponse = await response.json();
      setQuestions(data.questions || []);
      console.log(`✅ ${data.questions?.length || 0} soru yüklendi`);
      
    } catch (err) {
      console.error('❌ Fetch questions hatası:', err);
    }
  };

  const handleSelectWord = (wordId: number) => {
    const newSelected = new Set(selectedWordIds);
    if (newSelected.has(wordId)) {
      newSelected.delete(wordId);
    } else {
      newSelected.add(wordId);
    }
    setSelectedWordIds(newSelected);
  };

  const handleSelectAll = () => {
    const currentPageWords = getCurrentPageWords();
    if (isAllCurrentPageSelected()) {
      const newSelected = new Set(selectedWordIds);
      currentPageWords.forEach(word => newSelected.delete(word.id));
      setSelectedWordIds(newSelected);
    } else {
      const newSelected = new Set(selectedWordIds);
      currentPageWords.forEach(word => newSelected.add(word.id));
      setSelectedWordIds(newSelected);
    }
  };

  const handleGenerateQuestions = async () => {
    if (selectedWordIds.size === 0) {
      alert('Lütfen en az bir kelime kombinasyonu seçin!');
      return;
    }

    const confirmed = window.confirm(
      `${selectedWordIds.size} kelime kombinasyonu için sorular oluşturulsun mu?\n\n` +
      `⚠️ Bu işlem ${selectedWordIds.size} dakika kadar sürebilir.\n\n` +
      `🤖 Gemini AI ile yeni format soruları oluşturulacak.`
    );
    if (!confirmed) return;

    try {
      setIsGenerating(true);
      console.log(`🚀 ${selectedWordIds.size} kelime kombinasyonu için soru oluşturma başladı...`);

      const response = await fetch(`${config.API_URL}${config.ENDPOINTS.GENERATE_QUESTIONS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wordIds: Array.from(selectedWordIds)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('✅ Soru oluşturma tamamlandı:', result);
      
      const successMsg = `✅ Soru oluşturma tamamlandı!\n\n` +
        `📊 Başarılı: ${result.successful}\n` +
        `❌ Hatalı: ${result.failed}\n` +
        `📈 Başarı oranı: ${result.success_rate}`;
      
      alert(successMsg);
      
      await Promise.all([fetchWords(), fetchQuestions()]);
      setSelectedWordIds(new Set());
      
    } catch (err) {
      console.error('❌ Generate questions hatası:', err);
      alert('❌ Soru oluşturulurken hata: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSort = (field: keyof Word) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof Word) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '⬆️' : '⬇️';
  };

  const sortedWords = [...words].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  // Pagination functions
  const getCurrentPageWords = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedWords.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(sortedWords.length / itemsPerPage);
  };

  const isAllCurrentPageSelected = () => {
    const currentPageWords = getCurrentPageWords();
    return currentPageWords.length > 0 && currentPageWords.every(word => selectedWordIds.has(word.id));
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  // İstatistik hesaplama fonksiyonları
  const getWordsStats = () => {
    const total = words.length;
    const withQuestions = words.filter(w => w.question_count > 0).length;
    const withoutQuestions = total - withQuestions;
    const totalQuestions = words.reduce((sum, w) => sum + w.question_count, 0);
    
    // Part of Speech dağılımı
    const posCount: Record<string, number> = {};
    words.forEach(w => {
      posCount[w.part_of_speech] = (posCount[w.part_of_speech] || 0) + 1;
    });

    // Zorluk dağılımı
    const difficultyCount: Record<string, number> = {};
    words.forEach(w => {
      difficultyCount[w.final_difficulty] = (difficultyCount[w.final_difficulty] || 0) + 1;
    });

    return {
      total,
      withQuestions,
      withoutQuestions,
      totalQuestions,
      posCount,
      difficultyCount
    };
  };

  const getQuestionsStats = () => {
    const total = questions.length;
    const byDifficulty: Record<string, number> = {};
    const byCorrectAnswer: Record<string, number> = {};
    
    questions.forEach(q => {
      byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
      byCorrectAnswer[q.correct_answer] = (byCorrectAnswer[q.correct_answer] || 0) + 1;
    });

    return {
      total,
      byDifficulty,
      byCorrectAnswer
    };
  };

  if (loading) {
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

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <h2>❌ Bağlantı Hatası</h2>
          <p>{error}</p>
          <small>Backend: {config.API_URL}</small>
          <button onClick={() => Promise.all([fetchWords(), fetchQuestions()])}>
            🔄 Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const currentPageWords = getCurrentPageWords();
  const totalPages = getTotalPages();
  const wordsStats = getWordsStats();
  const questionsStats = getQuestionsStats();

  return (
    <div className="app">
      <header className="header">
        <h1>🧠 Question Generator</h1>
        <p>Gemini AI ile İngilizce kelime kombinasyonları için quiz soruları oluşturun</p>
        {process.env.NODE_ENV === 'development' && (
          <small style={{opacity: 0.7}}>Backend: {config.API_URL}</small>
        )}
      </header>

      <nav className="tabs">
        <button className="tab active">
          📋 Kelime Kombinasyonları ({words.length.toLocaleString()})
        </button>
      </nav>

      <main className="main-content">
        {/* 📊 İSTATİSTİK KARTLARI */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {/* Words Tablosu İstatistikleri */}
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{margin: '0 0 1rem 0', color: '#1f2937', fontSize: '1.1rem'}}>
              📚 Words Tablosu
            </h3>
            <div style={{display: 'grid', gap: '0.5rem', fontSize: '0.9rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Toplam Kombinasyon:</span>
                <strong style={{color: '#3b82f6'}}>{wordsStats.total.toLocaleString()}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Sorulu:</span>
                <strong style={{color: '#10b981'}}>{wordsStats.withQuestions.toLocaleString()}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Sorusuz:</span>
                <strong style={{color: '#ef4444'}}>{wordsStats.withoutQuestions.toLocaleString()}</strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Toplam Soru:</span>
                <strong style={{color: '#8b5cf6'}}>{wordsStats.totalQuestions.toLocaleString()}</strong>
              </div>
              
              <hr style={{margin: '0.5rem 0', border: 'none', borderTop: '1px solid #e5e7eb'}} />
              
              <div style={{fontSize: '0.8rem', color: '#6b7280'}}>
                <div><strong>Part of Speech:</strong></div>
                {Object.entries(wordsStats.posCount).map(([pos, count]) => (
                  <div key={pos} style={{display: 'flex', justifyContent: 'space-between', paddingLeft: '0.5rem'}}>
                    <span>{pos}:</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Questions Tablosu İstatistikleri */}
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{margin: '0 0 1rem 0', color: '#1f2937', fontSize: '1.1rem'}}>
              ❓ Questions Tablosu
            </h3>
            <div style={{display: 'grid', gap: '0.5rem', fontSize: '0.9rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Toplam Soru:</span>
                <strong style={{color: '#3b82f6'}}>{questionsStats.total.toLocaleString()}</strong>
              </div>
              
              <hr style={{margin: '0.5rem 0', border: 'none', borderTop: '1px solid #e5e7eb'}} />
              
              <div style={{fontSize: '0.8rem', color: '#6b7280'}}>
                <div><strong>Zorluk Dağılımı:</strong></div>
                {Object.entries(questionsStats.byDifficulty).map(([difficulty, count]) => (
                  <div key={difficulty} style={{display: 'flex', justifyContent: 'space-between', paddingLeft: '0.5rem'}}>
                    <span>{difficulty}:</span>
                    <span>{count}</span>
                  </div>
                ))}
                
                <div style={{marginTop: '0.5rem'}}><strong>Doğru Şık Dağılımı:</strong></div>
                {Object.entries(questionsStats.byCorrectAnswer).map(([answer, count]) => (
                  <div key={answer} style={{display: 'flex', justifyContent: 'space-between', paddingLeft: '0.5rem'}}>
                    <span>Şık {answer}:</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Seçim Durumu */}
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{margin: '0 0 1rem 0', color: '#1f2937', fontSize: '1.1rem'}}>
              ✅ Seçim Durumu
            </h3>
            <div style={{display: 'grid', gap: '0.5rem', fontSize: '0.9rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Seçili Kombinasyon:</span>
                <strong style={{color: selectedWordIds.size > 0 ? '#10b981' : '#6b7280'}}>
                  {selectedWordIds.size.toLocaleString()}
                </strong>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Mevcut Sayfada:</span>
                <span>{currentPageWords.length} kombinasyon</span>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Sayfa:</span>
                <span>{currentPage} / {totalPages}</span>
              </div>
              
              {isGenerating && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  color: '#92400e',
                  textAlign: 'center'
                }}>
                  🔄 Sorular oluşturuluyor...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sayfa Kontrolleri */}
        <div className="pagination-controls" style={{
          marginBottom: '1rem', 
          padding: '1rem', 
          background: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{fontWeight: '500', color: '#374151'}}>Sayfa başına:</span>
            <select 
              value={itemsPerPage} 
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.9rem',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size} madde</option>
              ))}
            </select>
          </div>
          
          <div style={{fontSize: '0.9rem', color: '#6b7280'}}>
            <strong>{itemsPerPage * (currentPage - 1) + 1} - {Math.min(itemsPerPage * currentPage, words.length)}</strong> / {words.length.toLocaleString()} kombinasyon
            {selectedWordIds.size > 0 && (
              <span style={{marginLeft: '1rem', color: '#059669', fontWeight: '600'}}>
                | {selectedWordIds.size} seçili
              </span>
            )}
          </div>
        </div>

        {/* TABLO */}
        <div className="table-container">
          <table className="words-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected()}
                    onChange={handleSelectAll}
                    disabled={isGenerating}
                  />
                </th>
                <th onClick={() => handleSort('word')} className="sortable">
                  Kelime {getSortIcon('word')}
                </th>
                <th onClick={() => handleSort('meaning_id')} className="sortable">
                  Meaning ID {getSortIcon('meaning_id')}
                </th>
                <th onClick={() => handleSort('turkish_meaning')} className="sortable">
                  Türkçe Anlam {getSortIcon('turkish_meaning')}
                </th>
                <th onClick={() => handleSort('part_of_speech')} className="sortable">
                  Tür {getSortIcon('part_of_speech')}
                </th>
                <th>Anlam Açıklaması</th>
                <th>İngilizce Örnek</th>
                <th onClick={() => handleSort('question_count')} className="sortable">
                  Soru Sayısı {getSortIcon('question_count')}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentPageWords.map((word) => (
                <tr key={word.id} className={selectedWordIds.has(word.id) ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedWordIds.has(word.id)}
                      onChange={() => handleSelectWord(word.id)}
                      disabled={isGenerating}
                    />
                  </td>
                  <td className="word-cell">
                    <strong style={{fontSize: '1.1rem', color: '#1f2937'}}>{word.word}</strong>
                  </td>
                  <td style={{textAlign: 'center', fontFamily: 'monospace', color: '#6b7280'}}>
                    {word.meaning_id}
                  </td>
                  <td style={{fontWeight: '500', color: '#059669'}}>
                    {word.turkish_meaning}
                  </td>
                  <td>
                    <span className="pos-tag" style={{
                      background: '#e0e7ff',
                      color: '#3730a3',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {word.part_of_speech}
                    </span>
                  </td>
                  <td style={{maxWidth: '250px', fontSize: '0.85rem', color: '#475569', lineHeight: '1.4'}}>
                    {word.meaning_description}
                  </td>
                  <td style={{maxWidth: '300px', fontSize: '0.85rem', color: '#475569', lineHeight: '1.4'}}>
                    {word.english_example}
                  </td>
                  <td className="count-cell" style={{textAlign: 'center'}}>
                    <span className={`count-badge ${word.question_count > 0 ? 'has-questions' : 'no-questions'}`} style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      background: word.question_count > 0 ? '#dcfce7' : '#fee2e2',
                      color: word.question_count > 0 ? '#166534' : '#991b1b'
                    }}>
                      {word.question_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination" style={{
          marginTop: '1rem', 
          textAlign: 'center',
          padding: '1rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <button 
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 1rem', 
              border: '1px solid #d1d5db', 
              background: currentPage === 1 ? '#f9fafb' : 'white', 
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              borderRadius: '6px',
              color: currentPage === 1 ? '#9ca3af' : '#374151',
              fontWeight: '500'
            }}
          >
            ◀ Önceki
          </button>
          
          {totalPages > 1 && Array.from({length: Math.min(7, totalPages)}, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (currentPage <= 4) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = currentPage - 3 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => goToPage(pageNum)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  background: currentPage === pageNum ? '#6366f1' : 'white',
                  color: currentPage === pageNum ? 'white' : '#374151',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  fontWeight: currentPage === pageNum ? '600' : '500',
                  minWidth: '40px'
                }}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button 
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 1rem', 
              border: '1px solid #d1d5db', 
              background: currentPage === totalPages ? '#f9fafb' : 'white', 
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              borderRadius: '6px',
              color: currentPage === totalPages ? '#9ca3af' : '#374151',
              fontWeight: '500'
            }}
          >
            Sonraki ▶
          </button>
          
          <span style={{
            marginLeft: '1rem', 
            color: '#6b7280',
            fontSize: '0.9rem',
            fontWeight: '500',
            padding: '0.5rem'
          }}>
            Sayfa {currentPage} / {totalPages}
          </span>
        </div>
      </main>

      <div className="action-bar">
        <div className="selection-info">
          <span>
            {selectedWordIds.size > 0 
              ? `${selectedWordIds.size} kombinasyon seçildi` 
              : 'Kombinasyon seçilmedi'
            }
          </span>
          {isGenerating && (
            <div style={{color: '#f59e0b', fontWeight: 'bold'}}>
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