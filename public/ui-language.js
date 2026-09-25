// Exact phrase catalogue for legacy renderers. Never translate by replacing
// arbitrary words inside a source article, URL, identifier or numeric value.
export const PHRASES = [
  ['MUNICIPAL SECRETARY GOH THIAM HO // MPP','SETIAUSAHA PERBANDARAN GOH THIAM HO // MPP','市政秘书 GOH THIAM HO // MPP'],
  ['PADAWAN','PADAWAN','巴达旺'],
  ['OFFICE OF SECRETARY DANIEL GOH // MPP','PEJABAT SETIAUSAHA PERBANDARAN // MPP','市政秘书办公室 // MPP'],
  ['What people are saying','Apa kata orang ramai','民众在说什么'],
  ['headlines & language lanes','tajuk berita dan bahasa sumber','新闻头条及来源语言'],
  ['Ground pulse','Laporan lapangan','现场动态'],
  ['what the field is reporting','laporan dari lapangan','现场报告'],
  ['field reports & work orders','laporan lapangan dan arahan kerja','现场报告与工单'],
  ['weather, air & ground signals','cuaca, udara dan keadaan lapangan','天气、空气与地面状况'],
  ['agency updates & provenance','kemas kini agensi dan asal data','机构更新与数据出处'],
  ['Official data pulse','Kemas kini data rasmi','官方数据更新'],
  ['More detail · councillors, stations, flights','Butiran lanjut · ahli majlis, stesen, penerbangan','更多详情 · 市议员、测站、航班'],
  ['Outlook · growth · sources · localities','Tinjauan · pembangunan · sumber · kawasan','展望 · 发展 · 来源 · 地点'],
  ['Open when you need the full picture','Buka untuk gambaran menyeluruh','需要完整信息时展开'],
  ['Economy + pulse','Ekonomi dan perkembangan','经济与动态'],
  ['Background signal','Maklumat latar','背景信息'],
  ['Human read','Tafsiran keadaan','情况解读'],
  ['Scene brief','Ringkasan keadaan','现场简报'],
  ['Scene Brief','Ringkasan keadaan','现场简报'],
  ['What A Human Notices','Perkara yang perlu diperhatikan','值得留意的情况'],
  ['Field Checks','Semakan lapangan','现场核查'],
  ['Qualitative Sources','Sumber laporan','报告来源'],
  ['CCTV Feeds','Suapan CCTV','监控摄像头'],
  ['LIGHT','CERAH','浅色'],['DARK','GELAP','深色'],
  ['TEXT +','TEKS +','文字 +'],['TEXT −','TEKS −','文字 −'],
  ['Dark','Gelap','深色'],['Light','Cerah','浅色'],['Street','Jalan','街道'],['Satellite','Satelit','卫星'],
  ['COPY','SALIN','复制'],['COPIED','DISALIN','已复制'],['KEYS','KEKUNCI','快捷键'],
  ['NAVIGATION','NAVIGASI','导航'],['EXPORT & ACTIONS','EKSPORT DAN TINDAKAN','导出与操作'],
  ['READING THE BOARD','MEMBACA PAPAN PEMUKA','阅读仪表板'],
  ['Close help','Tutup bantuan','关闭帮助'],
  ['show / hide this key map','papar / sembunyi panduan kekunci','显示／隐藏快捷键说明'],
  ['close ward brief or this overlay','tutup ringkasan zon atau paparan ini','关闭选区简报或此窗口'],
  ['cycle through wards (next)','beralih ke zon seterusnya','切换到下一个选区'],
  ['cycle through wards (previous)','beralih ke zon sebelumnya','切换到上一个选区'],
  ['copy WhatsApp sitrep to clipboard','salin ringkasan untuk WhatsApp','复制用于 WhatsApp 的简报'],
  ['print sitrep (browser → save as PDF)','cetak ringkasan (pelayar → simpan PDF)','打印简报（浏览器 → 保存为 PDF）'],
  ['toggle dark / light theme','tukar tema gelap / cerah','切换深色／浅色主题'],
  ['force refresh (re-fetch payload)','muat semula data','重新获取数据'],
  ['toggle full mode (show all hidden panels)','tukar mod penuh (papar semua panel)','切换完整模式（显示全部面板）'],
  ['live · last fetch within cache TTL','langsung · pengambilan dalam tempoh cache','实时 · 获取时间在缓存有效期内'],
  ['cached · referenced from baked snapshot','cache · daripada salinan statik','缓存 · 来自静态快照'],
  ['degraded · feed fell back to model / heuristic','terhad · menggunakan model atau anggaran','受限 · 已回退至模型或估算'],
  ['offline · upstream feed unreachable','luar talian · sumber tidak dapat dicapai','离线 · 无法连接上游来源'],
  ['directive: queued / in-progress / done (click to cycle)','tugas: menunggu / berjalan / selesai (klik untuk tukar)','任务：待处理／处理中／已完成（点击切换）'],
  ['directive first seen > 8 hours ago','tugas pertama kali dilihat lebih 8 jam lalu','任务首次出现于八小时前'],
  ['Geographic scope','Skop geografi','地理范围'],['Map dimension','Dimensi peta','地图维度'],
  ['Operator shortcuts','Pintasan petugas','工作人员快捷入口'],
  ['DATA: TIME NEEDS REVIEW','DATA: SEMAK MASA','数据：请核查时间'],
  ['DATA: RIVER READINGS MISSING','DATA: BACAAN SUNGAI TIADA','数据：缺少河流水位'],
  ['DATA: CHECK SOURCE TIMES','DATA: SEMAK MASA SUMBER','数据：请核对来源时间'],
  ['STATIC SNAPSHOT','SALINAN STATIK','静态快照'],['SNAPSHOT BOARD','PAPAN STATIK','快照看板'],
  ['LIVE BOARD','PAPAN LANGSUNG','实时看板'],['LIVE API','API LANGSUNG','实时 API'],
  ['CLIENT FALLBACK','DATA SANDARAN PELAYAR','浏览器备用数据'],
  ['Check MET bulletin','Semak buletin MET','查阅气象局公告'],
  ['Calm','Tenang','平稳'],['Keep an eye on it','Terus pantau','继续观察'],
  ['Stay alert','Sentiasa berwaspada','保持警觉'],['Pressure building','Tekanan meningkat','压力上升'],
  ['Water watch','Pemantauan air','水情监测'],
  ['attention index · not a flood forecast','indeks perhatian · bukan ramalan banjir','关注指数 · 并非洪水预测'],
  ['01 · observation in payload','01 · pemerhatian dalam data','01 · 数据中的观测'],
  ['02 · pressure','02 · faktor tekanan','02 · 影响因素'],
  ['03 · connected path','03 · laluan bersambung','03 · 连通路径'],
  ['04 · act','04 · tindakan','04 · 行动'],
  ['No current level returned','Tiada paras semasa diterima','未收到当前水位'],
  ['Observation time unavailable','Masa pemerhatian tiada','观测时间不可用'],
  ['No driver supplied. Check agency readings before deciding.','Tiada faktor dibekalkan. Semak bacaan agensi sebelum membuat keputusan.','未提供影响因素。请先核对机构读数，再作决定。'],
  ['Select a gauge to load its connected public drainage reach','Pilih tolok untuk memuatkan saliran awam yang bersambung','选择水位站以加载相连的公共排水线'],
  ['Use the checklist below; follow DID, MET Malaysia, and district directions for official warnings or evacuation orders.','Gunakan senarai semak di bawah; rujuk JPS, MET Malaysia dan pihak daerah untuk amaran rasmi atau arahan pemindahan.','使用下方清单；官方预警和疏散命令以水利灌溉局、马来西亚气象局及地区部门指示为准。'],
  ['Check observation times before action','Semak masa pemerhatian sebelum tindakan','行动前核查观测时间'],
  ['Cross-check, contacts & shelters','Semakan silang, hubungan dan pusat pemindahan','交叉核查、联系人及疏散中心'],
  ['Call these numbers','Nombor untuk dihubungi','联系电话'],['Shelters / PPS','Pusat pemindahan / PPS','疏散中心／PPS'],
  ['Source:','Sumber:','来源：'],['OPEN','BUKA','打开'],['MAP','PETA','地图'],
  ['OK','Normal','正常'],['Alert','Waspada','警戒'],['Warning','Amaran','警报'],['Danger','Bahaya','危险'],
  ['Normal','Normal','正常'],['No live','Tiada bacaan langsung','无实时读数'],
  ['No live river gauges in this cycle.','Tiada bacaan sungai langsung dalam kitaran ini.','本轮没有实时河流水位读数。'],
  ['Rivers look fine','Bacaan sungai di bawah tahap waspada','河流水位低于警戒值'],
  ['All monitored gauges below Alert.','Semua tolok dipantau di bawah tahap waspada.','所有受监测水位站均低于警戒值。'],
  ['Static snapshot — check the payload date; page refresh does not update the source observations','Salinan statik — semak tarikh data; muat semula halaman tidak mengemas kini pemerhatian sumber','静态快照：请检查数据日期；刷新页面不会更新源观测。'],
  ['Main feeds look healthy','Semak masa setiap suapan utama','请核查各主要数据源的时间'],
  ['Rain next 6h','Hujan 6 jam akan datang','未来六小时降雨'],['Flood watch','Pemantauan banjir','洪水监测'],
  ['Heat index','Indeks haba','体感热度指数'],['KCH tracked','Pesawat dikesan KCH','KCH 跟踪航班'],
  ['No active MET warnings','Tiada amaran aktif MET dalam data','数据中无气象局生效警报'],
  ['Official','Rasmi','官方'],['English','English','English'],['Bahasa','Bahasa','马来语'],['Chinese','中文','中文'],
  ['Good','Baik','良好'],['Moderate','Sederhana','中等'],['Sensitive','Kumpulan sensitif','敏感人群需留意'],
  ['Unhealthy','Tidak sihat','不健康'],['Hazardous','Berbahaya','危险'],
  ['Clear','Cerah','晴'],['Mostly clear','Kebanyakannya cerah','大部晴朗'],['Partly cloudy','Berawan sebahagian','局部多云'],
  ['Overcast','Mendung','阴天'],['Fog','Kabus','雾'],['Drizzle','Hujan renyai','毛毛雨'],['Light rain','Hujan ringan','小雨'],
  ['Rain','Hujan','降雨'],['Heavy rain','Hujan lebat','大雨'],['Showers','Hujan sekejap','阵雨'],['Heavy showers','Hujan sekejap lebat','强阵雨'],['Thunderstorm','Ribut petir','雷暴'],
  ['Mixed conditions','Keadaan bercampur','混合天气'],
  ['Rain → River Cascade','Hujan → tindak balas sungai','降雨 → 河流响应'],
  ['Forecast pipeline offline — cascade unavailable this cycle.','Saluran ramalan luar talian — unjuran tidak tersedia kali ini.','预测流程离线，本轮无法显示降雨与河流响应。'],
  ['Worst gauge in the ward × rated holdings behind it. Click a ward for its brief + councillor contacts.','Tolok paling tinggi di zon × pegangan berkadar. Klik zon untuk ringkasan dan hubungan ahli majlis.','选区最高风险水位站与应税物业数量。点击选区查看简报及市议员联系方式。'],
  ['no catchment model for this gauge','tiada model tadahan untuk tolok ini','该水位站没有集水区模型'],
  ['not in the TimesFM catchment set — telemetry only','tidak termasuk dalam model tadahan TimesFM — telemetri sahaja','不在 TimesFM 集水区模型内，仅有遥测数据'],
  ['Geometry shows connection, not flow direction, flood arrival, or inundation.','Geometri menunjukkan sambungan, bukan arah aliran, ketibaan banjir atau kawasan ditenggelami air.','几何线仅表示连通关系，不代表流向、洪水到达时间或淹水范围。'],
  ['PATH','LALUAN','路径'],['Routine sweep on schedule. Re-check after the next rain band.','Teruskan pemeriksaan berjadual. Semak semula selepas hujan seterusnya.','按计划巡查，下轮降雨后复核。'],
  ['FIRST SEEN >8H AGO','PERTAMA DILIHAT >8 JAM LALU','首次出现于八小时前'],
  ['queued','menunggu','待处理'],['active','sedang dibuat','处理中'],['done','selesai','已完成'],
  ['live','langsung','实时'],['offline','luar talian','离线'],['reference','rujukan','参考'],['fallback','sandaran','备用'],['cached','cache','缓存'],
  ['Increase reading size for this board','Besarkan teks papan pemuka','放大仪表板文字'],
  ['Click to cycle queued → active → done','Klik untuk tukar menunggu → sedang dibuat → selesai','点击切换待处理 → 处理中 → 已完成'],
  ['Read original','Baca sumber asal','阅读原文'],
  ['Headline summary · machine translated; verify the original','Ringkasan tajuk · terjemahan mesin; semak sumber asal','标题摘要 · 机器翻译，请核对原文'],
  ['Translation pending · original retained','Terjemahan belum tersedia · sumber asal dikekalkan','翻译待补充 · 保留原文'],
];

