// Evidence joins are explicit. A directory entry is not a surveyed location.
import { malaysiaTime } from './met-weather.js';

const L = (en, ms, zh) => ({ en, ms, zh });
export const EVIDENCE_COPY = {
  title: L('Locality evidence brief', 'Ringkasan bukti lokaliti', '聚落证据简报'),
  open: L('View evidence', 'Lihat bukti', '查看证据'),
  close: L('Close', 'Tutup', '关闭'),
  why: L('Why this?', 'Mengapa ini?', '依据是什么？'),
  place: L('Known place', 'Lokasi yang diketahui', '已知地点'),
  unknownWard: L('Ward link unknown', 'Hubungan wad tidak diketahui', '所属辖区尚不明确'),
  noPoint: L('No verified coordinates. Ward membership is directory context only; no locality marker is placed.', 'Tiada koordinat yang disahkan. Keahlian wad ialah konteks direktori sahaja; tiada penanda lokaliti diletakkan.', '没有经核实的坐标。所属辖区仅为目录背景，不放置聚落标记。'),
  regional: L('Wider-area context, not a local measurement', 'Konteks kawasan lebih luas, bukan ukuran setempat', '区域背景，并非本地测量'),
  observation: L('Observation', 'Pemerhatian', '观测'),
  age: L('minutes old', 'minit lalu', '分钟前'),
  unknown: L('Unknown', 'Tidak diketahui', '未知'),
  recent: L('Within this board’s two-hour review window (not an agency standard)', 'Dalam tetingkap semakan dua jam papan ini (bukan piawaian agensi)', '在本看板的两小时核查窗口内（非机构标准）'),
  review: L('Over two hours old · verify', 'Lebih dua jam · sahkan', '超过两小时 · 请核实'),
  future: L('Future timestamp · verify', 'Masa hadapan · sahkan', '时间在未来 · 请核实'),
  live: L('Source answered', 'Sumber menjawab', '来源已响应'),
  fallback: L('Fallback · not an observation', 'Sandaran · bukan pemerhatian', '备用值 · 并非观测'),
  degraded: L('Incomplete data', 'Data tidak lengkap', '数据不完整'),
  unavailable: L('Unavailable', 'Tidak tersedia', '不可用'),
  threshold: L('Station alert threshold', 'Ambang berjaga-jaga stesen', '测站警戒阈值'),
  verify: L('Verify time and conditions before acting', 'Sahkan masa dan keadaan sebelum bertindak', '采取行动前核实时间与现场情况'),
  news: L('Place-name mentions · not verified incidents', 'Sebutan nama tempat · bukan kejadian yang disahkan', '地名相关报道 · 并非已核实事件'),
  noNews: L('No matching headlines in this snapshot. This does not mean no incidents occurred.', 'Tiada tajuk sepadan dalam rakaman ini. Ini tidak bermakna tiada kejadian berlaku.', '此快照中没有匹配的新闻标题，并不代表没有事件发生。'),
  reports: L('Citizen accounts are not independently verified by this board.', 'Laporan awam tidak disahkan secara bebas oleh papan ini.', '本看板不对市民报告进行独立核实。'),
  noReports: L('No current citizen-report feed is available.', 'Tiada suapan laporan awam semasa tersedia.', '目前没有可用的市民报告数据。'),
  change: L('No locality time series: change cannot be calculated.', 'Tiada siri masa lokaliti: perubahan tidak dapat dikira.', '没有聚落时间序列，无法计算变化。'),
  next: L('Next human check', 'Semakan manusia seterusnya', '下一步人工核查'),
  nextText: L('Confirm the exact location, observation time and responsible service with MPP. Use Talikhidmat for the official reporting process. This board does not dispatch crews.', 'Sahkan lokasi tepat, masa pemerhatian dan perkhidmatan bertanggungjawab dengan MPP. Gunakan Talikhidmat untuk proses aduan rasmi. Papan ini tidak menghantar pasukan.', '请向市议会确认准确地点、观测时间及负责服务。通过Talikhidmat办理正式报事；本看板不派遣人员。'),
  source: L('Source and method', 'Sumber dan kaedah', '来源与方法'),
  gaugeLimit: L('This gauge measures water level at its station, not flood depth at a locality. Mapped drainage connectivity does not prove flow direction or travel time.', 'Tolok ini mengukur paras air di stesennya, bukan kedalaman banjir di lokaliti. Sambungan saliran dipetakan tidak membuktikan arah aliran atau masa perjalanan.', '此测站测量站点水位，并非聚落洪水深度。排水网络连接不能证明流向或到达时间。'),
  modelLimit: L('Model grid context; not a measurement at this locality. Missing inputs are not zero.', 'Konteks grid model; bukan ukuran di lokaliti ini. Input tiada bukan sifar.', '模型网格背景，并非此聚落的测量。缺失输入不等于零。'),
  evidence: L('Evidence', 'Bukti', '证据'),
  readMethod: L('Read method', 'Baca kaedah', '阅读方法'),
};
export function evidenceText(key, lang = 'en') {
  return EVIDENCE_COPY[key]?.[lang] ?? EVIDENCE_COPY[key]?.en ?? key;
}

