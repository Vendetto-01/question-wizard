import React, { useState, useEffect } from 'react';
import './App.css';
import config from './config';

// Types
interface Word {
  id: number;
  word: string;
  part_of_speech: string;
  definition: string;
  question_count: number;
}

interface ApiResponse {
  words: Word[];
  total: number;
}

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
      console.log(`✅ ${data.words.length} kelime yüklendi`);
      
    } catch (err) {
      console.error('❌ Fetch words hatası:', err);
      setError(err instanceof Error ? err.message : 'Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
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
    if (selectedWordIds.size === words.length) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(words.map(word => word.id)));
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
      
      // Başarı mesajı
      const successMsg = `✅ Soru oluşturma tamamlandı!\n\n` +
        `📊 Başarılı: ${result.successful}\n` +
        `❌ Hatalı: ${result.failed}\n` +
        `📈 Başarı oranı: ${result.success_rate}`;
      
      alert(successMsg);
      
      // Refresh the data and clear selection
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
          📋 Üçlü Kombinasyonlar ({words.length})
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
            <div className="table-container">
              <table className="words-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selectedWordIds.size === words.length && words.length > 0}
                        onChange={handleSelectAll}
                        disabled={isGenerating}
                      />
                    </th>
                    <th onClick={() => handleSort('word')} className="sortable">
                      Kelime {getSortIcon('word')}
                    </th>
                    <th onClick={() => handleSort('part_of_speech')} className="sortable">
                      Tür {getSortIcon('part_of_speech')}
                    </th>
                    <th onClick={() => handleSort('definition')} className="sortable">
                      Tanım {getSortIcon('definition')}
                    </th>
                    <th onClick={() => handleSort('question_count')} className="sortable">
                      Soru Sayısı {getSortIcon('question_count')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWords.map((word) => (
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
                      <td className="pos-cell">
                        <span className="pos-tag">{word.part_of_speech}</span>
                      </td>
                      <td className="definition-cell">
                        {word.definition}
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