export function createTranslator(base, extra = PHRASES) {
  const catalogue = new Map(extra.map(([en,ms,zh])=>[en,{en,ms,zh}]));
  for (const [key,en] of Object.entries(base.en)) if (!catalogue.has(en)) catalogue.set(en,{en,ms:base.ms[key]||en,zh:base.zh[key]||en});
  const reverse = new Map();
  for (const [en,entry] of catalogue) for (const value of Object.values(entry)) if (!reverse.has(value)) reverse.set(value,en);
  return (text,lang='en') => {
    const trimmed = text.trim(), key = reverse.get(trimmed) || trimmed;
    const entry = catalogue.get(key);
    if (entry) return text.replace(trimmed,entry[lang] || entry.en);
    if (lang === 'en') return text;
    for (const [pattern,ms,zh] of PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) return text.replace(trimmed,(lang === 'ms' ? ms : zh)(match));
    }
    return text;
  };
}

const PATTERNS = [
  [/^PAYLOAD \/\/ (.+)$/,m=>`DATA // ${m[1]}`,m=>`数据时间 // ${m[1]}`],
  [/^Payload (.+) · Snapshot (.+)$/,m=>`Data ${m[1]} · Salinan ${m[2]}`,m=>`数据 ${m[1]} · 快照 ${m[2]}`],
  [/^Keep watching — air AQI (.+)$/,m=>`Pantau — AQI udara ${m[1]}`,m=>`继续关注 — 空气质量指数 ${m[1]}`],
  [/^(\d+) weather warnings? in payload$/,m=>`${m[1]} amaran cuaca dalam data`,m=>`数据中有 ${m[1]} 项气象警报`],
  [/^Weather: check official bulletin$/,()=>`Cuaca: semak buletin rasmi`,()=>`天气：核查官方公告`],
  [/^Gauge band: (normal|alert|warning|danger) · (\d+)\/(\d+) readings$/,m=>`Tahap tolok: ${{normal:'normal',alert:'waspada',warning:'amaran',danger:'bahaya'}[m[1]]} · ${m[2]}/${m[3]} bacaan`,m=>`水位等级：${{normal:'正常',alert:'警戒',warning:'警报',danger:'危险'}[m[1]]} · ${m[2]}/${m[3]} 个读数`],
  [/^Rivers: verify data · (\d+)\/(\d+) readings$/,m=>`Sungai: sahkan data · ${m[1]}/${m[2]} bacaan`,m=>`河流：请核实数据 · ${m[1]}/${m[2]} 个读数`],
  [/^(\d+)\/(\d+) readings in payload$/,m=>`${m[1]}/${m[2]} bacaan dalam data`,m=>`数据中有 ${m[1]}/${m[2]} 个读数`],
  [/^Selected scope:$/,()=>`Skop dipilih:`,()=>`所选范围：`],
  [/^readings in payload$/,()=>`bacaan dalam data`,()=>`个读数（数据快照）`],
  [/^Alert from (.+) m$/,m=>`Waspada mulai ${m[1]} m`,m=>`警戒水位 ${m[1]} 米`],
  [/^Trace (.+) on map$/,m=>`Jejak ${m[1]} pada peta`,m=>`在地图追踪 ${m[1]}`],
  [/^(\d+) mapped drainage segments · (.+) km connected reach$/,m=>`${m[1]} segmen saliran dipetakan · ${m[2]} km bersambung`,m=>`${m[1]} 段已测绘排水线 · 连通长度 ${m[2]} 公里`],
  [/^River flow (.+) m³\/s$/,m=>`Aliran sungai ${m[1]} m³/s`,m=>`河流流量 ${m[1]} m³/s`],
  [/^([\d.]+) mm expected today$/,m=>`${m[1]} mm dijangka hari ini`,m=>`今日预计 ${m[1]} 毫米`],
  [/^Rain: ([\d.]+)mm in the next hours — ([\d.]+) mm expected today$/,m=>`Hujan: ${m[1]} mm dalam beberapa jam akan datang; ${m[2]} mm dijangka hari ini`,m=>`降雨：未来数小时 ${m[1]} 毫米，今日预计 ${m[2]} 毫米`],
  [/^Air: AQI ([\d.]+) — (.+)$/,m=>`Udara: AQI ${m[1]} — ${{Good:'Baik',Moderate:'Sederhana',Sensitive:'Kumpulan sensitif',Unhealthy:'Tidak sihat',Hazardous:'Berbahaya'}[m[2]] || m[2]}`,m=>`空气：AQI ${m[1]} — ${{Good:'良好',Moderate:'中等',Sensitive:'敏感人群需留意',Unhealthy:'不健康',Hazardous:'危险'}[m[2]] || m[2]}`],
  [/^(\d+) arrivals \/ (\d+) departures$/,m=>`${m[1]} ketibaan / ${m[2]} pelepasan`,m=>`${m[1]} 架抵达／${m[2]} 架离港`],
  [/^River rising — p90 (\d+) m³\/s in (\d+)d$/,m=>`Aliran sungai meningkat — p90 ${m[1]} m³/s dalam ${m[2]} hari`,m=>`河流流量上升 — ${m[2]} 天内 p90 为 ${m[1]} m³/s`],
  [/^Air quality may degrade — p90 AQI (\d+) in (\d+)d$/,m=>`Kualiti udara mungkin merosot — p90 AQI ${m[1]} dalam ${m[2]} hari`,m=>`空气质量可能恶化 — ${m[2]} 天内 p90 AQI 为 ${m[1]}`],
  [/^(.+) is backup feed$/,m=>`${m[1]} menggunakan suapan sandaran`,m=>`${m[1]} 使用备用数据`],
  [/^(.+) is offline$/,m=>`${m[1]} luar talian`,m=>`${m[1]} 离线`],
  [/^Ward (\w+)$/,m=>`Zon ${m[1]}`,m=>`选区 ${m[1]}`],
  [/^(.+): (queued|active|done)\. Change local task status$/,m=>`${m[1]}: ${{queued:'menunggu',active:'sedang dibuat',done:'selesai'}[m[2]]}. Tukar status tugas setempat`,m=>`${m[1]}：${{queued:'待处理',active:'处理中',done:'已完成'}[m[2]]}。更改本机任务状态`],
  [/^(\d+) official notices, (\d+) English items, (\d+) Bahasa items, and (\d+) Chinese items are in the current Kuching watch window\.$/,m=>`Dalam tempoh pemantauan Kuching: ${m[1]} notis rasmi, ${m[2]} berita Inggeris, ${m[3]} berita Bahasa Melayu dan ${m[4]} berita Cina.`,m=>`古晋当前监测时段：${m[1]} 则官方通知、${m[2]} 则英文、${m[3]} 则马来文和 ${m[4]} 则中文报道。`],
];

