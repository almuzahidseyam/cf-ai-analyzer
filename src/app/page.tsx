'use client';
import { useEffect, useRef, useState } from 'react';
import type { Analysis } from '../lib/types';

export default function Home() {
  const [handle,setHandle]=useState(''), [accessKey,setAccessKey]=useState('');
  const [loading,setLoading]=useState(false), [error,setError]=useState('');
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>active.current?.abort(),[]);
  async function analyze(event:React.FormEvent) {
    event.preventDefault(); if(active.current)return;
    const controller=new AbortController();active.current=controller;
    setLoading(true);setError('');setAnalysis(null);
    try {
      const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+accessKey},body:JSON.stringify({handle:handle.trim()}),signal:controller.signal});
      const result=await response.json();
      if(!response.ok || !result.success)throw new Error(result.error || 'Analysis could not be completed.');
      setAnalysis(result.data);
    } catch(error) {
      setError(controller.signal.aborted?'Analysis canceled. A submitted attempt may still count toward the limit.':error instanceof Error?error.message:'Could not reach the server. Please try again.');
    } finally {active.current=null;setLoading(false);}
  }
  return <main>
    <header className="intro"><p className="eyebrow">Private preview</p><h1>A clearer next step<br/>for your practice.</h1>
      <p>Explore patterns in your latest Codeforces submissions and find a small set of problems to work on next.</p>
    </header>
    <section className="panel" aria-labelledby="start-title"><h2 id="start-title">Review a handle</h2>
      <form onSubmit={analyze}>
        <div className="fields"><div><label htmlFor="handle">Codeforces handle</label><input id="handle" value={handle} onChange={e=>setHandle(e.target.value)} maxLength={50} required disabled={loading} autoCapitalize="none" autoCorrect="off" placeholder="e.g. tourist"/></div>
        <div><label htmlFor="access-key">Owner access key</label><input id="access-key" type="password" value={accessKey} onChange={e=>setAccessKey(e.target.value)} required minLength={32} disabled={loading} autoComplete="off" aria-describedby="key-help"/></div></div>
        <p className="small" id="key-help">Ask the owner for access. The app keeps this key only in this page’s memory.</p>
        <p className="small">Submitting shares your public handle, rating, recent topic counts and candidate problems with Google Gemini when an AI note is needed. Failed attempts also count toward the server’s daily limit.</p>
        <div className="actions"><button disabled={loading} type="submit">{loading?'Reviewing submissions…':'Review submissions'}</button>{loading && <button type="button" className="secondary" onClick={()=>active.current?.abort()}>Cancel</button>}</div>
      </form>
      <p role="status" aria-live="polite" className="small">{loading?'This can take up to 80 seconds.':''}</p>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
    {analysis && <section className="results" aria-labelledby="result-title">
      <div className="result-heading"><h2 id="result-title">Practice notes for {analysis.handle}</h2><span>Rating {analysis.rating ?? 'unrated'}</span></div>
      <p className="small">Based on {analysis.sampleSize} recent submissions, up to 100. Accepted problems are excluded only within this sample; an older solve may appear again.</p>
      <div className="panel"><h3>{analysis.usedAI?'AI-generated practice note':'Sample overview'}</h3><p>{analysis.note}</p>
        {analysis.topics.length>0 && <><h3>Tags on unresolved failed problems</h3><ul className="topics">{analysis.topics.map(topic=><li key={topic.name}>{topic.name} <span>{topic.count} {topic.count===1?'problem':'problems'}</span></li>)}</ul></>}
        <p className="small">Repeated attempts on one problem count once. A recent failure does not establish a weakness or predict your rating.</p>
      </div>
      <h3>Suggested practice</h3>
      {analysis.recommendations.length===0?<p>No verified problems matched this sample’s practice range.</p>:<ol className="problems">{analysis.recommendations.map(problem=><li key={problem.id}><a href={problem.link} target="_blank" rel="noopener noreferrer">{problem.contestId}{problem.index} · {problem.name}</a><span className="difficulty">{problem.rating}</span><p className="small">{problem.tags.join(' · ')}</p></li>)}</ol>}
      <p className="small">Problem names, ratings and links come from the Codeforces catalog. AI selects from that checked list; its advice can still be imperfect.</p>
    </section>}
    <footer>Built for thoughtful practice. This project is independent of Codeforces.</footer>
  </main>;
}
