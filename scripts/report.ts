import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {copyRegions,flatten,flattenCities,matchCounties,percentText} from '../src/model';
const atlas=JSON.parse(readFileSync('assets/counties.geo.json','utf8'));
const cityAtlas=JSON.parse(readFileSync('assets/cities.geo.json','utf8'));
mkdirSync('test-results',{recursive:true});
for(const id of ['O-CTS7316','O-MF564266','O-BY11777']){
  const fixture=JSON.parse(readFileSync(`tests/fixtures/${id}.json`,'utf8'));
  const rows=flatten(copyRegions(fixture.geographicDistribution.chartItems));
  const {matched,unmatched}=matchCounties(rows,atlas);
  const report={node:id,fixtureCapturedAt:fixture.capturedAt,source:fixture.source,records:rows.length,matched:matched.length,unmatched:unmatched.map(u=>({...u.record,frequencyText:percentText(u.record.percent),reason:u.reason})),accountedFor:matched.length+unmatched.length===rows.length};
  writeFileSync(`test-results/${id}-coverage.json`,JSON.stringify(report,null,2));
  console.log(`${id}: ${matched.length}/${rows.length} matched, ${unmatched.length} unmatched, accounted=${report.accountedFor}`);
  const cityRows=flattenCities(copyRegions(fixture.geographicDistribution.chartItems));
  const cities=matchCounties(cityRows,cityAtlas,'city');
  const cityReport={node:id,level:'city',records:cityRows.length,matched:cities.matched.length,unmatched:cities.unmatched,accountedFor:cities.matched.length+cities.unmatched.length===cityRows.length};
  writeFileSync(`test-results/${id}-city-coverage.json`,JSON.stringify(cityReport,null,2));
  console.log(`${id} city: ${cities.matched.length}/${cityRows.length} matched, ${cities.unmatched.length} unmatched`);
}