// Compatibility layer for the existing vanilla-JS renderers. Changes text
// nodes/accessible labels only, preserving DOM identity, Leaflet and handlers.
export function setupUiLanguage(base, initialLanguage = 'en') {
  const translate = createTranslator(base);
  let language = initialLanguage;
  const originals = new WeakMap();
  const excluded = 'script,style,canvas,svg,#operatorGuide,.operator-tools,#mppServices,[data-original-source]';
  const observer = new MutationObserver(records => {
    const roots = new Set(records.map(record => record.target.nodeType === 3 ? record.target.parentElement : record.target));
    observer.disconnect();
    roots.forEach(root => apply(root));
    observe();
  });
  function apply(root) {
    if (!root || root.nodeType !== 1 || root.closest(excluded)) return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (!node.parentElement || node.parentElement.closest(excluded)) continue;
      const previous = originals.get(node);
      const original = previous && node.data === previous.output ? previous.original : node.data;
      const output = translate(original,language);
      originals.set(node,{original,output});
      if (output !== node.data) node.data = output;
    }
    for (const element of [root,...root.querySelectorAll('[title],[aria-label],[placeholder]')]) {
      if (element.closest(excluded)) continue;
      for (const attr of ['title','aria-label','placeholder']) if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr), output = translate(value,language);
        if (value !== output) element.setAttribute(attr,output);
      }
    }
  }
  function observe() { observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']}); }
  document.addEventListener('operator-language',event=>{
    language = event.detail;
    observer.disconnect();
    apply(document.body);
    observe();
  });
  apply(document.body); observe();
  return translate;
}
