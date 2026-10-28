// instrument.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {instrumentSchedule,type Instrument} from '../src/instrument.ts';
const loan:Instrument={id:'loan',name:'Test loan',currency:'ZAR',principalMinor:12000000n,annualRateBps:1200,startDate:'2026-11-01',
    periods:12,frequencyMonths:1,repayment:'equal-principal',direction:'borrowing',dayCount:'ACT/365F'};
test('principal amortises exactly, interest follows outstanding principal and future dates',()=>{
    const flows=instrumentSchedule(loan);
    assert.equal(flows[1]!.cashMinor,-118356n); // R120,000 * 12% * 30/365.
    assert.equal(flows.filter(f=>f.kind==='principal').reduce((sum,f)=>sum+f.cashMinor,0n),-12000000n);
    assert.equal(flows.at(-1)!.outstandingMinor,0n);
    assert.equal(flows.at(-1)!.date,'2027-11-01');
    assert.deepEqual(instrumentSchedule(loan),flows);
    assert.equal(new Set(flows.map(f=>f.id)).size,flows.length);
});
test('held bond coupons reverse the borrowing direction; bullet remains until maturity',()=>{
    const flows=instrumentSchedule({...loan,direction:'holding',repayment:'bullet',frequencyMonths:6,periods:2});
    assert.equal(flows[0]!.cashMinor,-12000000n);
    assert.ok(flows.filter(f=>f.kind==='interest').every(f=>f.cashMinor>0n));
    assert.equal(flows.filter(f=>f.kind==='principal').length,1);
    assert.equal(flows.at(-1)!.cashMinor,12000000n);
});
test('calendar and contract bounds: leap day, month-end, residual cents, invalid terms',()=>{
    const flows=instrumentSchedule({...loan,startDate:'2028-01-31',periods:3,principalMinor:100n});
    assert.equal(flows[1]!.date,'2028-02-29');
    assert.equal(flows[3]!.date,'2028-03-31');
    assert.equal(flows.at(-1)!.outstandingMinor,0n);
    assert.deepEqual(flows.filter(f=>f.kind==='principal').map(f=>f.cashMinor),[-33n,-33n,-34n]);
    assert.throws(()=>instrumentSchedule({...loan,startDate:'2026-02-30'}),/valid ISO/);
    assert.throws(()=>instrumentSchedule({...loan,periods:0}),/Unsupported/);
    const zero=instrumentSchedule({...loan,annualRateBps:0});
    assert.ok(zero.filter(f=>f.kind==='interest').every(f=>f.cashMinor===0n));
});
