// case-timeline.ts
export interface TimelineScenario {
    id: string;
    name: string;
    status: string;
    is_applied: boolean;
    opening: Record<string, string>;
    movements: {account: string; date: string; amount: string}[];
}
export interface CaseTimeline {
    case_id: string;
    name: string;
    case_type: string;
    currency: string;
    from: string | null;
    through: string | null;
    basis_at: string;
    basis: string;
    accounts: {id: string; code: string; name: string}[];
    scenarios: TimelineScenario[];
    financing_scenarios?: TimelineScenario[];
    forecast_names?: string[];
    finance_cost_accounts?: string[];
    finance_principal_accounts?: string[];
    context_included?: boolean;
    assumptions?: string[];
}
const scale = 1000000n;
const day = 86400000;

export function decimal(value: string): bigint {
    if (!/^-?\d+(\.\d{1,6})?$/.test(value)) throw Error('Unsupported accounting amount');
    const [whole, fraction = ''] = value.replace('-', '').split('.');
    return (BigInt(whole!) * scale + BigInt(fraction.padEnd(6, '0'))) * (value.startsWith('-') ? -1n : 1n);
}

export function timelineSeries(
    data: CaseTimeline,
    accounts: string | readonly string[],
    includeForecast = true,
) {
    const scenarios = includeForecast ? data.scenarios : data.financing_scenarios ?? data.scenarios;
    if (!data.from || !data.through) return {dates: [] as string[], series: [] as {scenario: TimelineScenario; values: bigint[]}[]};
    // A small, date-proportional margin exposes opening and closing plateaus.
    const margin = Math.max(1, Math.ceil((Date.parse(data.through) - Date.parse(data.from)) / day * .02));
    const before = new Date(Date.parse(data.from) - margin * day).toISOString().slice(0, 10);
    const after = new Date(Date.parse(data.through) + margin * day).toISOString().slice(0, 10);
    const dates = [...new Set([before, data.from, data.through, after,
        ...data.scenarios.flatMap(s => s.movements.map(m => m.date)),
        ...(data.financing_scenarios ?? []).flatMap(s => s.movements.map(m => m.date)),
    ])].sort();
    const chosen = new Set(typeof accounts === 'string' ? [accounts] : accounts);
    return {
        dates,
        series: scenarios.map(scenario => {
            const changes = new Map<string, bigint>();
            for (const movement of scenario.movements) {
                const key = movement.date;
                if (chosen.has(movement.account)) changes.set(key, (changes.get(key) ?? 0n) + decimal(movement.amount));
            }
            let balance = [...chosen].reduce((sum, account) => sum + decimal(scenario.opening[account] ?? '0'), 0n);
            return {scenario, values: dates.map(date => balance += changes.get(date) ?? 0n)};
        }),
    };
}

export function chartBounds(series: {values: bigint[]}[]) {
    // Always use every series in this accounting basis, including hidden lines.
    const values = series.flatMap(s => s.values.map(v => Number(v) / Number(scale)));
    const low = Math.min(0, ...values);
    const high = Math.max(0, ...values);
    return {low, high, span: high - low || 1};
}

export function financeCostPercent(value: bigint, basis: bigint): number {
    if (basis <= 0n) throw Error('Outstanding amount must be positive.');
    return Number(value) / Number(basis) * 100;
}

// Ratios belong to the dated movements, not a contractual or reporting period.
// Read principal before applying the same-date repayment, including the final one.
export function financingRates(scenario: TimelineScenario, dates: readonly string[], interestAccounts: readonly string[], principalAccounts: readonly string[]): (number | null)[] {
    const interest = new Set(interestAccounts), principal = new Set(principalAccounts);
    const balances = new Map(principalAccounts.map(id => [id, decimal(scenario.opening[id] ?? '0')]));
    const movements = new Map<string, TimelineScenario['movements']>();
    for (const movement of scenario.movements) {
        const group = movements.get(movement.date) ?? [];
        group.push(movement); movements.set(movement.date, group);
    }
    return dates.map(date => {
        const group = movements.get(date) ?? [];
        const outstanding = [...balances.values()].reduce((sum, value) => sum + (value < 0n ? -value : value), 0n);
        const cost = group.reduce((sum, movement) => sum + (interest.has(movement.account) ? decimal(movement.amount) : 0n), 0n);
        for (const movement of group) if (principal.has(movement.account))
            balances.set(movement.account, (balances.get(movement.account) ?? 0n) + decimal(movement.amount));
        return cost === 0n ? 0 : outstanding > 0n ? financeCostPercent(cost, outstanding) : null;
    });
}

