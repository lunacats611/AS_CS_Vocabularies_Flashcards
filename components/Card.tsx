import React, { useState, useEffect } from 'react';
import { Term } from '../types';
import { RotateCw, Sparkles, X, AlertCircle, Check, ThumbsUp } from 'lucide-react';

interface CardProps {
  term: Term;
  onRate: (rating: 0 | 1 | 2 | 3 | 4 | 5) => void;
}

export const Card: React.FC<CardProps> = ({ term, onRate }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip state when term changes
  useEffect(() => {
    setIsFlipped(false);
  }, [term]);

  return (
    <div className="w-full max-w-xl mx-auto perspective-1000">
      <div 
        className={`relative w-full min-h-[24rem] transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
      >
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden bg-white border-2 border-blue-100 rounded-xl shadow-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-xl transition-shadow"
             onClick={() => setIsFlipped(true)}>
           <span className="text-xs font-bold tracking-wider text-blue-500 uppercase mb-4">Term</span>
           <h2 className="text-3xl font-bold text-slate-800">{term.term}</h2>
           <p className="mt-8 text-sm text-slate-400 flex items-center gap-2">
             <RotateCw size={16} /> Tap to flip
           </p>
        </div>

        {/* Back */}
        <div 
          className="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-800 rounded-xl shadow-lg p-8 flex flex-col text-center overflow-y-auto custom-scrollbar cursor-pointer"
          onClick={() => setIsFlipped(false)}
        >
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-xs font-bold tracking-wider text-blue-300 uppercase mb-2">Definition</span>
            <p className="text-xl text-white leading-relaxed mb-6">{term.definition}</p>
            
            {term.aiExplanation && (
              <div className="mt-4 pt-4 border-t border-slate-600 w-full">
                <div className="flex items-center justify-center gap-2 text-yellow-400 mb-2">
                  <Sparkles size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">AI Explanation</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  {term.aiExplanation}
                </p>
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-500 flex items-center justify-center gap-1 opacity-75">
             <RotateCw size={12} /> Tap to flip back
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className={`mt-8 grid grid-cols-4 gap-3 transition-opacity duration-300 ${isFlipped ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => onRate(1)}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 hover:scale-105 transition-all shadow-sm"
        >
          <X size={20} />
          <span className="font-bold text-xs uppercase tracking-wide">Again</span>
        </button>
        
        <button
          onClick={() => onRate(2)}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-100 text-orange-600 hover:bg-orange-200 hover:scale-105 transition-all shadow-sm"
        >
          <AlertCircle size={20} />
          <span className="font-bold text-xs uppercase tracking-wide">Hard</span>
        </button>

        <button
          onClick={() => onRate(3)}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 hover:scale-105 transition-all shadow-sm"
        >
          <Check size={20} />
          <span className="font-bold text-xs uppercase tracking-wide">Good</span>
        </button>

        <button
          onClick={() => onRate(5)}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 hover:scale-105 transition-all shadow-sm"
        >
          <ThumbsUp size={20} />
          <span className="font-bold text-xs uppercase tracking-wide">Easy</span>
        </button>
      </div>
    </div>
  );
};