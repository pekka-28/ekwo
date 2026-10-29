// case-timeline.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {timelineSeries,decimal,financeCostPercent,financingRates,defaultChartAccount,dateTicks,type CaseTimeline} from '../src/case-timeline.ts';

test('date labels adapt to the horizon without labelling all sixty months',()=>{
    const ticks=dateTicks('2026-01-01','2031-01-01');
    assert.deepEqual(ticks,['2026-01-01','2027-01-01','2028-01-01','2029-01-01','2030-01-01','2031-01-01']);
    assert.ok(dateTicks('2026-01-01','2026-12-31').length>2);
});

test('chart starts on cash rather than loan liabilities and finance cost uses the outstanding balance',()=>{
    assert.equal(defaultChartAccount([{id:'loan',code:'2400',name:'Bank loans — non-current'},{id:'bank',code:'1010',name:'Business current account'}]),'bank');
    assert.equal(financeCostPercent(decimal('12000'),decimal('120000')),10);
    assert.equal(financeCostPercent(0n,decimal('120000')),0);
    assert.throws(()=>financeCostPercent(1n,0n),/positive/);
});
test('cash-flow interest uses prior outstanding principal, including junior expiry and final payment',()=>{
    const scenario = {
        id:'funding',name:'Funding',status:'Draft',is_applied:false,
        opening:{interest:'9000',senior:'-90000',junior:'-30000'},movements:[
            {account:'senior',date:'2026-02-10',amount:'10000'},
            {account:'interest',date:'2026-03-20',amount:'1250'},
            {account:'junior',date:'2026-03-20',amount:'30000'},
            {account:'interest',date:'2026-04-30',amount:'800'},
            {account:'senior',date:'2026-04-30',amount:'80000'},
            {account:'interest',date:'2026-05-31',amount:'10'},
        ],
    };
    const dates=['2026-02-10','2026-03-20','2026-04-30','2026-05-31'];
    const rates=financingRates(scenario,dates,['interest'],['senior','junior']);
    assert.equal(rates[0],0,'Grace payment has no interest');
    assert.equal(rates[1],1250/110000*100,'Junior repayment uses combined balance before repayment');
    assert.equal(rates[2],1,'Final payment uses remaining senior balance, not zero after repayment');
    assert.equal(rates[3],null,'Interest without principal must not silently become zero');
    const larger=structuredClone(scenario);
    for(const key of Object.keys(larger.opening) as (keyof typeof larger.opening)[]) larger.opening[key]=String(Number(larger.opening[key])*10);
    for(const movement of larger.movements)movement.amount=String(Number(movement.amount)*10);
    assert.deepEqual(financingRates(larger,dates,['interest'],['senior','junior']),rates,'Scaling the funding and cash flows leaves the rate unchanged');
    const deposit={...scenario,opening:{deposit:'10000'},movements:[
        {account:'deposit',date:'2026-02-10',amount:'-1000'},
        {account:'interest',date:'2026-03-20',amount:'-90'},
    ]};
    assert.deepEqual(financingRates(deposit,dates.slice(0,2),['interest'],['deposit']),[0,-1],'Deposit grace and interest received retain their cash-flow direction');
});
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
