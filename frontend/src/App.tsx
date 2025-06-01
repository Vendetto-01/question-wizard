import React, { useState, useEffect } from 'react';
import './App.css';
import config from './config';

// GÜNCELLENMIŞ TYPES - YENİ TABLO YAPISINA GÖRE
interface Word {
  id: number;
  word: string;
  turkish_meaning: string;          // Eskiden definition vardı
  part_of_speech: string;
  english_example: string;          // YENİ: Örnek cümle
  difficulty: string;               // YENİ: Zorluk seviyesi
  source: string;                   // YENİ: Kaynak bilgisi
  times_shown: number;              // YENİ: Kaç kez gösterildi
  times_correct: number;            // YENİ: Kaç kez doğru cevaplanmış
  is_active: boolean;               // YENİ: Aktif/pasif durumu
  created_at: string;               // YENİ: Oluşturulma zamanı
  updated_at: string;               // YENİ: Güncellenme zamanı
  question_count: number;           // Soru sayısı (hesaplanmış)
}

interface ApiResponse {
  words: Word[];
  total: number;
  message?: string;
}

// Zorluk seviyesi renkleri için helper
const getDifficultyColor = (difficulty: string): string => {
  switch (difficulty.toLowerCase()) {
    case 'beginner':
      return '#10b981'; // Yeşil
    case 'intermediate':
      return '#f59e0b'; // Sarı
    case 'advanced':
      return '#ef4444'; // Kırmızı
    case 'expert':
      return '#8b5cf6'; // Mor
    default:
      return '#6b7280'; // Gri
  }
};

// Kaynak türü badge'i için helper
const getSourceBadge = (source: string): string => {
  switch (source.toLowerCase()) {
    case 'gemini-api':
      return '🤖 Gemini';
    case 'manual':
      return '✏️ Manuel';
    case 'import':
      return '📥 İmport';
    default:
      return source;
  }
};

// Başarı oranı hesaplama helper'ı
const getSuccessRate = (correct: number, shown: number): number => {
  if (shown === 0) return 0;
  return Math.round((correct / shown) * 100);
};

// Tab types
type TabType = 'combinations' | 'words' | 'pos' | 'definitions';

