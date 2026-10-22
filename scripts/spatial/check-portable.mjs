// Font-independent release floor. Geometry baselines still require pixel review.
import fs from 'node:fs';
export const REQUIRED_WIDTHS = [390,479,480,481,719,720,721,722,959,960,961,1024,1039,1040,1041,1042,1239,1240,1241,1399,1400,1401,1440,1499,1500,1501];
export function portableFailures(report) {
  const rows = report?.measurements;
  if (!Array.isArray(rows) || rows.length !== 26) return ['Expected the full 26-width board sweep'];
  const errors = [], seen = new Set();
  for (const r of rows) {
    const key = `${r.route}:${r.w}`;
    if (!REQUIRED_WIDTHS.includes(r.w)) errors.push(`Unexpected width ${r.w}`);
    if (seen.has(key)) errors.push(`Duplicate ${key}`);
    seen.add(key);
    if (r.error || r.board?.state !== 'ready' || !Number.isInteger(r.board.metrics) || r.board.metrics < 4 || !Number.isInteger(r.board.brief) || r.board.brief < 1 || r.board.funnel !== 5 || r.board.map !== true) errors.push(`Unreadable board ${key}`);
    const evidence = r.board?.metricEvidence;
    if (!Array.isArray(evidence) || evidence.length !== r.board?.metrics || evidence.some(x => x.missing || !Number.isFinite(x.overlap) || x.overlap > 0 || !Number.isFinite(x.freshnessClip) || (x.id === 'nreb-api' && x.freshnessClip > 1))) errors.push(`Unverified or obscured metric provenance ${key}`);
    for (const f of r.findings || []) if (['overflow','overlap'].includes(f.kind)) errors.push(`${key}: ${f.kind} ${f.sel}`);
  }
  for (const w of REQUIRED_WIDTHS) if (!rows.some(r => r.w === w)) errors.push(`Missing width ${w}`);
  return errors;
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const errors = portableFailures(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Portable spatial floor: 26 populated boards, no overflow/overlap');
}
