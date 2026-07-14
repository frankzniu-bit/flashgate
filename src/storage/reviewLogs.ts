import type { CardSchedule } from '@flashgate/domain';
import { randomUUID } from 'expo-crypto';
import { getDatabase } from './db';
import type { ReviewMode } from './types';

export function recordReview(
  cardId: string,
  rating: string,
  mode: ReviewMode,
  elapsedMs: number,
  resultingSchedule: CardSchedule,
  reviewedAt: number = Date.now(),
): void {
  getDatabase().runSync(
    'INSERT INTO review_logs (id, card_id, rating, mode, elapsed_ms, reviewed_at, fsrs_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)',
    randomUUID(),
    cardId,
    rating,
    mode,
    elapsedMs,
    reviewedAt,
    JSON.stringify(resultingSchedule),
  );
}
