const DAY_MS = 86_400_000;

export const DEFAULT_RANGE = '7D';
export const MAX_PLOTTED = 5;
export const RANGES = {
  '24H': { duration: DAY_MS, gemini: '15m', polymarket: '1d', minutes: 15 },
  '7D': { duration: 7 * DAY_MS, gemini: '1hr', polymarket: '1w', minutes: 60 },
  '30D': { duration: 30 * DAY_MS, gemini: '6hr', polymarket: '1m', minutes: 360 },
};
