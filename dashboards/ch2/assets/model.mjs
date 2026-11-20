/** Engine-independent filters, chart selection, and financial denominators. */
export const clone = (value) => JSON.parse(JSON.stringify(value));
export function initialState(data) {
  return {
    group: "All",
    organizations: [...data.entities],
    years: [data.startYear, data.endYear],
    retain: true,
    labScale: "linear",
    chartFilter: null,
  };
}
export function groupFor(data, names) {
  const groups = Object.entries(data.groups)
    .filter(([, members]) => names.some((name) => members.includes(name)))
    .map(([name]) => name);
  return groups.length === 1 ? groups[0] : "All";
}
export function organizationFromChartEvent(data, params) {
  if (data.entities.includes(params?.data?.org)) return params.data.org;
  if (data.entities.includes(params?.seriesName)) return params.seriesName;
  return null;
}
export function clearChartFilter(state, id) {
  const filter = state.chartFilter;
  if (!filter || filter.chartId !== id) return;
  state.group = filter.previousGroup;
  state.organizations = [...filter.previousOrganizations];
  state.chartFilter = null;
}
export function selectChartOrganization(data, state, id, organization) {
  if (!data.entities.includes(organization)) return;
  const previous = state.chartFilter ?? {
    previousGroup: state.group,
    previousOrganizations: [...state.organizations],
  };
  state.organizations = [organization];
  state.group = groupFor(data, state.organizations);
  state.chartFilter = { ...previous, chartId: id };
}
export function manualFilter(data, state, key, value) {
  if (key === "group") {
    state.chartFilter = null;
    state.group = value;
    state.organizations = [
      ...(value === "All" ? data.entities : data.groups[value]),
    ];
  } else if (key === "organizations") {
    state.chartFilter = null;
    state.organizations = data.entities.filter((name) => value.includes(name));
    if (state.organizations.length)
      state.group = groupFor(data, state.organizations);
  } else if (key === "min" || key === "max") {
    const n = Number(value),
      fallback = key === "min" ? data.startYear : data.endYear;
    const v = Math.min(
      data.endYear,
      Math.max(data.startYear, Number.isFinite(n) ? Math.trunc(n) : fallback),
    );
    state.years[key === "min" ? 0 : 1] = v;
    if (state.years[0] > state.years[1]) state.years[key === "min" ? 1 : 0] = v;
  }
}
const latest = (rows, key) =>
  [...rows]
    .sort((a, b) => String(a[key]).localeCompare(String(b[key])))
    .reduce((map, row) => map.set(row.org, row), new Map());
export function viewData(data, state) {
  const inYears = (r) => r.year >= state.years[0] && r.year <= state.years[1],
    visible = (r) => state.retain || state.organizations.includes(r.org);
  const market = data.marketCap.filter(inYears),
    revenue = data.publicRevenue.filter(inYears),
    byOrgYear = new Map();
  [...market]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((r) => byOrgYear.set(`${r.org}\0${r.year}`, r));
  const share = (rows) => {
    const totals = new Map();
    rows.forEach((r) =>
      totals.set(r.year, (totals.get(r.year) || 0) + r.value),
    );
    return rows.map((r) => ({
      ...r,
      share: (r.value / totals.get(r.year)) * 100,
    }));
  };
  return {
    market: market.filter(visible),
    revenue: revenue.filter(visible),
    marketShare: share([...byOrgYear.values()]).filter(visible),
    revenueShare: share(revenue).filter(visible),
    labs: data.labRevenue.filter(inYears).filter(visible),
    publications: data.publications
      .filter(inYears)
      .filter((r) => r.year <= 2025)
      .filter(visible),
    latestPublic: [
      ...latest(
        data.publicRevenue.filter((r) => r.year <= state.years[1]),
        "year",
      ).values(),
    ]
      .filter(visible)
      .sort((a, b) => a.org.localeCompare(b.org)),
    latestLabs: [
      ...latest(
        data.labRevenue.filter((r) => r.year <= state.years[1]),
        "date",
      ).values(),
    ]
      .filter(visible)
      .sort((a, b) => a.org.localeCompare(b.org)),
  };
}