export function readingAge(value, at = Date.now()) {
  const time = malaysiaTime(value);
  if (!Number.isFinite(time)) return { minutes: null, status: 'unknown' };
  const minutes = Math.floor((at - time) / 60000);
  return { minutes, status: minutes < -5 ? 'future' : minutes > 120 ? 'review' : 'recent' };
}

const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function localityEvidence(item, payload = {}, at = Date.now()) {
  if (!item?.code || !item?.name) return null;
  const place = normalize(item.name);
  // Only an explicit name mention. Never geocode a headline or infer an event.
  const news = place.length >= 4 ? (payload.news?.items || []).filter(n => {
    const title = normalize(n.title);
    return (` ${title} `).includes(` ${place} `);
  }).slice(0, 5).map(n => ({ title: n.title, link: n.link, publishedAt: n.publishedAt, source: n.source })) : [];
  return {
    code: item.code, name: item.name, ward: item.wardCode || null,
    constituency: item.constituency?.raw || null,
    location: null, join: item.wardCode ? 'directory-ward' : 'unknown',
    news, reportStatus: payload.cityReports?.status || 'not-connected',
    // A region-wide context stays region-wide, irrespective of selected place.
    weather: { status: payload.climate?.weather?.status || 'unavailable', observedAt: payload.climate?.weather?.observedAt || null, age: readingAge(payload.climate?.weather?.observedAt, at) },
    history: null,
  };
}

export function waterEvidence(payload = {}, id = null, at = Date.now()) {
  const stations = payload.infobanjir?.stations || [];
  // Do not silently substitute a different station when a selection is absent.
  const s = id ? stations.find(x => x.id === id) : stations.find(x => x.focus === 'padawan') || stations[0];
  if (!s) return null;
  return { id: s.id, name: s.name, level: typeof s.waterLevelM === 'number' && Number.isFinite(s.waterLevelM) ? s.waterLevelM : null,
    observedAt: s.observedAt || null, age: readingAge(s.observedAt, at), source: s.source || 'DID Sarawak iHYDRO',
    band: s.band || 'unknown', threshold: Number.isFinite(s.thresholds?.alert) ? s.thresholds.alert : null,
    relation: 'station-only', connectedSegments: s.catchment?.status === 'snapped' ? s.catchment.segmentCount : null };
}

export function dictionaryArtifact(payload, id, at = Date.now()) {
  if (id === 'aqi') {
    const n = payload.nrebApi;
    if (n?.status === 'ready' && Number.isFinite(n.kuching?.api)) return { name: `NREB Sarawak · ${n.takenAt || '—'}`, status: 'reference' };
    const s = payload.sources?.find(x => x.id === 'open-meteo-air');
    return { name: s?.name || 'Open-Meteo air-quality model', status: s?.status || 'offline' };
  }
  if (id === 'growth') return { name: 'AlphaEarth · ' + (payload.alphaEarth?.years ? `${payload.alphaEarth.years.a}–${payload.alphaEarth.years.b}` : '—'), status: payload.alphaEarth?.status === 'ready' && payload.alphaEarth?.image ? 'reference' : 'offline' };
  if (id === 'timesfm') {
    const f = payload.forecast, age = (at - globalThis.Date.parse(f?.asOf)) / 3600000;
    const usable = f && !['offline','unavailable','error','fallback'].includes(f.status) && Object.values(f.series || {}).some(s => Array.isArray(s.median) && s.median.length && s.median.every(Number.isFinite));
    return { name: `TimesFM · ${f?.asOf || '—'}`, status: usable && Number.isFinite(age) && age >= -0.1 && age < 48 ? 'live' : usable ? 'reference' : 'offline' };
  }
  if (id === 'floodforecast') {
    const f = payload.floodForecast, age = (at - globalThis.Date.parse(f?.updatedAt)) / 3600000;
    const usable = ['live','partial'].includes(f?.status) && f.forecast?.some(x => Number.isFinite(x.dischargeCms));
    return { name: `GloFAS · ${f?.updatedAt || '—'}`, status: !usable ? 'offline' : Number.isFinite(age) && age >= -0.1 && age < 48 ? f.status : 'reference' };
  }
  return null;
}

