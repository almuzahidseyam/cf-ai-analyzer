'use client';
import { useState } from 'react';

export default function Home() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState('');

  const analyzeHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle) return;
    
    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const res = await fetch(`/api/analyze?handle=${encodeURIComponent(handle)}`);
      const data = await res.json();
      
      if (data.success) {
        setAnalysis(data.data);
      } else {
        setError(data.error || 'Failed to analyze handle.');
      }
    } catch (err) {
      setError('Network error. Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0f172a] min-h-[calc(100vh-64px)] text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            Level up your <span className="text-blue-400">Codeforces</span> Rating
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Our AI analyzes your recent failed submissions (WA/TLE), identifies your weak topics like DP or Graph Theory, and recommends 5 personalized problems to solve.
          </p>
          
          <form onSubmit={analyzeHandle} className="flex justify-center max-w-md mx-auto relative">
            <input 
              type="text" 
              placeholder="Enter Codeforces Handle..." 
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full px-6 py-4 bg-[#1e293b] border border-gray-600 rounded-l-lg focus:outline-none focus:border-blue-500 text-lg placeholder-gray-500"
              required
            />
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 px-8 py-4 rounded-r-lg font-bold text-lg hover:bg-blue-700 transition disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </form>
          {error && <p className="text-red-400 mt-4 font-medium">{error}</p>}
        </div>

        {/* Results Section */}
        {analysis && (
          <div className="bg-[#1e293b] rounded-xl border border-gray-700 p-8 shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
              <h2 className="text-2xl font-bold">Analysis for <span className="text-blue-400">{analysis.handle}</span></h2>
              <span className="bg-gray-800 text-gray-300 px-4 py-2 rounded-full text-sm font-semibold">Current Rating: {analysis.rating}</span>
            </div>
            
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-3 text-red-400 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Identified Weaknesses
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-wrap bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                {analysis.weakness_analysis}
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4 text-green-400 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Recommended Practice Problems
              </h3>
              <div className="grid gap-4">
                {analysis.recommendations.map((prob: any, idx: number) => (
                  <a key={idx} href={prob.link} target="_blank" className="block p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 transition group">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-lg font-bold group-hover:text-blue-400 transition">{prob.name}</h4>
                      <span className="text-sm font-mono text-yellow-400">Rating: {prob.rating || 'N/A'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {prob.tags.map((tag: string, tIdx: number) => (
                        <span key={tIdx} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">{tag}</span>
                      ))}
                    </div>
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
