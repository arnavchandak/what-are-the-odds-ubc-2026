// Snapshots saved before the outcome picker may omit this optional field.
export function additionalOutcomes(market) {
  return Array.isArray(market.otherOutcomes) ? market.otherOutcomes : [];
}