export function dateTicks(from: string, through: string): string[] {
    const start = Date.parse(from), end = Date.parse(through);
    if (end <= start) return [from];
    const span = (end - start) / day;
    const step = span > 4 * 365 ? 12 : span > 2 * 365 ? 6 : span > 365 ? 3 : span > 120 ? 2 : 1;
    const cursor = new Date(from.slice(0, 7) + '-01');
    cursor.setUTCMonth(cursor.getUTCMonth() + step);
    const ticks = [from];
    while (cursor.getTime() < end) {
        // Keep endpoints legible by leaving room around them.
        if (cursor.getTime() - start > (end - start) * .12 && end - cursor.getTime() > (end - start) * .12)
            ticks.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCMonth(cursor.getUTCMonth() + step);
    }
    ticks.push(through);
    return ticks;
}

export function defaultChartAccount(accounts: CaseTimeline['accounts']): string {
    return accounts.find(a => /current account|funding bank|cash at bank/i.test(a.name))?.id
        ?? accounts.find(a => /bank|cash/i.test(a.name) && !/loan|interest|overdraft|debt/i.test(a.name))?.id
        ?? accounts[0]?.id ?? '';
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    return result;
}
function svg(tag: string, attributes: Record<string, string>) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
}
function fit(select: HTMLSelectElement) {
    select.style.width = '100%';
    select.style.maxWidth = '28rem';
    select.style.minWidth = '0';
}

