// Splits worked hours by percentage between two rates.
// Example: hoursA=4 @10€, hoursB=3 @12€ -> 57% of hours at 10€, 43% at 12€.
export function computePay(hours, cfg) {
  const total = cfg.hoursA + cfg.hoursB || 1;
  const shareA = cfg.hoursA / total;
  const hA = hours * shareA;
  const hB = hours - hA;
  return { hours, hA, hB, shareA, moneyA: hA * cfg.rateA, moneyB: hB * cfg.rateB, money: hA * cfg.rateA + hB * cfg.rateB };
}

// Shifts are paid on fixed times: start and end are rounded to the
// nearest half hour (12:52 -> 13:00, 13:16 -> 13:30). No overtime.
export const ROUND_MS = 30 * 60 * 1000;
export const roundTime = (ms) => Math.round(ms / ROUND_MS) * ROUND_MS;

// Paid duration in ms for a shift (uses `now` while it is still running)
export function paidMs(shift, now = Date.now()) {
  return Math.max(0, roundTime(shift.end_at ?? now) - roundTime(shift.start_at));
}
