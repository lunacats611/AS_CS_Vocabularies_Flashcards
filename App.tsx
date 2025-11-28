import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Brain, BookOpen, CheckCircle2, Layers, RotateCcw, Sparkles, Signal, AlertCircle, AlertTriangle, Activity, GraduationCap, Clock, Shuffle, Play } from 'lucide-react';
import { CHAPTERS, TERMS } from './data';
import { UserProgress, Rating, Term } from './types';
import { calculateNextReview, isDue } from './utils/sm2';
import { Card } from './components/Card';
import { Quiz } from './components/Quiz';

// Styles needed for the 3D flip effect not included in standard Tailwind
const customStyles = `
  .perspective-1000 { perspective: 1000px; }
  .transform-style-3d { transform-style: preserve-3d; }
  .backface-hidden { backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.1); }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.3); border-radius: 4px; }
`;

// Helper to format seconds into "1h 30m" or "45m"
const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Helper for session duration display (e.g. "02:15")
const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

export default function App() {
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [sessionDeck, setSessionDeck] = useState<Term[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [quizActive, setQuizActive] = useState(false);

  // Time Tracking State
  const [totalStudyTime, setTotalStudyTime] = useState(0); // In seconds
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentSessionDuration, setCurrentSessionDuration] = useState(0); // For display after finishing
  
  // Mixed Mode State
  const [mixedCount, setMixedCount] = useState(20);

  // Load progress and time from local storage
  useEffect(() => {
    const savedProgress = localStorage.getItem('cs-flashcards-progress');
    const savedTime = localStorage.getItem('cs-flashcards-time');
    
    if (savedProgress) {
      try {
        setProgress(JSON.parse(savedProgress));
      } catch (e) {
        console.error("Failed to load progress", e);
      }
    }
    
    if (savedTime) {
      try {
        setTotalStudyTime(parseInt(savedTime, 10));
      } catch (e) {
        console.error("Failed to load time", e);
      }
    }
  }, []);

  // Save progress
  const saveProgress = (newProgress: Record<string, UserProgress>) => {
    setProgress(newProgress);
    localStorage.setItem('cs-flashcards-progress', JSON.stringify(newProgress));
  };

  // Save time
  const saveTime = (newTotalTime: number) => {
    setTotalStudyTime(newTotalTime);
    localStorage.setItem('cs-flashcards-time', newTotalTime.toString());
  };

  // Function to finalize time tracking for a session
  const stopSessionTimer = () => {
    if (sessionStartTime) {
      const now = Date.now();
      const sessionSeconds = (now - sessionStartTime) / 1000;
      saveTime(totalStudyTime + sessionSeconds);
      setCurrentSessionDuration(sessionSeconds);
      setSessionStartTime(null);
    }
  };

  const handleRate = (rating: Rating) => {
    if (!selectedChapter || sessionDeck.length === 0) return;

    const currentTerm = sessionDeck[activeCardIndex];
    if (!currentTerm) return; // Safety check

    const currentProgress = progress[currentTerm.id];
    
    // Update long-term progress (SM-2 Algorithm)
    const newTermProgress = calculateNextReview(currentProgress, rating, currentTerm.id);
    const newProgress = { ...progress, [currentTerm.id]: newTermProgress };
    saveProgress(newProgress);

    // Ebbinghaus / Loop Logic:
    // If rating is low (0=Again, 1=Incorrect, 2=Hard), keep it in the current session.
    // We append a copy of this card to the end of the deck so it appears again.
    if (rating < 3) {
      setSessionDeck(prev => [...prev, currentTerm]);
    }

    // Move to next card
    if (activeCardIndex < sessionDeck.length - 1) {
      setActiveCardIndex(prev => prev + 1);
    } else {
      // End of session (Session Complete)
      stopSessionTimer(); // Stop the clock!
      setSessionDeck([]);
      setActiveCardIndex(0);
      // We do NOT set selectedChapter to null here, so we can show the summary screen
    }
  };

  const startSession = (chapterId: string, forceAll: boolean = false) => {
    const chapterTerms = TERMS.filter(t => t.chapterId === chapterId);
    
    let deck: Term[] = [];

    if (forceAll) {
      deck = chapterTerms;
    } else {
      // Filter for cards that are due or new based on current progress
      deck = chapterTerms.filter(term => {
        const termProgress = progress[term.id];
        return isDue(termProgress);
      });
    }

    if (deck.length === 0 && !forceAll) {
       alert("No cards due for this chapter! Try 'Review All' or choose another chapter.");
       return;
    }

    setSessionDeck(deck);
    setSelectedChapter(chapterId);
    setQuizActive(false); 
    setActiveCardIndex(0);
    setSessionStartTime(Date.now()); // Start the clock
  };

  const startMixedSession = () => {
    // 1. Get all terms
    let allTerms = [...TERMS];
    // 2. Shuffle
    allTerms.sort(() => 0.5 - Math.random());
    // 3. Slice N
    const deck = allTerms.slice(0, Math.max(1, Math.min(mixedCount, allTerms.length)));

    setSessionDeck(deck);
    setSelectedChapter('MIXED'); // Special ID for mixed mode
    setQuizActive(false);
    setActiveCardIndex(0);
    setSessionStartTime(Date.now()); // Start the clock
  };

  const exitSession = () => {
    // If user exits early, we still count the time spent
    stopSessionTimer();
    setSelectedChapter(null);
    setSessionDeck([]);
    setQuizActive(false);
    setActiveCardIndex(0);
  };

  // Get all terms for the current chapter (or all terms for mixed) sorted by retention strength
  const chapterReviewList = useMemo(() => {
    if (!selectedChapter) return [];
    
    let terms: Term[] = [];
    if (selectedChapter === 'MIXED') {
      // For mixed mode summary, we prefer showing the cards just reviewed, 
      // but sessionDeck is emptied. Ideally, we shouldn't empty sessionDeck to show summary?
      // Current architecture empties sessionDeck to trigger summary view. 
      // We can use TERMS filtering, but for Mixed mode we don't know which ones unless we tracked them.
      // SIMPLIFICATION: For Mixed mode summary, list ALL terms sorted by strength, or just hide list?
      // Better: Show nothing or top weak terms overall. 
      // Let's show top 10 weakest terms overall for Mixed mode.
      return [...TERMS].sort((a, b) => {
         const progA = progress[a.id]?.interval || 0;
         const progB = progress[b.id]?.interval || 0;
         return progA - progB;
      }).slice(0, 20);
    } else {
      terms = TERMS.filter(t => t.chapterId === selectedChapter);
      return terms.sort((a, b) => {
        const progA = progress[a.id];
        const progB = progress[b.id];
        
        const intervalA = progA?.interval || 0;
        const intervalB = progB?.interval || 0;
        
        return intervalA - intervalB;
      });
    }
  }, [selectedChapter, progress]);

  // Statistics calculation
  const totalCards = TERMS.length;
  const learnedCards = useMemo(() => {
    return Object.values(progress).filter((p: UserProgress) => p.repetition > 0).length;
  }, [progress]);

  const getStrengthColor = (p?: UserProgress) => {
    if (!p) return 'bg-slate-200 text-slate-400'; 
    if (p.repetition === 0) return 'bg-red-100 text-red-600'; 
    if (p.interval < 4) return 'bg-orange-100 text-orange-600'; 
    return 'bg-green-100 text-green-600'; 
  };

  const getStrengthLabel = (p?: UserProgress) => {
    if (!p) return 'New';
    if (p.repetition === 0) return 'Weak';
    if (p.interval < 4) return 'Moderate';
    if (p.interval < 21) return 'Good';
    return 'Strong';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <style>{customStyles}</style>
      
      <header className="max-w-6xl mx-auto mb-8 flex items-center justify-between sticky top-0 bg-slate-50/90 backdrop-blur-sm z-50 py-4 border-b border-slate-200/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white self-start mt-1">
            <Brain size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 hidden md:block">9618 CS Vocabulary Flashcards</h1>
            <h1 className="text-xl font-bold text-slate-800 md:hidden">CS Flashcards</h1>
            <p className="text-sm text-slate-500">AS Level Computer Science — Made by Luna</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            {!selectedChapter && (
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm text-slate-600">
                <Clock size={18} className="text-blue-500" />
                <div className="flex flex-col items-end leading-none">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Time</span>
                    <span className="font-mono font-bold">{formatTime(totalStudyTime)}</span>
                </div>
              </div>
            )}
            
            {selectedChapter && (
            <button 
                onClick={exitSession}
                className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:shadow-md"
            >
                Exit Session
            </button>
            )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto pb-10">
        {!selectedChapter ? (
          <div className="flex flex-col gap-8">
            {/* Stats Overview */}
             <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                  <BookOpen size={16} className="text-blue-500"/>
                  <span>Total Terms: <span className="text-slate-800 font-bold text-sm ml-1">{totalCards}</span></span>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                  <CheckCircle2 size={16} className="text-green-500"/>
                  <span>Memorized: <span className="text-slate-800 font-bold text-sm ml-1">{learnedCards}</span></span>
                </div>
              </div>

            {/* Global Challenge Card */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 md:p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                        <Shuffle size={24} /> Global Challenge
                    </h2>
                    <p className="text-indigo-100 max-w-md">
                        Test your memory across the entire syllabus. We'll pick random cards from all chapters to keep you on your toes.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 px-3">
                        <span className="text-sm font-medium whitespace-nowrap">Quantity:</span>
                        <input 
                            type="number" 
                            min="5" 
                            max={totalCards}
                            value={mixedCount}
                            onChange={(e) => setMixedCount(Number(e.target.value))}
                            className="w-16 bg-white/20 border border-white/30 rounded px-2 py-1 text-center font-bold focus:outline-none focus:bg-white/30 transition-colors"
                        />
                    </div>
                    <button 
                        onClick={startMixedSession}
                        className="w-full sm:w-auto px-6 py-2 bg-white text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Play size={18} fill="currentColor" /> Start Mixed
                    </button>
                </div>
            </div>

            {/* Chapter Select Grid */}
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Layers size={20} className="text-slate-400" /> Chapters
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CHAPTERS.map(chapter => {
                    const chapterTerms = TERMS.filter(t => t.chapterId === chapter.id);
                    const totalTerms = chapterTerms.length;
                    const dueCount = chapterTerms.filter(t => isDue(progress[t.id])).length;
                    
                    const retentionScore = chapterTerms.reduce((sum, t) => {
                        const p = progress[t.id];
                        if (!p || p.repetition === 0) return sum + 0;
                        if (p.interval >= 4) return sum + 1;
                        return sum + 0.7;
                    }, 0) / (totalTerms || 1);

                    const hasStarted = chapterTerms.some(t => progress[t.id]);

                    let StatusIcon = Activity;
                    let statusColor = 'bg-slate-100 text-slate-500 border-slate-200';
                    let statusText = 'Not Started';

                    if (hasStarted) {
                        if (retentionScore < 0.4) {
                        StatusIcon = AlertTriangle;
                        statusColor = 'bg-red-50 text-red-600 border-red-200';
                        statusText = 'Very Difficult';
                        } else if (retentionScore < 0.7) {
                        StatusIcon = AlertCircle;
                        statusColor = 'bg-orange-50 text-orange-600 border-orange-200';
                        statusText = 'Warning';
                        } else {
                        StatusIcon = Signal;
                        statusColor = 'bg-green-50 text-green-600 border-green-200';
                        statusText = 'Good';
                        }
                    }

                    return (
                        <button
                        key={chapter.id}
                        onClick={() => startSession(chapter.id)}
                        className={`relative p-5 rounded-xl shadow-sm border hover:shadow-md transition-all text-left group flex flex-col justify-between h-full ${hasStarted ? 'bg-white' : 'bg-slate-50/50'} ${statusColor.replace('bg-', 'hover:border-')}`}
                        >
                        <div className="w-full">
                            <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md">
                                {chapter.id}
                            </span>
                            {hasStarted && (
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColor}`}>
                                <StatusIcon size={12} />
                                <span>{statusText}</span>
                                </div>
                            )}
                            </div>
                            <h3 className="text-base font-bold text-slate-800 mb-4">{chapter.title.split(' ').slice(1).join(' ')}</h3>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs mt-2 pt-3 border-t border-slate-100 w-full">
                            <div className="flex items-center gap-1 text-slate-500">
                            <Layers size={14} />
                            <span>{totalTerms} Cards</span>
                            </div>
                            {dueCount > 0 ? (
                            <div className="flex items-center gap-1 text-orange-500 font-medium">
                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                <span>{dueCount} due</span>
                            </div>
                            ) : (
                            <div className="flex items-center gap-1 text-green-600 font-medium">
                                <CheckCircle2 size={14} />
                                <span>All Done</span>
                            </div>
                            )}
                        </div>
                        </button>
                    );
                    })}
                </div>
            </div>
          </div>
        ) : quizActive ? (
          /* Quiz View */
          <Quiz 
            terms={selectedChapter === 'MIXED' 
                ? [...TERMS].sort(() => 0.5 - Math.random()).slice(0, 15) // Random subset for quiz if in mixed mode
                : TERMS.filter(t => t.chapterId === selectedChapter)
            } 
            onExit={() => setQuizActive(false)} 
          />
        ) : (
          /* Study Mode View */
          <div className="flex flex-col items-center justify-center pt-4">
             {sessionDeck.length > 0 ? (
               /* Active Session */
               <div className="w-full flex flex-col items-center min-h-[60vh]">
                 <div className="w-full max-w-xl flex justify-between items-center mb-6 text-sm font-medium text-slate-400">
                    <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                        {selectedChapter === 'MIXED' ? 'Global Challenge' : CHAPTERS.find(c => c.id === selectedChapter)?.title}
                    </span>
                    <span>Card {activeCardIndex + 1} / {sessionDeck.length}</span>
                 </div>
                 
                 <Card 
                   term={sessionDeck[activeCardIndex]} 
                   onRate={handleRate} 
                 />
                 
                 {activeCardIndex >= sessionDeck.length - 1 && sessionDeck.length > 5 && (
                    <p className="mt-8 text-sm text-slate-400 italic">Almost done with this session!</p>
                 )}
               </div>
             ) : (
               /* Session Complete / Mastery List View */
               <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="text-center py-10">
                   <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6 shadow-sm">
                     <CheckCircle2 size={40} />
                   </div>
                   <h2 className="text-3xl font-bold text-slate-800 mb-2">Session Complete!</h2>
                   
                   <div className="flex items-center justify-center gap-2 mb-6 text-slate-500">
                     <Clock size={16} />
                     <span>Time spent: </span>
                     <span className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {formatDuration(currentSessionDuration)}
                     </span>
                   </div>

                   <p className="text-slate-500 mb-8 max-w-md mx-auto">
                     {selectedChapter === 'MIXED' 
                        ? "Great job on the random mix! Keep practicing to improve overall retention." 
                        : "You've reviewed all cards for this session. Here is your current mastery status."}
                   </p>
                   
                   <div className="flex flex-wrap gap-3 justify-center mb-12">
                     <button 
                       onClick={() => exitSession()}
                       className="px-6 py-3 rounded-xl font-bold bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                     >
                       Choose Chapter
                     </button>
                     <button 
                       onClick={() => selectedChapter === 'MIXED' ? startMixedSession() : startSession(selectedChapter!, true)}
                       className="px-6 py-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-200"
                     >
                       <RotateCcw size={18} />
                       Review Again
                     </button>
                     <button 
                       onClick={() => setQuizActive(true)}
                       className="px-6 py-3 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-lg shadow-purple-200"
                     >
                       <GraduationCap size={20} />
                       Take Quiz
                     </button>
                   </div>
                 </div>

                 {/* Mastery List */}
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="p-5 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
                     <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Signal size={18} /> 
                        {selectedChapter === 'MIXED' ? 'Weakest Terms (Top 20)' : 'Vocabulary Mastery List'}
                     </h3>
                     <span className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">Sorted by strength</span>
                   </div>
                   <div className="divide-y divide-slate-100">
                     {chapterReviewList.map(term => {
                       const p = progress[term.id];
                       const colorClass = getStrengthColor(p);
                       const strengthLabel = getStrengthLabel(p);
                       
                       return (
                         <div key={term.id} className="p-5 hover:bg-slate-50 transition-colors group">
                           <div className="flex justify-between items-start mb-2">
                             <h4 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{term.term}</h4>
                             <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${colorClass}`}>
                               <Signal size={12} />
                               {strengthLabel}
                             </div>
                           </div>
                           <p className="text-slate-600 mb-3 text-sm leading-relaxed">{term.definition}</p>
                           {term.aiExplanation && (
                             <div className="flex gap-2 items-start p-3 bg-blue-50/50 rounded-lg text-sm text-slate-700">
                               <Sparkles size={16} className="text-blue-500 shrink-0 mt-0.5" />
                               <span className="font-light">{term.aiExplanation}</span>
                             </div>
                           )}
                         </div>
                       );
                     })}
                     {chapterReviewList.length === 0 && (
                        <div className="p-8 text-center text-slate-400 italic">
                            No terms to display.
                        </div>
                     )}
                   </div>
                 </div>
               </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}