export function renderCaseTimeline(host: HTMLElement, data: CaseTimeline, loadContext?: (included: boolean) => Promise<void>) {
    host.replaceChildren();
    host.append(element('p', `${data.case_type === 'Other' ? 'Project' : data.case_type} · ${data.currency} · ${data.from ?? 'No dated entries'} — ${data.through ?? 'No dated entries'}`));
    const basis = element('p', data.basis);
    host.append(basis);
    if (data.assumptions?.length) {
        const details = element('details');
        details.append(element('summary', 'Illustrative assumptions'));
        const list = element('ul');
        for (const text of data.assumptions) list.append(element('li', text));
        details.append(list);
        host.append(details);
    }
    if (!data.from || !data.through) {
        host.append(element('p', 'Add dated Scenario journals to analyse this Case.'));
        return;
    }
    const contextLabel = element('label', 'Projection basis ');
    contextLabel.style.display = 'block';
    const context = element('select');
    context.setAttribute('aria-label', 'Projection basis');
    fit(context);
    for (const [value, name] of [['alone', 'Case alone'], ['forecast', 'With selected Forecast/context']]) {
        const option = element('option', name);
        option.value = value!;
        context.append(option);
    }
    context.value = data.context_included === false ? 'alone' : 'forecast';
    context.disabled = !data.financing_scenarios;
    contextLabel.append(context);
    host.append(contextLabel);
    const accountLabel = element('label', 'Account ');
    accountLabel.style.display = 'block';
    const select = element('select');
    select.setAttribute('aria-label', 'Account');
    fit(select);
    const costsLabel = element('label', 'Interest accounts ');
    costsLabel.style.display = 'block';
    const costs = element('select');
    costs.multiple = true;
    costs.size = 3;
    costs.setAttribute('aria-label', 'Finance cost accounts');
    fit(costs);
    const principalLabel = element('label', 'Outstanding funding accounts ');
    principalLabel.style.display = 'block';
    const principal = element('select');
    principal.multiple = true; principal.size = 3;
    principal.setAttribute('aria-label', 'Outstanding funding accounts');
    fit(principal);
    for (const account of data.accounts) {
        const option = element('option', `${account.code} ${account.name}`);
        option.value = account.id;
        select.append(option);
        const cost = option.cloneNode(true) as HTMLOptionElement;
        cost.selected = data.finance_cost_accounts?.length
            ? data.finance_cost_accounts.includes(account.id) : /interest|finance cost/i.test(account.name);
        costs.append(cost);
        const funding = option.cloneNode(true) as HTMLOptionElement;
        funding.selected = data.finance_principal_accounts?.includes(account.id)
            ?? (/loan|borrowing|junior funding|senior funding|overdraft/i.test(account.name) && !/interest|cost|expense/i.test(account.name));
        principal.append(funding);
    }
    select.value = defaultChartAccount(data.accounts);
    accountLabel.append(select);
    host.append(accountLabel);
    const costToggle = element('input');
    costToggle.type = 'checkbox';
    const toggleLabel = element('label');
    toggleLabel.append(costToggle, document.createTextNode(' Show finance cost (right axis)'));
    costsLabel.append(costs);
    costsLabel.hidden = true;
    principalLabel.append(principal); principalLabel.hidden = true;
    host.append(toggleLabel, costsLabel, principalLabel);

    const legend = element('fieldset');
    legend.append(element('legend', 'Scenarios'));
    const enabled = new Set(data.scenarios.map(s => s.id));
    const graph = element('div');
    graph.className = 'case-timeline';
    const tableHost = element('details');
    tableHost.style.overflowX = 'auto';
    tableHost.append(element('summary', 'Account balances by date'));
    const table = element('table');
    tableHost.append(table);
    const colour = (i: number) => `var(--color-series-${i + 1}, ${['#2864b4', '#a04e14', '#388047', '#9a3da4', '#555'][i % 5]})`;
    const moneyFormat = new Intl.NumberFormat(undefined, {style: 'currency', currency: data.currency});
    const money = (value: bigint) => moneyFormat.format(Number(value) / Number(scale));

    const draw = () => {
        graph.replaceChildren();
        table.replaceChildren();
        const includeForecast = context.value === 'forecast';
        basis.textContent = includeForecast
            ? `${data.basis} Selected Forecasts: ${(data.forecast_names ?? []).join(', ') || 'none'}.`
            : 'Case journals and the actual opening position only. Forecasts and other projected Cases are excluded.';
        const all = timelineSeries(data, select.value, includeForecast);
        const costAccounts = Array.from(costs.selectedOptions).map(o => o.value);
        const principalAccounts = Array.from(principal.selectedOptions).map(o => o.value);
        const costData = all.series.map(s => ({scenario:s.scenario, values:financingRates(s.scenario, all.dates, costAccounts, principalAccounts)}));
        const bounds = chartBounds(all.series);
        const costValues=costData.flatMap(s=>s.values.filter((v): v is number => v !== null));
        const costLow=Math.min(0,...costValues),costHigh=Math.max(0,...costValues);
        const costBounds={low:costLow,high:costHigh,span:costHigh-costLow||1};
        const series = all.series.filter(s => enabled.has(s.scenario.id));
        const showCosts = costToggle.checked && costAccounts.length > 0 && principalAccounts.length > 0;
        costsLabel.hidden = !costToggle.checked;
        principalLabel.hidden = !costToggle.checked;
        const width = 1000, height = 360, left = 90, right = showCosts ? 90 : 20, top = 35, bottom = 45;
        const first = Date.parse(all.dates[0]!), last = Date.parse(all.dates.at(-1)!);
        const x = (date: string) => left + (Date.parse(date) - first) / (last - first) * (width - left - right);
        const y = (value: number, b = bounds) => height - bottom - (value - b.low) / b.span * (height - top - bottom);
        const chart = svg('svg', {
            viewBox: `0 0 ${width} ${height}`, role: 'img',
            'aria-label': `Scenario balances: ${select.selectedOptions[0]?.textContent ?? ''}`,
            'data-y-min': String(bounds.low), 'data-y-max': String(bounds.high),
            'data-cost-min': String(costBounds.low), 'data-cost-max': String(costBounds.high),
        });
        chart.setAttribute('style', 'width:100%;height:auto;min-height:220px');
        const label = (text: string, xValue: number, yValue: number, anchor = 'start') => {
            const node = svg('text', {x: String(xValue), y: String(yValue), 'text-anchor': anchor, fill: 'currentColor', 'font-size': '12'});
            node.textContent = text;
            chart.append(node);
        };
        label(`Account balance (${data.currency})`, left, 15);
        if (showCosts) label('Finance cost (%)', width - right, 15, 'end');
        const compact = new Intl.NumberFormat(undefined, {notation: 'compact'});
        for (let i = 0; i <= 4; i++) {
            const value = bounds.low + bounds.span * i / 4;
            chart.append(svg('line', {x1: String(left), x2: String(width - right), y1: String(y(value)), y2: String(y(value)), stroke: 'var(--color-chart-grid, #ddd)'}));
            label(compact.format(value), left - 8, y(value) + 4, 'end');
            if (showCosts) {
                const cost = costBounds.low + costBounds.span * i / 4;
                label(cost.toFixed(1)+'%', width - right + 8, y(cost, costBounds) + 4);
            }
        }
        chart.append(svg('line', {x1: String(left), x2: String(width - right), y1: String(y(0)), y2: String(y(0)), stroke: 'currentColor'}));
        const ticks = dateTicks(data.from!, data.through!);
        for (const date of ticks) {
            const text = new Date(date).toLocaleDateString(undefined, {month:'short',year:'numeric',timeZone:'UTC'});
            label(text, x(date), height - 12, date === ticks[0] ? 'start' : date === ticks.at(-1) ? 'end' : 'middle');
        }
        for (const date of [data.from!, data.through!]) chart.append(svg('line', {
            x1: String(x(date)), x2: String(x(date)), y1: String(top), y2: String(height - bottom),
            stroke: 'var(--color-chart-grid, #ddd)', 'stroke-dasharray': '2 4',
        }));
        const line = (values: readonly (bigint | number | null)[], id: string, name: string, cost: boolean) => {
            let path = '';
            let connected = false;
            values.forEach((value, i) => {
                if (value === null) {connected = false; return;}
                const px = x(all.dates[i]!), py = y(cost?Number(value):Number(value) / Number(scale), cost ? costBounds : bounds);
                path += !connected ? `M${px},${py}` : cost ? `L${px},${py}` : `H${px}V${py}`;
                connected = true;
            });
            const node = svg('path', {d: path, fill: 'none', stroke: colour(data.scenarios.findIndex(s => s.id === id)), 'stroke-width': cost ? '1.8' : '2.5'});
            node.setAttribute('data-scenario',id);node.setAttribute('data-series',cost?'cost':'balance');
            if (cost) node.setAttribute('stroke-dasharray', '5 4');
            const title = svg('title', {});
            title.textContent = name + (cost ? ' — finance costs' : '');
            node.append(title);
            chart.append(node);
        };
        for (const item of series) {
            line(item.values, item.scenario.id, item.scenario.name, false);
            if (showCosts) line(costData.find(s => s.scenario.id === item.scenario.id)!.values, item.scenario.id, item.scenario.name, true);
        }
        graph.append(chart, element('p', 'Balances are debit less credit. The margins carry opening and closing balances without inventing transactions.'));
        if (!series.length) graph.append(element('p', 'Choose a Scenario to display.'));
        if (showCosts) graph.append(element('p', 'Dashed lines: interest at each date ÷ outstanding funding immediately before that date’s repayments × 100. Combined funding uses total interest and total outstanding principal. No contract terms, fixed purchase amount or annualisation are used. Values follow the selected accounts’ journal movements; absent interest is zero. Lines connect observations, not a calculation between them. Only checked Scenarios appear on either axis.'));
        if (showCosts && costData.some(s => enabled.has(s.scenario.id) && s.values.includes(null))) graph.append(element('p', 'Some interest has no corresponding outstanding funding in the selected accounts. Those rates are unavailable and appear as gaps.'));
        if (costToggle.checked && (!costAccounts.length || !principalAccounts.length)) graph.append(element('p', 'Choose the interest and outstanding funding accounts to display the finance cost.'));
        const head = element('thead'), header = element('tr');
        header.append(element('th', 'Date'));
        for (const item of series) {
            header.append(element('th', item.scenario.name));
            if (showCosts) header.append(element('th', `${item.scenario.name} finance cost %`));
        }
        head.append(header);
        table.append(head);
        const body = element('tbody');
        all.dates.forEach((date, i) => {
            const row = element('tr');
            row.append(element('th', date));
            for (const item of series) {
                row.append(element('td', money(item.values[i]!)));
                if (showCosts) {
                    const rate = costData.find(s => s.scenario.id === item.scenario.id)!.values[i];
                    row.append(element('td', rate == null ? 'Unavailable' : rate.toFixed(2)+'%'));
                }
            }
            body.append(row);
        });
        table.append(body);
    };
    data.scenarios.forEach((scenario, i) => {
        const item = element('label'), check = element('input');
        check.type = 'checkbox';
        check.checked = true;
        check.onchange = () => {if (check.checked) enabled.add(scenario.id); else enabled.delete(scenario.id); draw();};
        item.style.marginRight = '1rem';
        item.style.color = colour(i);
        item.append(check, document.createTextNode(` ${scenario.name}${scenario.is_applied ? ' (actual position)' : ''}`));
        legend.append(item);
    });
    host.append(legend, graph, tableHost);
    select.onchange = draw;
    context.onchange = async () => {
        if (loadContext && data.context_included !== (context.value === 'forecast')) {
            const included = context.value === 'forecast';
            context.disabled = true;
            try {await loadContext(included);} finally {
                context.value = data.context_included === false ? 'alone' : 'forecast';
                context.disabled = false;
            }
        } else draw();
    };
    costs.onchange = draw;
    costToggle.onchange = draw;
    principal.onchange = draw;
    draw();
}
