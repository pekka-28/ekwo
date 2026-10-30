// fsa-result.ts
// The shared transport reports FSA messages without knowing any transition rules.
export function readFsaResult<T>(data: T): T {
    if (typeof data !== 'object' || data === null || !('fsa' in data)) return data;
    const result = data.fsa;
    if (typeof result !== 'object' || result === null || !('outcome' in result)) return data;
    if (result.outcome === 'report') {
        if (!('message' in result) || typeof result.message !== 'string' || !result.message) {
            throw new Error('The state machine returned an invalid reporting result.');
        }
        throw new Error(result.message);
    }
    return data;
}
