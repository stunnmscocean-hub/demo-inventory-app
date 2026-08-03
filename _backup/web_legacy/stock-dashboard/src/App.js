import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('N/A');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  // API URL (배포 시 수정)
  const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.0.32:18273';

  // 데이터 로드
  const loadStock = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/stock`);
      if (!response.ok) throw new Error('데이터를 가져올 수 없습니다');
      
      const data = await response.json();
      setStockData(data.products || []);
      setLastUpdate(data.last_update || 'N/A');
    } catch (err) {
      setError(err.message);
      console.error('Error loading stock:', err);
    } finally {
      setLoading(false);
    }
  };

  // ERP에서 새 데이터 가져오기
  const fetchFromERP = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/refresh`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('ERP 호출 실패');
      
      const data = await response.json();
      
      // 5초 후 데이터 새로고침
      setTimeout(() => {
        loadStock();
        setRefreshing(false);
      }, 5000);
    } catch (err) {
      setError(err.message);
      setRefreshing(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadStock();
    
    // 10초마다 자동 새로고침
    const interval = setInterval(loadStock, 10000);
    return () => clearInterval(interval);
  }, []);

  // 검색 필터링
  const filteredStock = stockData.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 총 재고 계산
  const totalStock = filteredStock.reduce((sum, item) => sum + item.total_stock, 0);
  const totalReserved = filteredStock.reduce((sum, item) => sum + item.reserved_stock, 0);
  const totalAvailable = filteredStock.reduce((sum, item) => sum + item.available_stock, 0);

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <h1>📦 재고 조회 시스템</h1>
          <p className="subtitle">ERP 실시간 연동</p>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {/* 컨트롤 패널 */}
          <div className="control-panel">
            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 상품명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="button-group">
              <button 
                onClick={loadStock} 
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? '🔄 로딩중...' : '🔄 새로고침'}
              </button>
              
              <button 
                onClick={fetchFromERP} 
                disabled={refreshing}
                className="btn btn-secondary"
              >
                {refreshing ? '⏳ ERP 호출중...' : '📡 ERP 데이터 가져오기'}
              </button>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <h3>총 상품</h3>
                <p className="stat-value">{filteredStock.length.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div className="stat-content">
                <h3>총 재고</h3>
                <p className="stat-value">{totalStock.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">🔒</div>
              <div className="stat-content">
                <h3>예약 재고</h3>
                <p className="stat-value">{totalReserved.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <h3>가용 재고</h3>
                <p className="stat-value">{totalAvailable.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* 상태 바 */}
          <div className="status-bar">
            <span>최종 업데이트: <strong>{lastUpdate}</strong></span>
            {error && <span className="error">⚠️ {error}</span>}
          </div>

          {/* 재고 테이블 */}
          <div className="table-container">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>상품명</th>
                  <th>총 재고</th>
                  <th>예약 재고</th>
                  <th>가용 재고</th>
                  <th>가용률</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      {loading ? '데이터를 불러오는 중...' : '데이터가 없습니다'}
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((item, index) => {
                    const availableRate = item.total_stock > 0 
                      ? ((item.available_stock / item.total_stock) * 100).toFixed(1)
                      : 0;
                    
                    return (
                      <tr key={index}>
                        <td className="product-name">{item.name}</td>
                        <td>{item.total_stock.toLocaleString()}</td>
                        <td className="reserved">{item.reserved_stock.toLocaleString()}</td>
                        <td className="available">{item.available_stock.toLocaleString()}</td>
                        <td>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${availableRate}%` }}
                            />
                            <span className="progress-text">{availableRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>© 2025 재고 조회 시스템 | ERP 연동 대시보드</p>
      </footer>
    </div>
  );
}

export default App;

