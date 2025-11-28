import React, { useState, useEffect } from 'react';
import { Term } from '../types';
import { CheckCircle2, XCircle, ArrowRight, RefreshCcw, GraduationCap } from 'lucide-react';

interface QuizProps {
  terms: Term[];
  onExit: () => void;
}

type QuestionType = 'multiple-choice' | 'input';

interface Question {
  term: Term;
  type: QuestionType;
  options?: string[]; // For multiple choice
}

// Levenshtein distance for fuzzy matching
const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
};

const checkAnswerSmart = (input: string, correctTerm: string): boolean => {
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const user = normalize(input);
  const target = normalize(correctTerm);
  
  if (!user) return false;
  if (user === target) return true;
  
  // Alternatives array for checking
  const candidates: string[] = [target];

  // 1. Handle parentheses: "Integrated Development Environment (IDE)"
  const inParens = correctTerm.match(/\(([^)]+)\)/g);
  if (inParens) {
    inParens.forEach(p => candidates.push(normalize(p)));
  }
  
  const withoutParens = correctTerm.replace(/\([^)]+\)/g, '').trim();
  if (withoutParens) candidates.push(normalize(withoutParens));

  // 2. Handle slashes: "Term A / Term B"
  if (correctTerm.includes('/')) {
    correctTerm.split('/').forEach(p => candidates.push(normalize(p)));
  }

  // Check exact match against candidates
  if (candidates.includes(user)) return true;

  // 3. Fuzzy matching
  for (const cand of candidates) {
    if (cand.length > 3) { 
       const dist = getLevenshteinDistance(user, cand);
       const allowedErrors = Math.floor(cand.length * 0.25); // 25% tolerance (e.g. 1 error in 4 chars)
       if (dist <= allowedErrors) return true;
    }
  }

  return false;
};

