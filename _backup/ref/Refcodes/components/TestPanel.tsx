import React, { useState } from 'react';

interface TestResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
}

const TestPanel: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('dpommusic@gmail.com');

  const GAS_URL = process.env.REACT_APP_GAS_URL || 'https://script.google.com/macros/s/AKfycbwkjKUvRAdvNV5trMlSOABVx_Ql7Ma6zg7tgUizyhOV9oYs3P3oOaRNhIcTyaSeEkEAuQ/exec';

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setResults([]);
  };

  // [Step 1] GAS 기본 연결 테스트
  const testPing = async () => {
    setLoading(true);
    try {
      console.log('[Step 1] Testing GAS connection...');
      const response = await fetch(`${GAS_URL}?action=ping`);
      const data = await response.json();
      
      addResult({
        step: 'Step 1: Ping Test',
        success: data.success,
        data: data
      });
      
      console.log('[Step 1] Result:', data);
    } catch (error: any) {
      addResult({
        step: 'Step 1: Ping Test',
        success: false,
        error: error.message
      });
      console.error('[Step 1] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // [Step 2] ACL 체크 테스트
  const testACL = async () => {
    setLoading(true);
    try {
      console.log('[Step 2] Testing ACL with email:', testEmail);
      const response = await fetch(`${GAS_URL}?action=testACL&email=${encodeURIComponent(testEmail)}`);
      const data = await response.json();
      
      addResult({
        step: 'Step 2: ACL Test',
        success: data.success && data.authorized,
        data: data
      });
      
      console.log('[Step 2] Result:', data);
    } catch (error: any) {
      addResult({
        step: 'Step 2: ACL Test',
        success: false,
        error: error.message
      });
      console.error('[Step 2] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // [Step 3] OAuth URL 생성 테스트
  const testOAuthURL = () => {
    try {
      console.log('[Step 3] Testing OAuth URL generation...');
      const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
      const redirectUri = window.location.origin;
      const scope = 'email profile';
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `access_type=offline&` +
        `prompt=select_account`;
      
      addResult({
        step: 'Step 3: OAuth URL',
        success: true,
        data: {
          clientId,
          redirectUri,
          authUrl: authUrl.substring(0, 100) + '...'
        }
      });
      
      console.log('[Step 3] OAuth URL:', authUrl);
      console.log('Client ID:', clientId);
      console.log('Redirect URI:', redirectUri);
    } catch (error: any) {
      addResult({
        step: 'Step 3: OAuth URL',
        success: false,
        error: error.message
      });
    }
  };

  // 모든 테스트 순차 실행
  const runAllTests = async () => {
    clearResults();
    await testPing();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testACL();
    await new Promise(resolve => setTimeout(resolve, 500));
    testOAuthURL();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6 text-gray-800">OAuth 단계별 테스트</h1>
          
          {/* 환경 변수 표시 */}
          <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-200">
            <h3 className="font-semibold mb-2 text-blue-800">환경 설정</h3>
            <div className="text-sm space-y-1 text-gray-700">
              <div><strong>GAS URL:</strong> {GAS_URL.substring(0, 60)}...</div>
              <div><strong>Client ID:</strong> {process.env.REACT_APP_GOOGLE_CLIENT_ID?.substring(0, 30)}...</div>
            </div>
          </div>

          {/* 테스트 이메일 입력 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              테스트 이메일 (ACL 체크용)
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="dpommusic@gmail.com"
            />
          </div>

          {/* 테스트 버튼들 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={testPing}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Step 1: Ping 테스트
            </button>
            
            <button
              onClick={testACL}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Step 2: ACL 테스트
            </button>
            
            <button
              onClick={testOAuthURL}
              disabled={loading}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              Step 3: OAuth URL 체크
            </button>
            
            <button
              onClick={runAllTests}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              전체 테스트 실행
            </button>
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              결과 초기화
            </button>
          </div>

          {/* 결과 표시 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-gray-800">테스트 결과</h3>
            
            {results.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                테스트를 실행하면 결과가 여기에 표시됩니다.
              </p>
            )}
            
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded border ${
                  result.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">
                    {result.step}
                  </h4>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded ${
                      result.success
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {result.success ? '✓ 성공' : '✗ 실패'}
                  </span>
                </div>
                
                {result.error && (
                  <p className="text-red-600 text-sm mb-2">
                    <strong>Error:</strong> {result.error}
                  </p>
                )}
                
                {result.data && (
                  <pre className="text-xs bg-white p-2 rounded overflow-x-auto border">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {/* 사용 가이드 */}
          <div className="mt-8 p-4 bg-yellow-50 rounded border border-yellow-200">
            <h3 className="font-semibold mb-2 text-yellow-800">테스트 순서</h3>
            <ol className="text-sm space-y-2 text-gray-700 list-decimal list-inside">
              <li><strong>Step 1: Ping</strong> - GAS 서버 연결 확인</li>
              <li><strong>Step 2: ACL</strong> - 이메일이 ACL 시트에 있는지 확인</li>
              <li><strong>Step 3: OAuth URL</strong> - OAuth 설정 확인 (Client ID, Redirect URI)</li>
              <li>모든 테스트가 성공하면 실제 로그인 시도</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPanel;

