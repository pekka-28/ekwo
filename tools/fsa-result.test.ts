// fsa-result.test.ts
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFsaResult} from '../src/fsa-result.ts';

test('reported FSA outcome uses its configured message without application rules', () => {
    assert.throws(() => readFsaResult({fsa: {outcome: 'report', message: 'A configured explanation.'}}),
        {message: 'A configured explanation.'});
    assert.throws(() => readFsaResult({fsa: {outcome: 'report'}}), /invalid reporting result/);
    assert.equal(readFsaResult('scenario-id'), 'scenario-id');
    const moved = {fsa: {outcome: 'move', state: 'AnyState'}};
    assert.equal(readFsaResult(moved), moved);
});
