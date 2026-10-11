import { dataHealth, warningHealth } from './data-health.js';

// Deterministic summaries; original directives remain in expandable evidence.
export function morningBrief(p, lang = 'en', scope = 'padawan', at = Date.now()) {
  const pick = (en, ms, zh) => lang === 'ms' ? ms : lang === 'zh' ? zh : en;
  const h = dataHealth(p, scope, at), met = p.metWarnings;
  const unknown = warningHealth(met, at).uncertain;
  const number = id => {
    const v = p.metrics?.find(m => m.id === id)?.value;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const rain = number('rain6h'), aqi = number('aqi');
  const now = [
    h.uncertain
      ? pick('Verify river readings with JPS or field staff before deciding.', 'Sahkan bacaan sungai dengan JPS atau petugas lapangan sebelum membuat keputusan.', '作出决定前，请向水利灌溉局或现场人员核实河流水位。')
      : h.highest !== 'normal'
        ? pick('Review elevated gauges and confirm affected locations with field staff.', 'Semak tolok yang meningkat dan sahkan lokasi terjejas dengan petugas lapangan.', '查看水位偏高的测站，并请现场人员确认受影响地点。')
        : pick('Review river trends; normal readings do not rule out local flooding.', 'Semak trend sungai; bacaan normal tidak menolak kemungkinan banjir setempat.', '查看河流水位趋势；正常读数不能排除局部积水。'),
    unknown
      ? (met?.activeCount > 0 ? pick(`${met.activeCount} dated MET warnings returned. `, `${met.activeCount} amaran MET bertarikh diterima. `, `收到${met.activeCount}则有有效期的气象警报。`) : '') + pick('Check the official MET bulletin; warning status is incomplete, unavailable or outdated.', 'Semak buletin rasmi MET; status amaran tidak lengkap, tidak tersedia atau sudah lama.', '核对气象局官方公告；警报状态不完整、暂不可用或已过时。')
      : met.activeCount > 0
        ? pick(`Review ${met.activeCount} MET warnings and their validity periods.`, `Semak ${met.activeCount} amaran MET serta tempoh sahnya.`, `查看${met.activeCount}则气象局警报及其有效期。`)
        : pick('Keep checking MET updates; no active regional warning was returned at the last check.', 'Terus semak kemas kini MET; tiada amaran wilayah aktif diterima pada semakan terakhir.', '继续关注气象局更新；上次查询未返回有效的区域警报。'),
    pick('Confirm priority locations and responsibilities at shift handover. Marks here are personal, not dispatched jobs.', 'Sahkan lokasi keutamaan dan tanggungjawab semasa pertukaran syif. Tanda di sini bersifat peribadi, bukan arahan kerja.', '交班时确认重点地点与负责人。此处任务标记仅供个人记录，不代表已派工。'),
  ];
  const next = [
    rain === null ? pick('Rain forecast unavailable.', 'Ramalan hujan tidak tersedia.', '降雨预测暂不可用。')
      : pick(`Modelled rain, next 6 hours: ${rain} mm. Check drains and field conditions.`, `Ramalan model hujan, 6 jam akan datang: ${rain} mm. Semak saliran dan keadaan lapangan.`, `未来6小时模型预测降雨：${rain}毫米。检查排水设施与现场情况。`),
    aqi === null ? pick('Air-quality model unavailable.', 'Model kualiti udara tidak tersedia.', '空气质量模型暂不可用。')
      : pick(`Modelled AQI: ${aqi}. Compare with DOE ground observations before issuing advice.`, `AQI model: ${aqi}. Bandingkan dengan pemerhatian darat JAS sebelum mengeluarkan nasihat.`, `模型AQI：${aqi}。发布建议前，请与环境局地面监测数据核对。`),
  ];
  const blind = [
    pick(`River readings needing a time check: ${h.outdatedReadings}/${h.count}. Review window: 2 hours, not an agency standard.`, `Bacaan sungai yang perlu disemak masanya: ${h.outdatedReadings}/${h.count}. Tempoh semakan: 2 jam, bukan piawaian agensi.`, `需核对时间的河流水位读数：${h.outdatedReadings}/${h.count}。复核窗口为2小时，并非官方标准。`),
    pick('Snapshot refresh does not replace checking each observation time.', 'Kemas kini snapshot tidak menggantikan semakan masa setiap pemerhatian.', '刷新快照不能代替核对每条观测记录的时间。'),
  ];
  if (p.forecast?.status !== 'live') blind.push(pick('Experimental long-range forecast is not current; do not use it for today’s decisions.', 'Ramalan eksperimen jangka panjang tidak terkini; jangan gunakannya untuk keputusan hari ini.', '实验性长期预测未更新，请勿用于今天的决策。'));
  return { now, next, blind };
}
