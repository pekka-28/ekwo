// src/case-timeline.ts
var scale = 1000000n;
var day = 864e5;
function decimal(value) {
  if (!/^-?\d+(\.\d{1,6})?$/.test(value)) throw Error("Unsupported accounting amount");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  return (BigInt(whole) * scale + BigInt(fraction.padEnd(6, "0"))) * (value.startsWith("-") ? -1n : 1n);
}
function timelineSeries(data, accounts, includeForecast = true) {
  const scenarios = includeForecast ? data.scenarios : data.financing_scenarios ?? data.scenarios;
  if (!data.from || !data.through) return { dates: [], series: [] };
  const margin = Math.max(1, Math.ceil((Date.parse(data.through) - Date.parse(data.from)) / day * 0.02));
  const before = new Date(Date.parse(data.from) - margin * day).toISOString().slice(0, 10);
  const after = new Date(Date.parse(data.through) + margin * day).toISOString().slice(0, 10);
  const dates = [.../* @__PURE__ */ new Set([
    before,
    data.from,
    data.through,
    after,
    ...data.scenarios.flatMap((s) => s.movements.map((m) => m.date)),
    ...(data.financing_scenarios ?? []).flatMap((s) => s.movements.map((m) => m.date))
  ])].sort();
  const chosen = new Set(typeof accounts === "string" ? [accounts] : accounts);
  return {
    dates,
    series: scenarios.map((scenario) => {
      const changes = /* @__PURE__ */ new Map();
      for (const movement of scenario.movements) {
        const key = movement.date;
        if (chosen.has(movement.account)) changes.set(key, (changes.get(key) ?? 0n) + decimal(movement.amount));
      }
      let balance = [...chosen].reduce((sum, account) => sum + decimal(scenario.opening[account] ?? "0"), 0n);
      return { scenario, values: dates.map((date) => balance += changes.get(date) ?? 0n) };
    })
  };
}
function chartBounds(series) {
  const values = series.flatMap((s) => s.values.map((v) => Number(v) / Number(scale)));
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  return { low, high, span: high - low || 1 };
}
function financeCostPercent(value, basis) {
  if (basis <= 0n) throw Error("Outstanding amount must be positive.");
  return Number(value) / Number(basis) * 100;
}
function financingRates(scenario, dates, interestAccounts, principalAccounts) {
  const interest = new Set(interestAccounts), principal = new Set(principalAccounts);
  const balances = new Map(principalAccounts.map((id) => [id, decimal(scenario.opening[id] ?? "0")]));
  const movements = /* @__PURE__ */ new Map();
  for (const movement of scenario.movements) {
    const group = movements.get(movement.date) ?? [];
    group.push(movement);
    movements.set(movement.date, group);
  }
  let previousFundingDate;
  return dates.map((date) => {
    const group = movements.get(date) ?? [];
    const outstanding = [...balances.values()].reduce((sum, value) => sum + (value < 0n ? -value : value), 0n);
    const cost = group.reduce((sum, movement) => sum + (interest.has(movement.account) ? decimal(movement.amount) : 0n), 0n);
    const days = previousFundingDate === void 0 ? 0 : (Date.parse(date) - Date.parse(previousFundingDate)) / day;
    if (group.some((movement) => (interest.has(movement.account) || principal.has(movement.account)) && decimal(movement.amount) !== 0n)) previousFundingDate = date;
    for (const movement of group) if (principal.has(movement.account))
      balances.set(movement.account, (balances.get(movement.account) ?? 0n) + decimal(movement.amount));
    return cost === 0n ? 0 : outstanding > 0n && days > 0 ? financeCostPercent(cost, outstanding) * 365 / days : null;
  });
}
function dateTicks(from, through) {
  const start = Date.parse(from), end = Date.parse(through);
  if (end <= start) return [from];
  const span = (end - start) / day;
  const step = span > 4 * 365 ? 12 : span > 2 * 365 ? 6 : span > 365 ? 3 : span > 120 ? 2 : 1;
  const cursor = /* @__PURE__ */ new Date(from.slice(0, 7) + "-01");
  cursor.setUTCMonth(cursor.getUTCMonth() + step);
  const ticks = [from];
  while (cursor.getTime() < end) {
    if (cursor.getTime() - start > (end - start) * 0.12 && end - cursor.getTime() > (end - start) * 0.12)
      ticks.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + step);
  }
  ticks.push(through);
  return ticks;
}
function defaultChartAccount(accounts) {
  return accounts.find((a) => /funding bank|funding account|funded .*investments/i.test(a.name))?.id ?? accounts.find((a) => /current account|cash at bank/i.test(a.name))?.id ?? accounts.find((a) => /bank|cash/i.test(a.name) && !/loan|interest|overdraft|debt/i.test(a.name))?.id ?? accounts[0]?.id ?? "";
}
function element(tag, text) {
  const result = document.createElement(tag);
  if (text !== void 0) result.textContent = text;
  return result;
}
function svg(tag, attributes) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
function fit(select) {
  select.style.width = "100%";
  select.style.maxWidth = "28rem";
  select.style.minWidth = "0";
}
var chartDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
var displayChartDate = (value) => chartDate.format(new Date(value));
function renderCaseTimeline(host, data, loadContext) {
  host.replaceChildren();
  const range = data.from && data.through ? `${displayChartDate(data.from)}-${displayChartDate(data.through)}` : "No dated entries";
  host.append(element("p", `${data.case_type === "Other" ? "Project" : data.case_type} \xB7 ${data.currency} \xB7 ${range}`));
  const basis = element("p", data.basis);
  host.append(basis);
  if (data.assumptions?.length) {
    const details = element("details");
    details.append(element("summary", "Illustrative assumptions"));
    const list = element("ul");
    for (const text of data.assumptions) list.append(element("li", text));
    details.append(list);
    host.append(details);
  }
  if (!data.from || !data.through) {
    host.append(element("p", "Add dated Scenario journals to analyse this Case."));
    return;
  }
  const contextLabel = element("label", "Projection basis ");
  contextLabel.style.display = "block";
  const context = element("select");
  context.setAttribute("aria-label", "Projection basis");
  fit(context);
  for (const [value, name] of [["alone", "Case alone"], ["forecast", "With selected Forecast/context"]]) {
    const option = element("option", name);
    option.value = value;
    context.append(option);
  }
  context.value = data.context_included === false ? "alone" : "forecast";
  context.disabled = !data.financing_scenarios;
  contextLabel.append(context);
  const options = element("details");
  options.append(element("summary", "Chart options"), contextLabel);
  const accountLabel = element("label", "Show ");
  accountLabel.style.display = "block";
  const select = element("select");
  select.setAttribute("aria-label", "Account");
  fit(select);
  const costsLabel = element("label", "Interest accounts ");
  costsLabel.style.display = "block";
  const costs = element("select");
  costs.multiple = true;
  costs.size = 3;
  costs.setAttribute("aria-label", "Finance cost accounts");
  fit(costs);
  const principalLabel = element("label", "Outstanding funding accounts ");
  principalLabel.style.display = "block";
  const principal = element("select");
  principal.multiple = true;
  principal.size = 3;
  principal.setAttribute("aria-label", "Outstanding funding accounts");
  fit(principal);
  const displayedScenarios = data.context_included === false ? data.financing_scenarios ?? data.scenarios : data.scenarios;
  const movingAccounts = new Set(displayedScenarios.flatMap((s) => s.movements.filter((m) => decimal(m.amount) !== 0n).map((m) => m.account)));
  for (const account of data.accounts) {
    const option = element("option", `${account.code} ${account.name}`);
    option.value = account.id;
    select.append(option);
    const cost = option.cloneNode(true);
    cost.selected = data.finance_cost_accounts?.length ? data.finance_cost_accounts.includes(account.id) : movingAccounts.has(account.id) && /interest|finance cost/i.test(account.name) && !/receivable|payable/i.test(account.name);
    costs.append(cost);
    const funding = option.cloneNode(true);
    funding.selected = data.finance_principal_accounts?.includes(account.id) ?? (movingAccounts.has(account.id) && /loan|borrowing|junior funding|senior funding|overdraft|\bHP\b/i.test(account.name) && !/interest|cost|expense/i.test(account.name));
    principal.append(funding);
  }
  select.value = defaultChartAccount(data.accounts);
  accountLabel.append(select);
  host.append(accountLabel);
  const costToggle = element("input");
  costToggle.type = "checkbox";
  const toggleLabel = element("label");
  toggleLabel.append(costToggle, document.createTextNode(" Show finance cost (right axis)"));
  costsLabel.append(costs);
  costsLabel.hidden = true;
  principalLabel.append(principal);
  principalLabel.hidden = true;
  host.append(toggleLabel);
  options.append(costsLabel, principalLabel);
  const calculation = element("p");
  options.append(calculation);
  options.append(element("p", "Balances are debit less credit. Opening and closing balances extend into the chart margins."));
  const legend = element("fieldset");
  legend.append(element("legend", "Scenarios"));
  const enabled = new Set(data.scenarios.map((s) => s.id));
  const graph = element("div");
  graph.className = "case-timeline";
  const tableHost = element("details");
  tableHost.style.overflowX = "auto";
  tableHost.append(element("summary", "Account balances by date"));
  const table = element("table");
  tableHost.append(table);
  const colour = (i) => `var(--color-series-${i + 1}, ${["#2864b4", "#a04e14", "#388047", "#9a3da4", "#555"][i % 5]})`;
  const moneyFormat = new Intl.NumberFormat(void 0, { style: "currency", currency: data.currency });
  const money = (value) => moneyFormat.format(Number(value) / Number(scale));
  const draw = () => {
    graph.replaceChildren();
    table.replaceChildren();
    const includeForecast = context.value === "forecast";
    basis.textContent = includeForecast ? `With selected context. Forecasts: ${(data.forecast_names ?? []).join(", ") || "none"}.` : "Case alone";
    const all = timelineSeries(data, select.value, includeForecast);
    const costAccounts = Array.from(costs.selectedOptions).map((o) => o.value);
    const principalAccounts = Array.from(principal.selectedOptions).map((o) => o.value);
    const costData = all.series.map((s) => ({ scenario: s.scenario, values: financingRates(s.scenario, all.dates, costAccounts, principalAccounts) }));
    const bounds = chartBounds(all.series);
    const costValues = costData.flatMap((s) => s.values.filter((v) => v !== null));
    const costLow = Math.min(0, ...costValues), costHigh = Math.max(0, ...costValues);
    const costBounds = { low: costLow, high: costHigh, span: costHigh - costLow || 1 };
    const series = all.series.filter((s) => enabled.has(s.scenario.id));
    const showCosts = costToggle.checked && costAccounts.length > 0 && principalAccounts.length > 0;
    costsLabel.hidden = !costToggle.checked;
    principalLabel.hidden = !costToggle.checked;
    calculation.hidden = !costToggle.checked;
    calculation.textContent = "Annualised finance cost is interest divided by outstanding funding before repayment, multiplied by 365 divided by the actual days since the preceding funding or interest cash flow. Combined funding uses total interest and principal. This is simple annualisation of observed flows, not a compounded return or contractual APR. A missing preceding date makes the rate unavailable; absent interest is zero. All checked Scenarios appear on both axes.";
    const width = 1e3, height = 360, left = 90, right = showCosts ? 90 : 20, top = 35, bottom = 45;
    const first = Date.parse(all.dates[0]), last = Date.parse(all.dates.at(-1));
    const x = (date) => left + (Date.parse(date) - first) / (last - first) * (width - left - right);
    const y = (value, b = bounds) => height - bottom - (value - b.low) / b.span * (height - top - bottom);
    const chart = svg("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": `Scenario balances: ${select.selectedOptions[0]?.textContent ?? ""}`,
      "data-y-min": String(bounds.low),
      "data-y-max": String(bounds.high),
      "data-cost-min": String(costBounds.low),
      "data-cost-max": String(costBounds.high)
    });
    chart.setAttribute("style", "width:100%;height:auto;min-height:220px");
    const label = (text, xValue, yValue, anchor = "start") => {
      const node = svg("text", { x: String(xValue), y: String(yValue), "text-anchor": anchor, fill: "currentColor", "font-size": "12" });
      node.textContent = text;
      chart.append(node);
    };
    label(`Account balance (${data.currency})`, left, 15);
    if (showCosts) label("Finance cost (% p.a.)", width - right, 15, "end");
    const compact = new Intl.NumberFormat(void 0, { notation: "compact" });
    for (let i = 0; i <= 4; i++) {
      const value = bounds.low + bounds.span * i / 4;
      chart.append(svg("line", { x1: String(left), x2: String(width - right), y1: String(y(value)), y2: String(y(value)), stroke: "var(--color-chart-grid, #ddd)" }));
      label(compact.format(value), left - 8, y(value) + 4, "end");
      if (showCosts) {
        const cost = costBounds.low + costBounds.span * i / 4;
        label(cost.toFixed(1) + "%", width - right + 8, y(cost, costBounds) + 4);
      }
    }
    chart.append(svg("line", { x1: String(left), x2: String(width - right), y1: String(y(0)), y2: String(y(0)), stroke: "currentColor" }));
    const ticks = dateTicks(data.from, data.through);
    for (const date of ticks) {
      const text = new Date(date).toLocaleDateString(void 0, { month: "short", year: "numeric", timeZone: "UTC" });
      label(text, x(date), height - 12, date === ticks[0] ? "start" : date === ticks.at(-1) ? "end" : "middle");
    }
    for (const date of [data.from, data.through]) chart.append(svg("line", {
      x1: String(x(date)),
      x2: String(x(date)),
      y1: String(top),
      y2: String(height - bottom),
      stroke: "var(--color-chart-grid, #ddd)",
      "stroke-dasharray": "2 4"
    }));
    const line = (values, id, name, cost) => {
      let path = "";
      let connected = false;
      values.forEach((value, i) => {
        if (value === null) {
          connected = false;
          return;
        }
        const px = x(all.dates[i]), py = y(cost ? Number(value) : Number(value) / Number(scale), cost ? costBounds : bounds);
        path += !connected ? `M${px},${py}` : cost ? `L${px},${py}` : `H${px}V${py}`;
        connected = true;
      });
      const node = svg("path", { d: path, fill: "none", stroke: colour(data.scenarios.findIndex((s) => s.id === id)), "stroke-width": cost ? "1.8" : "2.5" });
      node.setAttribute("data-scenario", id);
      node.setAttribute("data-series", cost ? "cost" : "balance");
      if (cost) node.setAttribute("stroke-dasharray", "5 4");
      const title = svg("title", {});
      title.textContent = name + (cost ? " \u2014 finance costs" : "");
      node.append(title);
      chart.append(node);
    };
    for (const item of series) {
      line(item.values, item.scenario.id, item.scenario.name, false);
      if (showCosts) line(costData.find((s) => s.scenario.id === item.scenario.id).values, item.scenario.id, item.scenario.name, true);
    }
    graph.append(chart);
    if (!series.length) graph.append(element("p", "Choose a Scenario to display."));
    if (showCosts && costData.some((s) => enabled.has(s.scenario.id) && s.values.includes(null))) graph.append(element("p", "Some interest has no corresponding outstanding funding or preceding cash-flow date. Those annualised rates are unavailable and appear as gaps."));
    if (costToggle.checked && (!costAccounts.length || !principalAccounts.length)) {
      options.open = true;
      graph.append(element("p", "Choose the interest and outstanding funding accounts in Chart options to display the finance cost."));
    }
    const head = element("thead"), header = element("tr");
    header.append(element("th", "Date"));
    for (const item of series) {
      header.append(element("th", item.scenario.name));
      if (showCosts) header.append(element("th", `${item.scenario.name} finance cost % p.a.`));
    }
    head.append(header);
    table.append(head);
    const body = element("tbody");
    all.dates.forEach((date, i) => {
      const row = element("tr");
      row.append(element("th", displayChartDate(date)));
      for (const item of series) {
        row.append(element("td", money(item.values[i])));
        if (showCosts) {
          const rate = costData.find((s) => s.scenario.id === item.scenario.id).values[i];
          row.append(element("td", rate == null ? "Unavailable" : rate.toFixed(2) + "%"));
        }
      }
      body.append(row);
    });
    table.append(body);
  };
  data.scenarios.forEach((scenario, i) => {
    const item = element("label"), check = element("input");
    check.type = "checkbox";
    check.checked = true;
    check.onchange = () => {
      if (check.checked) enabled.add(scenario.id);
      else enabled.delete(scenario.id);
      draw();
    };
    item.style.marginRight = "1rem";
    item.style.color = colour(i);
    item.append(check, document.createTextNode(` ${scenario.name}${scenario.is_applied ? " (actual position)" : ""}`));
    legend.append(item);
  });
  host.append(legend, graph, tableHost, options);
  select.onchange = draw;
  context.onchange = async () => {
    if (loadContext && data.context_included !== (context.value === "forecast")) {
      const included = context.value === "forecast";
      context.disabled = true;
      try {
        await loadContext(included);
      } finally {
        context.value = data.context_included === false ? "alone" : "forecast";
        context.disabled = false;
      }
    } else draw();
  };
  costs.onchange = draw;
  costToggle.onchange = draw;
  principal.onchange = draw;
  draw();
}
export {
  chartBounds,
  dateTicks,
  decimal,
  defaultChartAccount,
  financeCostPercent,
  financingRates,
  renderCaseTimeline,
  timelineSeries
};