export const Quiz: React.FC<QuizProps> = ({ terms, onExit }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  
  const [inputAnswer, setInputAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    generateQuiz();
  }, [terms]);

  const generateQuiz = () => {
    // 1. Shuffle terms and ensure we have terms to work with
    if (!terms || terms.length === 0) return;

    const shuffled = [...terms].sort(() => 0.5 - Math.random());
    // 2. Pick top 10 (or fewer if not enough terms)
    const selected = shuffled.slice(0, Math.min(10, terms.length));
    
    // 3. Create questions
    const newQuestions: Question[] = selected.map(term => {
      // 50/50 chance for question type
      const type: QuestionType = Math.random() > 0.5 ? 'multiple-choice' : 'input';
      
      let options: string[] = [];
      if (type === 'multiple-choice') {
        const distractors = terms
          .filter(t => t.id !== term.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(t => t.term);
        // Combine and shuffle options
        options = [...distractors, term.term].sort(() => 0.5 - Math.random());
      }

      return { term, type, options };
    });

    setQuestions(newQuestions);
    setCurrentIndex(0);
    setScore(0);
    setShowSummary(false);
    setFeedback(null);
    setInputAnswer('');
    setSelectedOption(null);
  };

  const handleOptionClick = (option: string) => {
    if (feedback) return; // Prevent double clicks
    
    setSelectedOption(option);
    
    const currentQ = questions[currentIndex];
    const isCorrect = option === currentQ.term.term;
    
    if (isCorrect) setScore(s => s + 1);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    
    // Auto advance for multiple choice after short delay
    setTimeout(() => {
      nextQuestion();
    }, 1500); // Increased delay slightly to read answer
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback) return;

    const currentQ = questions[currentIndex];
    const isCorrect = checkAnswerSmart(inputAnswer, currentQ.term.term);
    
    if (isCorrect) setScore(s => s + 1);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(c => c + 1);
      setFeedback(null);
      setInputAnswer('');
      setSelectedOption(null);
    } else {
      setShowSummary(true);
    }
  };

  if (questions.length === 0) return <div className="p-8 text-center text-slate-500">Loading Quiz...</div>;

  if (showSummary) {
    const percentage = Math.round((score / questions.length) * 100);
    let message = "Keep practicing!";
    if (percentage >= 80) message = "Excellent work!";
    else if (percentage >= 60) message = "Good job!";

    return (
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <GraduationCap size={40} />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Quiz Complete!</h2>
        <p className="text-slate-500 mb-6">{message}</p>
        
        <div className="text-6xl font-bold text-blue-600 mb-2">{percentage}%</div>
        <p className="text-slate-400 mb-8">You answered {score} out of {questions.length} correctly.</p>
        
        <div className="flex gap-4 justify-center">
          <button onClick={onExit} className="px-6 py-3 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors">
            Back to Summary
          </button>
          <button onClick={generateQuiz} className="px-6 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center gap-2">
            <RefreshCcw size={18} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-xl mx-auto w-full">
      <div className="mb-6 flex justify-between items-center text-sm text-slate-500 font-medium">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <span>Score: {score}</span>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8 min-h-[400px] flex flex-col relative overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 h-1.5 bg-blue-100 w-full">
          <div 
            className="h-full bg-blue-500 transition-all duration-300" 
            style={{ width: `${((currentIndex) / questions.length) * 100}%` }} 
          />
        </div>

        <div className="flex-1 mt-2">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4 ${currentQ.type === 'multiple-choice' ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
            {currentQ.type === 'multiple-choice' ? 'Multiple Choice' : 'Type the Answer'}
          </span>
          
          <h3 className="text-xl text-slate-800 leading-relaxed font-medium mb-8">
            {currentQ.term.definition}
          </h3>

          {currentQ.type === 'multiple-choice' ? (
            <div className="grid gap-3">
              {currentQ.options?.map((opt, idx) => {
                let btnClass = "w-full p-4 text-left rounded-lg border-2 transition-all font-semibold ";
                if (feedback) {
                  if (opt === currentQ.term.term) btnClass += "border-green-500 bg-green-50 text-green-700";
                  else if (selectedOption === opt && feedback === 'incorrect') btnClass += "border-red-500 bg-red-50 text-red-700"; // Highlight wrong selection
                  else btnClass += "border-slate-100 text-slate-300 opacity-50";
                } else {
                  btnClass += "border-slate-100 hover:border-blue-500 hover:bg-blue-50 text-slate-700";
                }
                
                return (
                  <button 
                    key={idx}
                    disabled={!!feedback}
                    onClick={() => handleOptionClick(opt)}
                    className={btnClass}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleInputSubmit} className="flex flex-col gap-4">
              <input 
                type="text"
                value={inputAnswer}
                onChange={(e) => setInputAnswer(e.target.value)}
                disabled={!!feedback}
                placeholder="Type the term..."
                className={`w-full p-4 text-lg border-2 rounded-lg outline-none transition-colors ${
                  feedback === 'correct' ? 'border-green-500 bg-green-50 text-green-700' :
                  feedback === 'incorrect' ? 'border-red-500 bg-red-50 text-red-700' :
                  'border-slate-200 focus:border-blue-500'
                }`}
                autoFocus
                autoComplete="off"
              />
              {!feedback ? (
                <button 
                  type="submit" 
                  disabled={!inputAnswer.trim()}
                  className="self-end px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Check Answer
                </button>
              ) : (
                <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {feedback === 'incorrect' && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
                      <div className="text-red-600 flex items-center gap-2 font-bold mb-1">
                        <XCircle size={20} />
                        Incorrect
                      </div>
                      <p className="text-slate-600">The correct answer was <strong className="text-slate-900">{currentQ.term.term}</strong></p>
                    </div>
                  )}
                  {feedback === 'correct' && (
                    <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-4">
                      <div className="text-green-600 flex items-center gap-2 font-bold">
                        <CheckCircle2 size={20} />
                        Correct!
                      </div>
                      {/* Show the canonical term even if they got it right, to reinforce spelling */}
                      <p className="text-green-700 mt-1 text-sm">Answer: <strong>{currentQ.term.term}</strong></p>
                    </div>
                  )}
                  <button 
                    type="button" 
                    onClick={nextQuestion}
                    className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                    autoFocus
                  >
                    Next Question <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};