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
    periodOnly = false,
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
                if (chosen.has(movement.account)) changes.set(movement.date, (changes.get(movement.date) ?? 0n) + decimal(movement.amount));
            }
            let balance = periodOnly ? 0n : [...chosen].reduce((sum, account) => sum + decimal(scenario.opening[account] ?? '0'), 0n);
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

export function renderCaseTimeline(host: HTMLElement, data: CaseTimeline) {
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
    context.value = 'forecast';
    context.disabled = !data.financing_scenarios;
    contextLabel.append(context);
    host.append(contextLabel);
    const accountLabel = element('label', 'Account ');
    accountLabel.style.display = 'block';
    const select = element('select');
    select.setAttribute('aria-label', 'Account');
    fit(select);
    const costsLabel = element('label', 'Finance cost accounts (aggregate) ');
    costsLabel.style.display = 'block';
    const costs = element('select');
    costs.multiple = true;
    costs.size = 3;
    costs.setAttribute('aria-label', 'Finance cost accounts');
    fit(costs);
    for (const account of data.accounts) {
        const option = element('option', `${account.code} ${account.name}`);
        option.value = account.id;
        select.append(option);
        const cost = option.cloneNode(true) as HTMLOptionElement;
        cost.selected = data.finance_cost_accounts?.includes(account.id) ?? false;
        costs.append(cost);
    }
    select.value = data.accounts.find(a => /bank|cash|funding account/i.test(a.name))?.id ?? data.accounts[0]?.id ?? '';
    accountLabel.append(select);
    host.append(accountLabel);
    const costToggle = element('input');
    costToggle.type = 'checkbox';
    const toggleLabel = element('label');
    toggleLabel.append(costToggle, document.createTextNode(' Show cumulative finance costs (right axis)'));
    costsLabel.append(costs);
    costsLabel.hidden = true;
    host.append(toggleLabel, costsLabel);

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
        const costData = timelineSeries(data, costAccounts, includeForecast, true);
        const bounds = chartBounds(all.series);
        const costBounds = chartBounds(costData.series);
        const series = all.series.filter(s => enabled.has(s.scenario.id));
        const showCosts = costToggle.checked && costAccounts.length > 0;
        costsLabel.hidden = !costToggle.checked;
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
        if (showCosts) label(`Cumulative finance costs (${data.currency})`, width - right, 15, 'end');
        const compact = new Intl.NumberFormat(undefined, {notation: 'compact'});
        for (let i = 0; i <= 4; i++) {
            const value = bounds.low + bounds.span * i / 4;
            chart.append(svg('line', {x1: String(left), x2: String(width - right), y1: String(y(value)), y2: String(y(value)), stroke: 'var(--color-chart-grid, #ddd)'}));
            label(compact.format(value), left - 8, y(value) + 4, 'end');
            if (showCosts) {
                const cost = costBounds.low + costBounds.span * i / 4;
                label(compact.format(cost), width - right + 8, y(cost, costBounds) + 4);
            }
        }
        chart.append(svg('line', {x1: String(left), x2: String(width - right), y1: String(y(0)), y2: String(y(0)), stroke: 'currentColor'}));
        for (const date of [all.dates[0]!, all.dates.at(-1)!]) label(date, x(date), height - 12, date === all.dates[0] ? 'start' : 'end');
        for (const date of [data.from!, data.through!]) chart.append(svg('line', {
            x1: String(x(date)), x2: String(x(date)), y1: String(top), y2: String(height - bottom),
            stroke: 'var(--color-chart-grid, #ddd)', 'stroke-dasharray': '2 4',
        }));
        const line = (values: bigint[], id: string, name: string, cost: boolean) => {
            let path = '';
            values.forEach((value, i) => {
                const px = x(all.dates[i]!), py = y(Number(value) / Number(scale), cost ? costBounds : bounds);
                path += i === 0 ? `M${px},${py}` : `H${px}V${py}`;
            });
            const node = svg('path', {d: path, fill: 'none', stroke: colour(data.scenarios.findIndex(s => s.id === id)), 'stroke-width': cost ? '1.8' : '2.5'});
            if (cost) node.setAttribute('stroke-dasharray', '5 4');
            const title = svg('title', {});
            title.textContent = name + (cost ? ' — cumulative finance costs' : '');
            node.append(title);
            chart.append(node);
        };
        for (const item of series) {
            line(item.values, item.scenario.id, item.scenario.name, false);
            if (showCosts) line(costData.series.find(s => s.scenario.id === item.scenario.id)!.values, item.scenario.id, item.scenario.name, true);
        }
        graph.append(chart, element('p', 'Balances are debit less credit. The margins carry opening and closing balances without inventing transactions.'));
        if (!series.length) graph.append(element('p', 'Choose a Scenario to display.'));
        if (showCosts) graph.append(element('p', 'Dashed lines use the right axis: cumulative movements in the chosen finance-cost accounts, excluding opening balances and principal repayments. The axes have independent scales.'));
        if (costToggle.checked && !costAccounts.length) graph.append(element('p', 'Choose the expense accounts that represent finance costs.'));
        const head = element('thead'), header = element('tr');
        header.append(element('th', 'Date'));
        for (const item of series) {
            header.append(element('th', item.scenario.name));
            if (showCosts) header.append(element('th', `${item.scenario.name} costs`));
        }
        head.append(header);
        table.append(head);
        const body = element('tbody');
        all.dates.forEach((date, i) => {
            const row = element('tr');
            row.append(element('th', date));
            for (const item of series) {
                row.append(element('td', money(item.values[i]!)));
                if (showCosts) row.append(element('td', money(costData.series.find(s => s.scenario.id === item.scenario.id)!.values[i]!)));
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
    context.onchange = draw;
    costs.onchange = draw;
    costToggle.onchange = draw;
    draw();
}