const App: React.FC = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('combinations');
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<keyof Word>('word');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalWords, setTotalWords] = useState(0);

  // Filtering states - YENİ
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Sayfa boyutu seçenekleri
  const pageSizeOptions = [10, 20, 30, 40, 50];

  // Zorluk seviyeleri
  const difficultyLevels = ['all', 'beginner', 'intermediate', 'advanced', 'expert'];

  // Fetch words from backend
  useEffect(() => {
    fetchWords();
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
      setTotalWords(data.total);
      console.log(`✅ ${data.words.length} kelime yüklendi`);
      
    } catch (err) {
      console.error('❌ Fetch words hatası:', err);
      setError(err instanceof Error ? err.message : 'Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Filtrelenmiş kelimeleri döndür
  const getFilteredWords = (): Word[] => {
    return words.filter(word => {
      const difficultyMatch = difficultyFilter === 'all' || word.difficulty === difficultyFilter;
      const sourceMatch = sourceFilter === 'all' || word.source === sourceFilter;
      return difficultyMatch && sourceMatch;
    });
  };

  // Benzersiz kaynak türlerini al - DÜZELTME
  const getUniqueSources = (): string[] => {
    const sources = Array.from(new Set(words.map(word => word.source)));
    return ['all', ...sources];
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
      
      await fetchWords();
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

  const filteredWords = getFilteredWords();
  
  const sortedWords = [...filteredWords].sort((a, b) => {
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

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div>🔄</div>
          <p>Kelimeler yükleniyor...</p>
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
          <button onClick={fetchWords}>
            🔄 Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const currentPageWords = getCurrentPageWords();
  const totalPages = getTotalPages();
  const uniqueSources = getUniqueSources();

  return (
    <div className="app">
      <header className="header">
        <h1>🧠 Question Generator</h1>
        <p>Gemini AI ile İngilizce kelimeler için quiz soruları oluşturun</p>
        {process.env.NODE_ENV === 'development' && (
          <small style={{opacity: 0.7}}>Backend: {config.API_URL}</small>
        )}
      </header>

      <nav className="tabs">
        <button 
          className={`tab ${activeTab === 'combinations' ? 'active' : ''}`}
          onClick={() => setActiveTab('combinations')}
        >
          📋 Kelime Kombinasyonları ({totalWords})
        </button>
        <button 
          className={`tab ${activeTab === 'words' ? 'active' : ''}`}
          onClick={() => setActiveTab('words')}
        >
          📚 Sözcükler
        </button>
        <button 
          className={`tab ${activeTab === 'pos' ? 'active' : ''}`}
          onClick={() => setActiveTab('pos')}
        >
          🏷️ Part of Speech
        </button>
        <button 
          className={`tab ${activeTab === 'definitions' ? 'active' : ''}`}
          onClick={() => setActiveTab('definitions')}
        >
          📝 Tanımlar
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'combinations' && (
          <div className="tab-content">
            {/* YENİ: Filtre Kontrolleri */}
            <div className="filter-controls" style={{
              marginBottom: '1rem', 
              padding: '1rem', 
              background: 'white', 
              borderRadius: '8px', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <span style={{fontWeight: '500', color: '#374151'}}>Zorluk:</span>
                <select 
                  value={difficultyFilter} 
                  onChange={(e) => {
                    setDifficultyFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {difficultyLevels.map(level => (
                    <option key={level} value={level}>
                      {level === 'all' ? 'Tümü' : level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <span style={{fontWeight: '500', color: '#374151'}}>Kaynak:</span>
                <select 
                  value={sourceFilter} 
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {uniqueSources.map(source => (
                    <option key={source} value={source}>
                      {source === 'all' ? 'Tümü' : getSourceBadge(source)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{fontSize: '0.9rem', color: '#6b7280', marginLeft: 'auto'}}>
                <strong>{filteredWords.length}</strong> kelime ({selectedWordIds.size} seçili)
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
                <strong>{itemsPerPage * (currentPage - 1) + 1} - {Math.min(itemsPerPage * currentPage, filteredWords.length)}</strong> / {filteredWords.length} kelime gösteriliyor
                <span style={{marginLeft: '0.5rem', fontSize: '0.8rem', color: '#9ca3af'}}>
                  (Sayfa: {currentPage}/{getTotalPages()})
                </span>
                {selectedWordIds.size > 0 && (
                  <span style={{marginLeft: '1rem', color: '#059669', fontWeight: '600'}}>
                    | {selectedWordIds.size} kelime seçili
                  </span>
                )}
              </div>
            </div>

            {/* YENİ TABLO YAPISI */}
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
                    <th onClick={() => handleSort('turkish_meaning')} className="sortable">
                      Türkçe Anlam {getSortIcon('turkish_meaning')}
                    </th>
                    <th onClick={() => handleSort('part_of_speech')} className="sortable">
                      Tür {getSortIcon('part_of_speech')}
                    </th>
                    <th onClick={() => handleSort('difficulty')} className="sortable">
                      Zorluk {getSortIcon('difficulty')}
                    </th>
                    <th>Örnek Cümle</th>
                    <th onClick={() => handleSort('source')} className="sortable">
                      Kaynak {getSortIcon('source')}
                    </th>
                    <th onClick={() => handleSort('times_shown')} className="sortable">
                      Gösterilme {getSortIcon('times_shown')}
                    </th>
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
                        <strong>{word.word}</strong>
                      </td>
                      <td className="definition-cell">
                        {word.turkish_meaning}
                      </td>
                      <td className="pos-cell">
                        <span className="pos-tag">{word.part_of_speech}</span>
                      </td>
                      <td>
                        <span 
                          className="difficulty-badge"
                          style={{
                            background: getDifficultyColor(word.difficulty),
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}
                        >
                          {word.difficulty}
                        </span>
                      </td>
                      <td className="example-cell" style={{maxWidth: '300px', fontSize: '0.9rem', color: '#475569'}}>
                        {word.english_example}
                      </td>
                      <td>
                        <span style={{fontSize: '0.8rem', color: '#6b7280'}}>
                          {getSourceBadge(word.source)}
                        </span>
                      </td>
                      <td className="count-cell" style={{textAlign: 'center'}}>
                        <div style={{fontSize: '0.9rem'}}>
                          <div>{word.times_shown}</div>
                          {word.times_shown > 0 && (
                            <div style={{fontSize: '0.75rem', color: '#10b981'}}>
                              {getSuccessRate(word.times_correct, word.times_shown)}% doğru
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="count-cell">
                        <span className={`count-badge ${word.question_count > 0 ? 'has-questions' : 'no-questions'}`}>
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
                <span style={{marginLeft: '0.5rem', color: '#9ca3af'}}>
                  (Toplam: {filteredWords.length} kelime)
                </span>
              </span>
            </div>
          </div>
        )}
        
        {activeTab === 'words' && (
          <div className="tab-content">
            <h3>Sözcükler Sekmesi</h3>
            <p>Bu sekme henüz geliştirilecek...</p>
          </div>
        )}
        
        {activeTab === 'pos' && (
          <div className="tab-content">
            <h3>Part of Speech Sekmesi</h3>
            <p>Bu sekme henüz geliştirilecek...</p>
          </div>
        )}
        
        {activeTab === 'definitions' && (
          <div className="tab-content">
            <h3>Tanımlar Sekmesi</h3>
            <p>Bu sekme henüz geliştirilecek...</p>
          </div>
        )}
      </main>

      {activeTab === 'combinations' && (
        <div className="action-bar">
          <div className="selection-info">
            <span>
              {selectedWordIds.size > 0 
                ? `${selectedWordIds.size} kelime seçildi` 
                : 'Kelime seçilmedi'
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
              : `🤖 Seçilenleri Gemini'ye Gönder (${selectedWordIds.size})`
            }
          </button>
        </div>
      )}
    </div>
  );
};

export default App;