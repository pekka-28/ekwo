// instrument.ts
// Contract-driven illustrative schedules. No market rates or tax rules inferred.
export interface Instrument {
    id: string;
    name: string;
    currency: string;
    principalMinor: bigint;
    annualRateBps: number;
    startDate: string;
    periods: number;
    frequencyMonths: 1 | 3 | 6 | 12;
    repayment: 'equal-principal' | 'bullet';
    direction: 'borrowing' | 'holding';
    dayCount: 'ACT/365F' | '30E/360';
}
export interface InstrumentFlow {
    id: string;
    instrument: string;
    date: string;
    kind: 'advance' | 'principal' | 'interest';
    cashMinor: bigint;
    outstandingMinor: bigint;
    accrualFrom?: string;
    accrualThrough?: string;
}
function parseDate(value: string): Date {
    const date = new Date(value + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+date) || date.toISOString().slice(0,10) !== value) {
        throw Error('Instrument date must be a valid ISO date');
    }
    return date;
}
const iso = (date: Date) => date.toISOString().slice(0,10);
function periodDate(start: Date, months: number): Date {
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months + 1, 0));
    return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), Math.min(start.getUTCDate(), end.getUTCDate())));
}
export function instrumentSchedule(instrument: Instrument): InstrumentFlow[] {
    const start = parseDate(instrument.startDate);
    if (instrument.principalMinor <= 0n || !Number.isSafeInteger(instrument.annualRateBps)
        || instrument.annualRateBps < 0 || instrument.annualRateBps > 100000
        || !Number.isSafeInteger(instrument.periods) || instrument.periods < 1 || instrument.periods > 600
        || ![1,3,6,12].includes(instrument.frequencyMonths)
        || !['equal-principal','bullet'].includes(instrument.repayment)
        || !['borrowing','holding'].includes(instrument.direction)
        || !['ACT/365F','30E/360'].includes(instrument.dayCount)) throw Error('Unsupported instrument terms');
    const direction = instrument.direction === 'borrowing' ? 1n : -1n;
    const flows: InstrumentFlow[] = [{id:instrument.id+':advance',instrument:instrument.id,date:iso(start),
        kind:'advance',cashMinor:direction*instrument.principalMinor,outstandingMinor:instrument.principalMinor}];
    let outstanding = instrument.principalMinor, previous = start;
    for (let period=1; period<=instrument.periods; period++) {
        const date = periodDate(start, period*instrument.frequencyMonths);
        const days = instrument.dayCount === 'ACT/365F' ? (+date-+previous)/86400000
            : 360*(date.getUTCFullYear()-previous.getUTCFullYear()) + 30*(date.getUTCMonth()-previous.getUTCMonth())
              + Math.min(30,date.getUTCDate())-Math.min(30,previous.getUTCDate());
        const denominator = BigInt(instrument.dayCount==='ACT/365F'?365:360)*10000n;
        const numerator = outstanding*BigInt(instrument.annualRateBps)*BigInt(days);
        const interest = (numerator+denominator/2n)/denominator;
        const principal = period===instrument.periods ? outstanding
            : instrument.repayment==='bullet' ? 0n : instrument.principalMinor/BigInt(instrument.periods);
        flows.push({id:`${instrument.id}:${period}:interest`,instrument:instrument.id,date:iso(date),kind:'interest',
            cashMinor:-direction*interest,outstandingMinor:outstanding,accrualFrom:iso(previous),accrualThrough:iso(date)});
        outstanding -= principal;
        if (principal) flows.push({id:`${instrument.id}:${period}:principal`,instrument:instrument.id,date:iso(date),
            kind:'principal',cashMinor:-direction*principal,outstandingMinor:outstanding});
        previous=date;
    }
    return flows;
}
