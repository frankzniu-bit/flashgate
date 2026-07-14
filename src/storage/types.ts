import type { CardSchedule } from '@flashgate/domain';

export type DeckSource = 'manual' | 'csv' | 'quizlet' | 'knowt' | 'anki';
export type ReviewMode = 'gate' | 'study';

export interface Deck {
  id: string;
  name: string;
  createdAt: Date;
  newCardsPerDay: number;
  source: DeckSource;
}

export interface DeckCard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  schedule: CardSchedule;
  suspended: boolean;
}

export interface ReviewLogEntry {
  id: string;
  cardId: string;
  rating: string;
  mode: ReviewMode;
  elapsedMs: number;
  reviewedAt: Date;
}

export interface Guard {
  id: string;
  appRef: string;
  platform: string;
  dailyLimitMin: number;
  deckId: string | null;
  tollCards: number;
  grantMinutes: number;
  escalationOn: boolean;
  paused: boolean;
}

export interface GrantRecord {
  id: string;
  guardId: string;
  grantedAt: Date;
  expiresAt: Date;
}
