// case-timeline.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {timelineSeries,decimal,type CaseTimeline} from '../src/case-timeline.ts';
test('Treasury alternatives share horizon, reconcile journals and expose funding shortfall',async()=>{
    const data=JSON.parse(await readFile(new URL('../examples/naledi-treasury.json',import.meta.url),'utf8')) as CaseTimeline;
    const bank=timelineSeries(data,'bank');
    assert(bank.dates[0]!<'2026-11-01');assert(bank.dates.at(-1)!>'2029-11-01');
    const start=bank.dates.indexOf('2026-11-01');
    assert.equal(bank.series[0]!.values[0],decimal('50000'));
    assert.equal(bank.series[0]!.values[start],decimal('-70000'));
    assert.equal(bank.series[1]!.values[start],decimal('50000'));
    assert.equal(bank.series[2]!.values[start],decimal('50000'));
    for(const series of bank.series)assert.equal(series.values.at(-1),series.values.at(-2));
    assert.ok(bank.series[1]!.values.every(value=>value>0n));
    assert.ok(bank.series[2]!.values.every(value=>value>0n));
    for(const scenario of data.scenarios){
        const byDate=new Map<string,bigint>();for(const movement of scenario.movements)byDate.set(movement.date,(byDate.get(movement.date)??0n)+decimal(movement.amount));
        assert.ok([...byDate.values()].every(sum=>sum===0n));
    }
    assert.ok(timelineSeries(data,'senior').series.every(s=>s.values.at(-1)===0n));
    assert.ok(timelineSeries(data,'junior').series.every(s=>s.values.at(-1)===0n));
    const interest=timelineSeries(data,'interest');
    for(let i=1;i<3;i++)assert.equal(bank.series[0]!.values.at(-1)!-bank.series[i]!.values.at(-1)!,interest.series[i]!.values.at(-1)!);
    assert.throws(()=>decimal('NaN'),/Unsupported/);
    const alone=timelineSeries(data,'bank',false);
    assert.equal(bank.series[0]!.values.at(-1)!-alone.series[0]!.values.at(-1)!,decimal('180000'));
});
