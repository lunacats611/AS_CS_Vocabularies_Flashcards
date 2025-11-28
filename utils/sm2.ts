import { UserProgress, Rating } from '../types';

export const calculateNextReview = (
  currentProgress: UserProgress | undefined,
  rating: Rating,
  termId: string
): UserProgress => {
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Default start state
  let repetition = 0;
  let interval = 0;
  let efactor = 2.5;

  if (currentProgress) {
    repetition = currentProgress.repetition;
    interval = currentProgress.interval;
    efactor = currentProgress.efactor;
  }

  if (rating >= 3) {
    // Correct response
    if (repetition === 0) {
      // If rated Easy (5), give a head start of 4 days (matching UI).
      // If rated Good (3) or Pass, default to 1 day.
      interval = rating === 5 ? 4 : 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
  } else {
    // Incorrect response
    repetition = 0;
    interval = 1;
  }

  // Calculate new Easiness Factor
  efactor = efactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (efactor < 1.3) efactor = 1.3;

  const nextReviewDate = Date.now() + (interval * oneDay);

  return {
    termId,
    repetition,
    interval,
    efactor,
    nextReviewDate
  };
};

export const isDue = (progress?: UserProgress): boolean => {
  if (!progress) return true; // New card is always due
  return Date.now() >= progress.nextReviewDate;
};