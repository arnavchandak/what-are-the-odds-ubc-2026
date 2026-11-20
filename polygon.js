export const CONDITIONAL_TOKENS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const RPC = 'https://polygon.drpc.org';
const OUTCOME_SLOT_COUNT = '0xd42dc0c2'; // getOutcomeSlotCount(bytes32)

export async function readCondition(conditionId, request = fetch) {
  if (typeof conditionId !== 'string' || !/^0x[a-f\d]{64}$/i.test(conditionId)) {
    throw new Error('Invalid market condition.');
  }
  const response = await request(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: CONDITIONAL_TOKENS, data: OUTCOME_SLOT_COUNT + conditionId.slice(2) }, 'latest'],
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error('Polygon RPC is unavailable.');
  const { result, error } = await response.json();
  if (error || typeof result !== 'string' || !/^0x[a-f\d]{64}$/i.test(result)) {
    throw new Error('Polygon returned an invalid contract response.');
  }
  const slots = Number(BigInt(result));
  if (slots === 1 || slots > 256) throw new Error('Invalid outcome count.');
  return slots;
}
