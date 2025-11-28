import React, { useState, useEffect, useMemo } from 'react';
import { Brain, BookOpen, CheckCircle2, Layers, RotateCcw, Sparkles, Signal, AlertCircle, AlertTriangle, Activity, GraduationCap } from 'lucide-react';
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

export default function App() {
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [sessionDeck, setSessionDeck] = useState<Term[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [quizActive, setQuizActive] = useState(false);

  // Load progress from local storage
  useEffect(() => {
    const saved = localStorage.getItem('cs-flashcards-progress');
    if (saved) {
      try {
        setProgress(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load progress", e);
      }
    }
  }, []);

  // Save progress
  const saveProgress = (newProgress: Record<string, UserProgress>) => {
    setProgress(newProgress);
    localStorage.setItem('cs-flashcards-progress', JSON.stringify(newProgress));
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
      // End of session
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

    setSessionDeck(deck);
    setSelectedChapter(chapterId);
    setQuizActive(false); // Ensure quiz is off when starting a session
    setActiveCardIndex(0);
  };

  const exitSession = () => {
    setSelectedChapter(null);
    setSessionDeck([]);
    setQuizActive(false);
    setActiveCardIndex(0);
  };

  // Get all terms for the current chapter sorted by retention strength (weakest first)
  const chapterReviewList = useMemo(() => {
    if (!selectedChapter) return [];
    
    const terms = TERMS.filter(t => t.chapterId === selectedChapter);
    
    return terms.sort((a, b) => {
      const progA = progress[a.id];
      const progB = progress[b.id];
      
      const intervalA = progA?.interval || 0;
      const intervalB = progB?.interval || 0;
      
      // Sort by interval ascending (weakest memories first)
      return intervalA - intervalB;
    });
  }, [selectedChapter, progress]);

  // Statistics calculation
  const totalCards = TERMS.length;
  const learnedCards = useMemo(() => {
    return Object.values(progress).filter((p: UserProgress) => p.repetition > 0).length;
  }, [progress]);

  const getStrengthColor = (p?: UserProgress) => {
    if (!p) return 'bg-slate-200 text-slate-400'; // New
    
    // If repetition is 0, it means the last review was "Again" or it's new/failed
    if (p.repetition === 0) return 'bg-red-100 text-red-600'; 
    
    // If repetition > 0, we passed. Check interval strength.
    if (p.interval < 4) return 'bg-orange-100 text-orange-600'; // Moderate (Good - 1 day)
    
    // Interval >= 4 (Easy - 4 days, or subsequent reviews)
    return 'bg-green-100 text-green-600'; // Good/Strong
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
      
      <header className="max-w-6xl mx-auto mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white self-start mt-1">
            <Brain size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">9618 CS Vocabulary Flashcards</h1>
            <p className="text-sm text-slate-500">AS Level Computer Science — Made by Luna</p>
            
            {!selectedChapter && (
              <div className="flex flex-wrap gap-4 mt-3 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                  <BookOpen size={14} className="text-blue-500"/>
                  <span>Total Terms: <span className="text-slate-800 font-bold">{totalCards}</span></span>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                  <CheckCircle2 size={14} className="text-green-500"/>
                  <span>Memorized: <span className="text-slate-800 font-bold">{learnedCards}</span></span>
                </div>
              </div>
            )}
          </div>
        </div>
        {selectedChapter && (
           <button 
             onClick={exitSession}
             className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
           >
             Back to Chapters
           </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto">
        {!selectedChapter ? (
          /* Chapter Select View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHAPTERS.map(chapter => {
              const chapterTerms = TERMS.filter(t => t.chapterId === chapter.id);
              const totalTerms = chapterTerms.length;
              const dueCount = chapterTerms.filter(t => isDue(progress[t.id])).length;
              
              // Calculate retention score
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
        ) : quizActive ? (
          /* Quiz View */
          <Quiz 
            terms={TERMS.filter(t => t.chapterId === selectedChapter)} 
            onExit={() => setQuizActive(false)} 
          />
        ) : (
          /* Study Mode View */
          <div className="flex flex-col items-center justify-center">
             {sessionDeck.length > 0 ? (
               /* Active Session */
               <div className="w-full flex flex-col items-center min-h-[60vh]">
                 <div className="w-full max-w-xl flex justify-between items-center mb-6 text-sm text-slate-400">
                    <span>{CHAPTERS.find(c => c.id === selectedChapter)?.title}</span>
                    <span>Card {activeCardIndex + 1} of {sessionDeck.length}</span>
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
               <div className="w-full max-w-2xl mx-auto">
                 <div className="text-center py-10">
                   <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
                     <CheckCircle2 size={32} />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-800 mb-2">Chapter Complete!</h2>
                   <p className="text-slate-500 mb-6">
                     You've reviewed all due cards. Here is your memory status for this chapter.
                   </p>
                   
                   <div className="flex flex-wrap gap-3 justify-center mb-10">
                     <button 
                       onClick={() => exitSession()}
                       className="px-5 py-2 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                     >
                       Choose another chapter
                     </button>
                     <button 
                       onClick={() => selectedChapter && startSession(selectedChapter, true)}
                       className="px-5 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                     >
                       <RotateCcw size={16} />
                       Review All Again
                     </button>
                     <button 
                       onClick={() => setQuizActive(true)}
                       className="px-5 py-2 rounded-lg font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
                     >
                       <GraduationCap size={18} />
                       Start Quiz
                     </button>
                   </div>
                 </div>

                 {/* Mastery List */}
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <h3 className="font-bold text-slate-700">Vocabulary Mastery List</h3>
                     <span className="text-xs text-slate-500">Sorted by retention strength</span>
                   </div>
                   <div className="divide-y divide-slate-100">
                     {chapterReviewList.map(term => {
                       const p = progress[term.id];
                       const colorClass = getStrengthColor(p);
                       const strengthLabel = getStrengthLabel(p);
                       
                       return (
                         <div key={term.id} className="p-5 hover:bg-slate-50 transition-colors">
                           <div className="flex justify-between items-start mb-2">
                             <h4 className="text-lg font-bold text-slate-800">{term.term}</h4>
                             <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${colorClass}`}>
                               <Signal size={12} />
                               {strengthLabel}
                             </div>
                           </div>
                           <p className="text-slate-600 mb-3 text-sm leading-relaxed">{term.definition}</p>
                           {term.aiExplanation && (
                             <div className="flex gap-2 items-start p-3 bg-blue-50 rounded-lg text-sm text-slate-700">
                               <Sparkles size={16} className="text-blue-500 shrink-0 mt-0.5" />
                               <span className="font-light">{term.aiExplanation}</span>
                             </div>
                           )}
                         </div>
                       );
                     })}
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