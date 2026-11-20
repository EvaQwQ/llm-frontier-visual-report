import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,clone,manualFilter,selectChartOrganization,clearChartFilter,organizationFromChartEvent,viewData} from '../assets/model.mjs';

const data=JSON.parse(readFileSync(process.argv[2]||'/tmp/ch2-echarts-payload.json','utf8'));
for(const org of data.groups['AI labs']){
 assert.ok(data.labRevenue.some(r=>r.org===org)||data.publications.some(r=>r.org===org),`${org} must appear in an AI-lab chart`);
}
for(const org of data.entities){
 assert.equal(organizationFromChartEvent(data,{data:{org}}),org,'custom chart data resolves its organization');
 assert.equal(organizationFromChartEvent(data,{seriesName:org}),org,'named chart series resolves its organization');
}
assert.equal(organizationFromChartEvent(data,{seriesName:'Revenue scale'}),null,'non-organization series cannot filter');
const state=initialState(data),original=clone(state);
manualFilter(data,state,'min',2024);
selectChartOrganization(data,state,'scale-graph','Amazon');
assert.deepEqual(state.organizations,['Amazon'],'chart click keeps exactly one organization');
assert.deepEqual(state.years,[2024,2026],'mark selection cannot change years');
assert.equal(state.group,'Big companies');
selectChartOrganization(data,state,'scale-graph','Meta');
assert.deepEqual(state.organizations,['Meta'],'another company replaces the current chart filter');
selectChartOrganization(data,state,'lab-revenue-graph','OpenAI');
assert.equal(state.group,'AI labs');
assert.equal(state.chartFilter.chartId,'lab-revenue-graph','the clear button follows the latest chart');
clearChartFilter(state,'scale-graph');
assert.deepEqual(state.organizations,['OpenAI'],'a previous chart cannot clear the active filter');
clearChartFilter(state,'lab-revenue-graph');
assert.deepEqual(state.organizations,original.organizations,'clear restores the original organization filter');
assert.equal(state.group,'All');
assert.deepEqual(state.years,[2024,2026]);
assert.equal(state.chartFilter,null);
assert.equal(viewData(data,state).labs.length,data.labRevenue.filter(r=>r.year>=state.years[0]&&r.year<=state.years[1]).length,'clearing restores lab series in every chart');
assert.equal(viewData(data,state).publications.length,data.publications.filter(r=>r.year>=state.years[0]&&r.year<=state.years[1]&&r.year<=2025).length,'clearing restores academic series');
selectChartOrganization(data,state,'scale-graph','Meta');
manualFilter(data,state,'min',2025);
assert.ok(state.chartFilter,'changing years keeps the chart filter active');
clearChartFilter(state,'scale-graph');
assert.deepEqual(state.years,[2025,2026],'clearing a chart filter keeps the current year range');
selectChartOrganization(data,state,'scale-graph','Meta');
manualFilter(data,state,'group','Big companies');
assert.equal(state.chartFilter,null,'manual group filters replace chart selection');
assert.deepEqual(state.organizations,data.groups['Big companies']);
for(const [chart,org] of [['scale-graph','Amazon'],['lab-revenue-graph','OpenAI'],['revenue-comparison-graph','Anthropic'],['eto-graph','Meta']]){
 const previous=clone(state);
 selectChartOrganization(data,state,chart,org);
 assert.deepEqual(state.organizations,[org],`${chart} filters to its clicked organization`);
 clearChartFilter(state,chart);
 assert.deepEqual(state.organizations,previous.organizations,`${chart} restores filters when cleared`);
}
manualFilter(data,state,'max',2023);
assert.deepEqual(state.years,[2023,2023],'crossing max clamps min');
manualFilter(data,state,'min',2026);
assert.deepEqual(state.years,[2026,2026],'crossing min clamps max');

const all=initialState(data),base=viewData(data,all);
selectChartOrganization(data,all,'scale-graph','Amazon');
all.retain=false;
const focused=viewData(data,all);
for(const key of ['marketShare','revenueShare']){
 for(const row of focused[key]){
  const full=base[key].find(r=>r.org===row.org&&r.year===row.year);
  assert.equal(row.share,full.share,'visibility cannot change the all-company denominator');
 }
 for(const year of [2023,2024,2025,2026]){
  const rows=base[key].filter(r=>r.year===year);
  if(rows.length)assert.ok(Math.abs(rows.reduce((s,r)=>s+r.share,0)-100)<1e-9);
 }
}
const before=clone(focused.latestPublic);
manualFilter(data,all,'min',2025);
assert.deepEqual(viewData(data,all).latestPublic,before,'revenue tiles depend on max year only');
all.labScale='log';
assert.deepEqual(viewData(data,all),viewData(data,{...all,labScale:'linear'}),'axis scale never changes data');
assert.ok(base.publications.every(r=>r.year<=2025));
const annualLatest=Object.values(data.marketCap.reduce((map,r)=>{const k=`${r.org}/${r.year}`;if(!map[k]||map[k].date<r.date)map[k]=r;return map;},{}));
for(const row of base.marketShare)assert.equal(row.date,annualLatest.find(r=>r.org===row.org&&r.year===row.year).date);
assert.equal(original.organizations.length,data.entities.length);
console.log('Passed: source population, latest annual market cap, fixed share denominators, chart filters, year bounds, visibility, axis invariance.');