export const FUNNEL = [
  { title: L('Public evidence', 'Bukti awam', '公共证据'), body: L('Agency observations, model estimates, satellite products and published accounts remain distinct. A missing feed is named.', 'Pemerhatian agensi, anggaran model, produk satelit dan laporan terbitan dibezakan. Suapan tiada dinyatakan.', '机构观测、模型估算、卫星产品与公开报道分别呈现，并标明缺失数据源。') },
  { title: L('Quality checks', 'Semakan kualiti', '质量检查'), body: L('Check time, units, coverage and location. Preserve unknowns; a place name is not a coordinate.', 'Semak masa, unit, liputan dan lokasi. Kekalkan perkara tidak diketahui; nama tempat bukan koordinat.', '核对时间、单位、覆盖范围和位置。保留未知状态；地名不等于坐标。') },
  { title: L('Interpretation', 'Tafsiran', '解释'), body: L('Cooked data is a stated rule or comparison using named inputs. It is not a new observation or official warning.', 'Data diproses menggunakan peraturan atau perbandingan dengan input bernama. Ia bukan pemerhatian baharu atau amaran rasmi.', '加工数据来自明确规则或比较，列明输入；它不是新观测，也不是官方警报。') },
  { title: L('Readable view', 'Paparan mudah dibaca', '清晰呈现'), body: L('Keep the place, reading and explanation together. Expand evidence on demand; do not shrink text to fit more panels.', 'Kekalkan tempat, bacaan dan penjelasan bersama. Buka bukti apabila perlu; jangan kecilkan teks untuk menambah panel.', '地点、读数与说明放在一起，按需展开证据，不以缩小文字塞入更多面板。') },
  { title: L('Human decision', 'Keputusan manusia', '人工决策'), body: L('Confirm the location and conditions, then use the responsible agency’s process. Local task marks are not dispatched work orders.', 'Sahkan lokasi dan keadaan, kemudian gunakan proses agensi bertanggungjawab. Tanda tugas setempat bukan arahan kerja yang dihantar.', '核实地点与情况后，通过负责机构流程处理。本地任务标记不等于已派发工单。') },
];

export const RESEARCH_REFERENCES = [
  { title: 'Taipei DOIT · indicator metadata', url: 'https://github.com/taipei-doit/Taipei-City-Dashboard-Documentation/blob/main/src/assets/articles/front-end-en/introduction-to-components.md', applied: L('Sources, cadence, use case and limitations beside each signal.', 'Sumber, kekerapan, kegunaan dan batasan bersama setiap petunjuk.', '每项指标附来源、更新频率、用途及局限。') },
  { title: 'Taipei DOIT · linked map filtering', url: 'https://github.com/taipei-doit/Taipei-City-Dashboard-Documentation/blob/main/src/assets/articles/front-end-en/map-filtering.md', applied: L('Use known ward identifiers to link place selection and map context; do not invent local coordinates.', 'Gunakan pengenal wad untuk menghubungkan pilihan tempat dan konteks peta; jangan reka koordinat.', '使用已知辖区标识关联地点选择与地图背景，不编造坐标。') },
  { title: 'W3C · provenance model', url: 'https://www.w3.org/TR/prov-primer/', applied: L('Keep source evidence, processing and responsibility inspectable. These are design references, not proof of improved municipal outcomes.', 'Pastikan bukti sumber, pemprosesan dan tanggungjawab boleh disemak. Ini rujukan reka bentuk, bukan bukti hasil perbandaran bertambah baik.', '来源、处理过程和责任可供检查。这些是设计参考，并非市政成效改善的证明。') },
];
