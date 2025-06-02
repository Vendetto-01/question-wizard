import React, { useState, useEffect } from 'react';
import './App.css';
import config from './config';

// GÜNCELLENMIŞ TYPES - YENİ TABLO YAPISINA GÖRE
interface Word {
  id: number;
  word: string;
  meaning_id: number;                // YENİ: Anlam ID'si
  part_of_speech: string;
  meaning_description: string;       // YENİ: Anlam açıklaması
  english_example: string;
  turkish_sentence: string;          // YENİ: Türkçe örnek cümle
  turkish_meaning: string;
  initial_difficulty: string;        // YENİ: İlk zorluk
  final_difficulty: string;          // YENİ: Final zorluk  
  difficulty_reasoning: string;      // YENİ: Zorluk gerekçesi
  analysis_method: string;           // YENİ: Analiz metodu
  source: string;
  times_shown: number;
  times_correct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  question_count: number;            // Soru sayısı (hesaplanmış)
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
    case 'gemini-2.0-flash-001':
      return '🤖 Gemini 2.0';
    case 'gemini-1.5-flash':
      return '🤖 Gemini 1.5';
    case 'manual':
      return '✏️ Manuel';
    case 'import':
      return '📥 İmport';
    default:
      return source;
  }
};

// Analiz metodu badge'i için helper
const getAnalysisMethodBadge = (method: string): string => {
  switch (method.toLowerCase()) {
    case 'step-by-step':
      return '🔍 Adım Adım';
    case 'contextual':
      return '📄 Bağlamsal';
    case 'semantic':
      return '🧠 Anlamsal';
    default:
      return method;
  }
};

// Başarı oranı hesaplama helper'ı
const getSuccessRate = (correct: number, shown: number): number => {
  if (shown === 0) return 0;
  return Math.round((correct / shown) * 100);
};

const App: React.FC = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<keyof Word>('word');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filtering states - YENİ
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

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
      console.log(`✅ ${data.words.length} kelime kombinasyonu yüklendi`);
      
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
      const difficultyMatch = difficultyFilter === 'all' || word.final_difficulty === difficultyFilter;
      const sourceMatch = sourceFilter === 'all' || word.source === sourceFilter;
      const methodMatch = methodFilter === 'all' || word.analysis_method === methodFilter;
      return difficultyMatch && sourceMatch && methodMatch;
    });
  };

  // Benzersiz kaynak türlerini al
  const getUniqueSources = (): string[] => {
    const sources = Array.from(new Set(words.map(word => word.source)));
    return ['all', ...sources];
  };

  // Benzersiz analiz metodlarını al
  const getUniqueMethods = (): string[] => {
    const methods = Array.from(new Set(words.map(word => word.analysis_method)));
    return ['all', ...methods];
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
        `📈 Başarı oranı: ${result.success_rate}\n\n` +
        `🎯 Doğru şıklar otomatik olarak belirlendi`;
      
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
          <p>Kelime kombinasyonları yükleniyor...</p>
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
  const uniqueMethods = getUniqueMethods();

  // ✅ DOĞRU KOMBINASYON SAYISI - Filtrelenmiş toplam
  const totalCombinations = words.length;
  const filteredCombinations = filteredWords.length;

  return (
    <div className="app">
      <header className="header">
        <h1>🧠 Question Generator</h1>
        <p>Gemini AI ile İngilizce kelime kombinasyonları için quiz soruları oluşturun</p>
        {process.env.NODE_ENV === 'development' && (
          <small style={{opacity: 0.7}}>Backend: {config.API_URL}</small>
        )}
      </header>

      {/* ✅ SADECE TEK TAB - DİĞER TABLER KALDIRILDI */}
      <nav className="tabs">
        <button className="tab active">
          📋 Kelime Kombinasyonları ({totalCombinations.toLocaleString()})
        </button>
      </nav>

      <main className="main-content">
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
              <span style={{fontWeight: '500', color: '#374151'}}>Final Zorluk:</span>
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

            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <span style={{fontWeight: '500', color: '#374151'}}>Analiz:</span>
              <select 
                value={methodFilter} 
                onChange={(e) => {
                  setMethodFilter(e.target.value);
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
                {uniqueMethods.map(method => (
                  <option key={method} value={method}>
                    {method === 'all' ? 'Tümü' : getAnalysisMethodBadge(method)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{fontSize: '0.9rem', color: '#6b7280', marginLeft: 'auto'}}>
              <strong>{filteredCombinations.toLocaleString()}</strong> kombinasyon ({selectedWordIds.size} seçili)
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
              <strong>{itemsPerPage * (currentPage - 1) + 1} - {Math.min(itemsPerPage * currentPage, filteredWords.length)}</strong> / {filteredWords.length.toLocaleString()} kombinasyon gösteriliyor
              <span style={{marginLeft: '0.5rem', fontSize: '0.8rem', color: '#9ca3af'}}>
                (Sayfa: {currentPage}/{getTotalPages()})
              </span>
              {selectedWordIds.size > 0 && (
                <span style={{marginLeft: '1rem', color: '#059669', fontWeight: '600'}}>
                  | {selectedWordIds.size} kombinasyon seçili
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
                  <th>Anlam Açıklaması</th>
                  <th onClick={() => handleSort('initial_difficulty')} className="sortable">
                    İlk Zorluk {getSortIcon('initial_difficulty')}
                  </th>
                  <th onClick={() => handleSort('final_difficulty')} className="sortable">
                    Final Zorluk {getSortIcon('final_difficulty')}
                  </th>
                  <th>İngilizce Örnek</th>
                  <th>Türkçe Örnek</th>
                  <th onClick={() => handleSort('source')} className="sortable">
                    Kaynak {getSortIcon('source')}
                  </th>
                  <th onClick={() => handleSort('analysis_method')} className="sortable">
                    Analiz {getSortIcon('analysis_method')}
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
                      <div style={{fontSize: '0.8rem', color: '#9ca3af'}}>
                        Meaning ID: {word.meaning_id}
                      </div>
                    </td>
                    <td className="definition-cell">
                      {word.turkish_meaning}
                    </td>
                    <td className="pos-cell">
                      <span className="pos-tag">{word.part_of_speech}</span>
                    </td>
                    <td className="description-cell" style={{maxWidth: '200px', fontSize: '0.9rem', color: '#475569'}}>
                      {word.meaning_description}
                    </td>
                    <td>
                      <span 
                        className="difficulty-badge"
                        style={{
                          background: getDifficultyColor(word.initial_difficulty),
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          textTransform: 'capitalize'
                        }}
                      >
                        {word.initial_difficulty}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="difficulty-badge"
                        style={{
                          background: getDifficultyColor(word.final_difficulty),
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          textTransform: 'capitalize'
                        }}
                      >
                        {word.final_difficulty}
                      </span>
                    </td>
                    <td className="example-cell" style={{maxWidth: '250px', fontSize: '0.85rem', color: '#475569'}}>
                      {word.english_example}
                    </td>
                    <td className="example-cell" style={{maxWidth: '250px', fontSize: '0.85rem', color: '#475569'}}>
                      {word.turkish_sentence}
                    </td>
                    <td>
                      <span style={{fontSize: '0.8rem', color: '#6b7280'}}>
                        {getSourceBadge(word.source)}
                      </span>
                    </td>
                    <td>
                      <span style={{fontSize: '0.8rem', color: '#6b7280'}}>
                        {getAnalysisMethodBadge(word.analysis_method)}
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
              <span style={{marginLeft: '0.5rem', color: '#9ca3af'}