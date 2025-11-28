export interface Term {
  id: string;
  chapterId: string;
  term: string;
  definition: string;
  aiExplanation?: string;
}

export interface Chapter {
  id: string;
  title: string;
}

// Spaced Repetition State
export interface UserProgress {
  termId: string;
  interval: number; // Days until next review
  repetition: number; // Consecutive successful recalls
  efactor: number; // Easiness factor (SM-2 algorithm)
  nextReviewDate: number; // Timestamp
}

export type Rating = 0 | 1 | 2 | 3 | 4 | 5; 
// 0: Blackout, 1: Incorrect, 2: Hard, 3: Pass, 4: Good, 5: Perfect