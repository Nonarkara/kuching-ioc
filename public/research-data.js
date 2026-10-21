// Research & blueprint content for the board's Research tab.
//
// Two rules govern this file:
//
//   1. Every limitation below is a statement about the real system, written
//      from the code, not a disclaimer that could mean anything. If a feed
//      changes, the row changes with it. The renderer prints the live status
//      and observation age beside each row, so a row cannot quietly outlive
//      the thing it describes.
//   2. Nothing here is illustrative. There is no demo mode and no sample
//      reading. A reader who copies a number out of this board must be able to
//      come back and find out where it came from.
//
// The audience is twofold: an operator deciding whether to trust a panel, and a
// council officer or hobbyist who wants to change something. Hence recipes as
// well as references.

const L = (en, ms, zh) => ({ en, ms, zh });

// Four operational pillars of the Integrated Operations Center blueprint.
// Written in accessible language for city operators, councillors, and citizens.
export const SYSTEM_BLUEPRINT = {
  pillars: [
    {
      id: "sensors",
      step: "01",
      pillar: L("Pillar 1", "Tonggak 1", "第一支柱"),
      title: L("Sensor Mesh & Telemetry Feeds", "Jaringan Sensor & Suapan Telemetri", "传感器网络与遥测馈送"),
      role: L("Physical Observation", "Cerapan Fizikal", "物理实体观测"),
      desc: L(
        "Ingests real ground readings from JPS river gauges, DOE/NREB air quality stations, Open-Meteo numerical weather forecasts, NASA FIRMS thermal anomaly satellites, OpenSky ADS-B transponders, and verified citizen reports.",
        "Menerima bacaan fizikal sebenar daripada tolok sungai JPS, stesen kualiti udara DOE/NREB, ramalan cuaca berangka Open-Meteo, satelit anomali haba NASA FIRMS, transponder ADS-B OpenSky dan aduan awam yang disahkan.",
        "接入来自砂水利局河流传感器、环境局/天然资源与环境局空气站、Open-Meteo 数值气象预报、NASA FIRMS 卫星热异常、OpenSky 航空应答机及已核实市民报案的真实读数。"
      ),
      rule: L(
        "No phantom telemetry: gauges and stations without live readings are flagged degraded or missing — never synthesized into false green.",
        "Tiada telemetri hantu: tolok dan stesen tanpa bacaan langsung ditandakan terjejas atau hilang — tidak sekali-kali disintesis menjadi hijau palsu.",
        "拒绝虚构遥测：无实时读数的测站一律标为降级或缺失，绝不用合成数据粉饰安全假象。"
      ),
    },
    {
      id: "engine",
      step: "02",
      pillar: L("Pillar 2", "Tonggak 2", "第二支柱"),
      title: L("Truth Engine & Spatial Guard", "Enjin Kebenaran & Pengawal Ruang", "真实性引擎与空间防幻觉守卫"),
      role: L("Deterministic Validation", "Pengesahan Deterministik", "确定性校验与防幻觉"),
      desc: L(
        "Enforces strict finite number validation, runs 48h backward air path trajectories, and applies spatial guards that eliminate Null Island [0,0], horizon ellipsoid blowouts, and inverted lat/long.",
        "Menguatkuasakan pengesahan nombor terhad, mengira lintasan undur udara 48 jam, dan menggunakan pengawal ruang untuk menghapuskan Pulau Sifar [0,0], herotan ufuk Cesium dan lat/long terbalik.",
        "执行严格的有限数值校验，运算 48 小时反向风场轨迹，并实施空间防幻觉守卫以根除零岛 [0,0]、地平线发散及经纬度倒置。"
      ),
      rule: L(
        "Spatial bounding laws: points outside the Borneo/Sarawak theater are rejected at intake; hydro catchment snapping refuses to connect waterways farther than 2 km.",
        "Hukum sempadan ruang: koordinat di luar Sarawak/Borneo ditolak semasa pengambilan; penarikan lembangan hidrologi enggan menyambung aliran lebih 2 km.",
        "空间界限法则：砂拉越/婆罗洲战区之外的坐标在入口处即被拒收；水文汇水区吸附拒绝连接 2 公里之外的水道。"
      ),
    },
    {
      id: "vault",
      step: "03",
      pillar: L("Pillar 3", "Tonggak 3", "第三支柱"),
      title: L("Immutable Snapshot Vault", "Kubah Rakaman Kebal", "不可变快照保全库"),
      role: L("Zero-Downtime Resilience", "Ketahanan Sifar Masa Henti", "零停机脱机韧性"),
      desc: L(
        "Bakes all validated streams into deterministic, static JSON snapshots (dashboard.json). The board queries local snapshots so upstream API crashes or external internet failures cannot crash the cockpit.",
        "Membakar semua aliran disahkan ke dalam rakaman statik JSON yang deterministik (dashboard.json). Papan membaca fail tempatan supaya kegagalan API luar tidak meruntuhkan kokpit.",
        "将所有验证后的数据流烘焙为确定性静态 JSON 快照（dashboard.json）。看板直接读取本地快照，因此上游接口故障或外网中断绝不会拖垮指挥舱。"
      ),
      rule: L(
        "Honest gaps: if upstream sources are unreachable, the board publishes the exact observation age rather than an illusion of current reality.",
        "Jurang jujur: jika sumber gagal dihubungi, papan menerbitkan umur cerapan sebenar dan bukan ilusi realiti terkini.",
        "诚实的空缺：若上游来源失联，看板如实公布其实际观测时效，绝不掩饰为最新现状。"
      ),
    },
    {
      id: "cockpit",
      step: "04",
      pillar: L("Pillar 4", "Tonggak 4", "第四支柱"),
      title: L("Unified War-Room Cockpit", "Kokpit Bilik Gerakan Bersepadu", "战情室一体化指挥舱"),
      role: L("Tactical Decision Support", "Sokongan Keputusan Taktikal", "战术决策执行"),
      desc: L(
        "A 3-column operator console: Left rail (morning briefs, news intake, analytical insights), Hero Center (Padawan vs Greater Kuching scope switch, 2D Leaflet GIS, 3D Cesium digital twin, analytical deep tray), Right rail (official emergency directory, flood readiness protocols, client charter KPIs).",
        "Konsol pengendali 3 lajur: Lajur kiri (taklimat pagi, suapan berita, pandangan analitik), Pusat Hero (suis skop Padawan/Kuching, GIS 2D Leaflet, kembar digital 3D Cesium, dulang analitik), Lajur kanan (direktori kecemasan rasmi, protokol banjir, KPI piagam pelanggan).",
        "三栏操作员控制台：左栏（晨报、多语种新闻摄入、分析研判），英雄中心位（巴达旺与大古晋视野切换、2D Leaflet GIS、3D Cesium 数字孪生、深度分析托盘），右栏（官方应急通讯录、防汛响应预案、客户宪章 KPI）。"
      ),
      rule: L(
        "Observe-to-act chain: telemetry without an operational owner is noise. Every critical alert maps directly to a direct phone number, responsible desk, and verified field procedure.",
        "Rantaian pantau-ke-tindakan: telemetri tanpa pemilik operasi ialah hingar. Setiap amaran kritikal dipautkan terus ke nombor telefon, pegawai bertugas dan prosedur lapangan yang sah.",
        "观察到行动闭环：缺乏责任经办人的遥测纯属噪音。每一项危急警报均直通直拨电话、责任科室及经过核验的现场预案。"
      ),
    },
  ],
  schematic: `[ 01 SENSOR MESH ]    DID iHYDRO · APIMS Air · MetMalaysia · NASA FIRMS · OpenSky · Citizen Reports
       │
       ▼
[ 02 TRUTH ENGINE ]   Contract Validation · Spatial Guard (No [0,0], No Inversions) · 48h Air Path
       │
       ▼
[ 03 SNAPSHOT VAULT ] Deterministic JSON · Zero-Downtime Resilience · Honest Observation Timestamps
       │
       ▼
[ 04 WAR ROOM ]       3-Column Cockpit · Padawan / Greater Kuching Scope · Observe-to-Act Protocol`,
  laws: [
    {
      name: L("Law of Spatial Grounding", "Hukum Ketetapan Ruang", "空间锚定法则"),
      text: L(
        "Every coordinate on screen must exist within the real Sarawak / Borneo theater. Null Island [0,0], inverted lat/long, and horizon-grazing 3D camera projections are rejected before they touch the DOM or map canvas.",
        "Setiap koordinat pada skrin mesti wujud dalam wilayah Sarawak / Borneo sebenar. Pulau Sifar [0,0], lat/long terbalik dan unjuran ufuk 3D ditolak sebelum menyentuh kanvas peta.",
        "屏幕上的每个坐标必须真实存在于砂拉越/婆罗洲战区之内。零岛 [0,0]、经纬度颠倒及地平线 3D 投影在触及 DOM 或地图画布前即被剔除。"
      ),
    },
    {
      name: L("Law of Civic Honesty", "Hukum Kejujuran Awam", "市政诚实法则"),
      text: L(
        "The board never invents green status. Missing, degraded, or delayed data is plainly declared with its real source age. An empty or offline gauge is never reported as normal.",
        "Papan tidak sekali-kali mencipta status hijau palsu. Data yang hilang, terjejas atau tertangguh dinyatakan dengan umur sumber sebenar. Tolok kosong atau luar talian tidak sekali-kali dilaporkan sebagai normal.",
        "面板绝不虚构安全绿灯。缺失、降级或延迟的数据均明确标明其实际时效。空白或离线的水位站绝不谎报为正常。"
      ),
    },
    {
      name: L("Law of Operational Actionability", "Hukum Kebolehtindakan Operasi", "实战行动力法则"),
      text: L(
        "Observability without an operational owner is waste. Every warning, risk zone, and tension hotspot links to a direct extension, a verified desk, and a concrete action protocol.",
        "Kebolehlihatan tanpa pemilik operasi adalah sia-sia. Setiap amaran, zon risiko dan titik ketegangan memaut ke sambungan telefon langsung, pegawai bertugas dan protokol tindakan konkrit.",
        "缺乏处置责任主体的可观测性毫无价值。每一个警报、风险区与矛盾焦点均关联直拨分机、核准经办科室与具体执行方案。"
      ),
    },
  ],
};

// Which live feeds each dictionary row depends on. The glyph in the status
// column shows the WORST of these, because a row resting on two sources is only
// as good as its weaker one. Kept beside the prose so a new row cannot ship
// without deciding where its status comes from.
export const DICT_SOURCE_IDS = {
  weather: ["open-meteo-weather"],
  aqi: ["open-meteo-air", "doe-apims"],
  gauges: ["did-ihydro"],
  rainregime: ["rain-regime"],
  floodforecast: ["did-ihydro", "flood-action"],
  growth: ["nasa-gibs"],
  localities: ["mpp-localities"],
  census: ["gov-stats"],
  warnings: ["official-warnings"],
  aircraft: ["opensky"],
  news: ["google-news-en", "google-news-ms", "google-news-zh"],
};

// How a single reading reaches the screen. Same shape as the sibling atlases,
// except the last stage is a static snapshot rather than an edge worker, so
// there is a fourth possibility worth naming: the visitor's own browser.
export const PIPELINE = [
  {
    step: "1",
    title: L("Source", "Sumber", "来源"),
    body: L(
      "A public API, an agency page, or an open data file. Nothing here needs an account except two feeds that stay dark until a key is configured.",
      "API awam, laman Ibidah, atau fail data terbuka. Tiada akaun diperlukan kecuali dua suapan yang kekal gelap sehingga kunci dikonfigurasikan.",
      "公共 API、机构网页或开放数据文件。除两个需要密钥的馈送外，无需账号。",
    ),
  },
  {
    step: "2",
    title: L("Loader", "Pemuat", "加载器"),
    body: L(
      "server.mjs fetches it on a timeout and a cache, then validates it. A reading that arrives incomplete is never labelled live — it is marked degraded and the failing fields are named.",
      "server.mjs mengambilnya dengan tamat masa dan cache, kemudian validatesnya. bacaan yang tidak lengkap tidak akan ditandakan langsung — ia ditanda degraded dan medan yang gagal dinamakan.",
      "server.mjs 以超时和缓存抓取并校验。不完整的读数绝不标记为实时——标记为 degraded 并列出失败字段。",
    ),
  },
  {
    step: "3",
    title: L("Snapshot", "Rakaman", "快照"),
    body: L(
      "Every loader writes one JSON file. The board reads that file, so a bad fetch can never take the page down — the worst case is an honest gap, not a blank screen.",
      "Setiap pemuat menulis satu fail JSON. Papan membaca fail itu, jadi kegagalan tidak boleh menjatuhkan halaman — kes terburuk ialah jurang yang jujur, bukan skrin kosong.",
      "每个加载器写入一个 JSON 文件。面板读取该文件，因此抓取失败不会导致页面崩溃——最坏情况是诚实的空缺，而非空白屏幕。",
    ),
  },
  {
    step: "4",
    title: L("Renderer", "Pelukis", "渲染器"),
    body: L(
      "app.js draws it, or the visitor's browser completes it live if the build machine could not reach a source. A reading never arrives without its source, tier and age attached.",
      "app.js melukisnya, atau pelayar pelawat melengkapkan secara langsung jika mesin binaan tidak dapat menjangkau sumber. Setiap bacaan membawa sumber, peringkat dan umurnya.",
      "app.js 绘制它；若构建机器无法访问来源，则由访客浏览器实时补全。每个读数都附带来源、层级与时效。",
    ),
  },
];

// The dictionary. "Limit" is the column that matters — it is what stops a
// reader over-reading a panel.
export const DICTIONARY = [
  {
    id: "weather",
    signal: L("Weather", "Cuaca", "天气"),
    is: L("Temperature, humidity, wind, rain probability and UV from the Open-Meteo model.", "Suhu, kelembapan, angin, kebarangkalian hujan dan UV daripada model Open-Meteo.", "来自 Open-Meteo 模型的温度、湿度、风、降雨概率与紫外线。"),
    limit: L("A model grid point, not a weather station. It can disagree with the rain on the ground.", "Titik grid model, bukan stesen cuaca. Ia boleh bercanggah dengan hujan sebenar.", "模型网格点，并非气象站。可能与地面实际降雨不符。"),
  },
  {
    id: "aqi",
    signal: L("Air quality", "Kualiti udara", "空气质量"),
    is: L("US AQI and particulate readings, preferring Sarawak ground stations when a key is configured.", "AQI AS dan bacaan particulate, mengutamakan stesen ground Sarawak apabila kunci dikonfigurasikan.", "美国 AQI 与颗粒物读数，配置密钥后优先使用砂拉越地面站。"),
    limit: L("Modelled AQI can be driven by ozone rather than PM2.5, so a moderate band is not always good air.", "AQI model boleh digerakkan ozon bukan PM2.5, jadi jalur sederhana tidak sentiasa udara baik.", "模型 AQI 可能由臭氧而非 PM2.5 驱动，因此“中等”不一定代表空气好。"),
  },
  {
    id: "gauges",
    signal: L("River gauges", "Tolok sungai", "水位站"),
    is: L("Water levels at DID Sarawak iHYDRO stations in the Sarawak basin.", "Tahap air di stesen DID Sarawak iHYDRO dalam lembah Sarawak.", "砂拉越水利局 iHYDRO 站点水位。"),
    limit: L("A gauge that reports nothing is not a gauge that is fine. The board distinguishes the two.", "Tolok yang tiada bacaan bukan tolok yang selamat. Papan membezakannya.", "无读数的水位站不等于水位正常。面板会区分两者。"),
  },
  {
    id: "rainregime",
    signal: L("Rain regime", "Regim hujan", "降雨形势"),
    is: L("A rule-based label — monsoon, tropical system or local convection — with its evidence listed.", "Label berasaskan peraturan — monsun, sistem tropika atau konveksi tempatan — bersama bukti.", "基于规则的标签——季风、热带系统或局地对流——并附证据。"),
    limit: L("Not a MetMalaysia classification. It is this board's rule set, and it says so on screen.", "Bukan klasifikasi MetMalaysia. Ia peraturan papan ini, dan papan menyatakannya.", "不是大马气象局的分类，而是本面板的规则集，面板已明示。"),
  },
  {
    id: "floodforecast",
    signal: L("River forecast", "Ramalan sungai", "河流预报"),
    is: L("A 14-day probability band from a foundation model, refreshed by a local pipeline.", "Julat kebarangkalian 14 hari daripada model asas, disegarkan oleh saluran paip tempatan.", "本地管线刷新的 14 天概率带，来自基础模型。"),
    limit: L("A model range, not a flood warning. Never treat the upper band as a river level.", "Julat model, bukan amaran banjir. Jangan anggap julat atas sebagai paras sungai.", "模型区间，而非洪水警报。切勿将上界视为河流水位。"),
  },
  {
    id: "growth",
    signal: L("Satellite growth", "Pertumbuhan satelit", "卫星增长"),
    is: L("Built-up area and impervious surface compared between satellite passes.", "Kawasan terbina dan permukaan tidak lutus dibandingkan antara laluan satelit.", "卫星过境之间对比建成区与不透水面。"),
    limit: L("Most building heights are estimates. A footprint count is not a building census.", "Kebanyakan tinggi bangunan ialah anggaran. Kiraan jejak bukan bancii bangunan.", "多数建筑高度为估算。轮廓计数不等于建筑普查。"),
  },
  {
    id: "localities",
    signal: L("Localities", "Localiti", "聚落"),
    is: L("Named settlements with coordinates, from open map data.", "Kampung bertanah dengan koordinat, daripada data peta terbuka.", "来自开放地图数据的具名聚落及坐标。"),
    limit: L("A place name is not a population register and the board does not pretend it is.", "Nama tempat bukan daftar penduduk dan papan tidak berpura-pura.", "地名不等于人口登记，面板不作此声称。"),
  },
  {
    id: "census",
    signal: L("Census", "Banci", "人口普查"),
    is: L("DOSM figures at district level, used for share and density.", "Angka DOSM peringkat daerah, digunakan untuk bahagian dan ketumpatan.", "统计局地区层级数据，用于占比与密度。"),
    limit: L("District level. Padawan's internal ward split is not in the census and is not invented here.", "Peringkat daerah. Pecahan ward dalaman MPP tiada dalam bancii dan tidak dikarang di sini.", "地区层级。MPP 内部分区不在普查中，本面板也不臆造。"),
  },
  {
    id: "warnings",
    signal: L("Official warnings", "Amaran rasmi", "官方警报"),
    is: L("MET Malaysia bulletins, filtered to the Sarawak-relevant set.", "Buletin MetMalaysia, ditapis kepada set berkaitan Sarawak.", "大马气象局公告，筛选出与砂拉越相关的部分。"),
    limit: L("Reproduced as published. The board adds no warning of its own and holds no authority to issue one.", "Dis reproductions sebagaimana diterbitkan. Papan tidak menambah amaran sendiri.", "按发布原样呈现。面板不自行发布任何警报，亦无权发布。"),
  },
  {
    id: "aircraft",
    signal: L("Aircraft", "Pesawat", "航空器"),
    is: L("ADS-B positions near Kuching International Airport.", "Kedudukan ADS-B berhampiran Lapangan Terbang Antarabangsa Kuching.", "古晋国际机场附近的 ADS-B 位置。"),
    limit: L("Volunteer receiver coverage, not official movement records.", "Liputan penerima sukarela, bukan rekod pergerakan rasmi.", "志愿者接收覆盖，并非官方起降记录。"),
  },
  {
    id: "news",
    signal: L("Press", "Berita", "新闻"),
    is: L("Headlines from official and mainstream sources across three languages.", "Tajuk daripada sumber rasmi dan mainstream dalam tiga bahasa.", "三种语言的官方与主流媒体标题。"),
    limit: L("Headlines, not reporting. The board carries no article text.", "Tajuk, bukan liputan. Papan tidak membawa teks artikel.", "仅为标题，非报道全文。面板不载文章正文。"),
  },
];

// Recipes. Each one names the file a maintainer actually opens — the point is
// that nobody has to read 6,000 lines to change the temperature source.
export const RECIPES = [
  {
    want: L("Change where weather comes from", "Tukar sumber cuaca", "更换天气来源"),
    do: L("server.mjs → loadWeather(); the fallback lives in buildWeatherFallback()", "server.mjs → loadWeather(); sandaran di buildWeatherFallback()", "server.mjs → loadWeather()；回退值在 buildWeatherFallback()"),
  },
  {
    want: L("Add a new feed", "Tambah suapan baharu", "新增数据馈送"),
    do: L("Write the loader in server.mjs, add its source record, then mirror the field in app.js → buildFallbackDashboard()", "Tulis pemuat dalam server.mjs, tambah rekod sumber, kemudian sal-medudukan medan dalam app.js", "在 server.mjs 编写加载器，添加来源记录，并在 app.js 中镜像该字段"),
  },
  {
    want: L("Turn a panel off", "Matikan sesuatu panel", "关闭某个面板"),
    do: L("Remove its section from index.template.html — the template, never index.html, which is generated", "Buang seksyennya daripada index.template.html — templat, bukan index.html yang dijana", "从 index.template.html 移除对应区块——是模板，不是生成的 index.html"),
  },
  {
    want: L("Change wording in three languages", "Tukar perkataan dalam tiga bahasa", "更改三种语言的措辞"),
    do: L("data.js → TRANSLATIONS; the en, ms and zh key sets must stay identical or the board falls back to English", "data.js → TRANSLATIONS; set kunci en, ms dan zh mesti kekal sama", "data.js → TRANSLATIONS；en、ms、zh 的键集必须保持一致"),
  },
  {
    want: L("Rebuild the snapshot", "Bina semula rakaman", "重建快照"),
    do: L("node build.mjs — boots a throwaway server, fetches every source, writes public/api/. Commit the result.", "node build.mjs —hidupkan pelayar sekali guna, ambil setiap sumber, tulis public/api/. Komit hasilnya.", "node build.mjs —— 启动临时服务器、抓取所有来源、写入 public/api/ 并提交结果。"),
  },
  {
    want: L("Change the layout", "Tukar susun atur", "更改布局"),
    do: L("styles.css and reading.css. reading.css owns the final layout rules and must not be fought by earlier styles.", "styles.css dan reading.css. reading.css memiliki peraturan susun atur akhir.", "styles.css 与 reading.css。reading.css 负责最终布局，不应与更早的样式冲突。"),
  },
];

// The most useful section for a sceptic.
export const OMISSIONS = [
  L(
    "No traffic, congestion or journey-time data: no open live source is wired in, and the board will not stand in a fake one.",
    "Tiada data lalu lintas, kesesakan atau masa perjalanan: tiada sumber langsung terbuka disambungkan, dan papan tidak akan menggantikan dengan data rekaan.",
    "无交通、拥堵或行程时间数据：未接入公开实时来源，面板也不会用虚假数据替代。",
  ),
  L(
    "No camera feed. CCTV imagery is illustration on the public landing page only, and the board says so wherever it appears.",
    "Tiada suapan kamera. Imej CCTV ialah ilustrasi pada halaman pendahulu awam sahaja.",
    "无摄像馈送。监控图像仅作公共落地页插图，面板出现之处均已说明。",
  ),
  L(
    "No household addresses, names or contact details of residents.",
    "Tiada alamat rumah, nama atau maklumat hubungan penduduk.",
    "不含居民住址、姓名或联系方式。",
  ),
  L(
    "No claim of official warning authority. This is decision support, not dispatch.",
    "Tiada tuntutan kuasa amaran rasmi. Ini sokongan keputusan, bukan penghantaran.",
    "不主张官方警报权限。这是决策支持，而非调度。",
  ),
];

// One line per release-relevant fact, assembled at render time from the live
// snapshot so it can never describe a build that is not on screen.
export function buildRecord(payload, manifest) {
  const sources = payload?.sources || [];
  const live = sources.filter((s) => s.status === "live" || s.status === "official").length;
  return {
    assetVersion: manifest?.assetVersion || payload?.delivery?.assetVersion || null,
    builtAt: manifest?.builtAt || payload?.generatedAt || null,
    mode: payload?.delivery?.mode || "unknown",
    total: sources.length,
    live,
    weather: payload?.climate?.weather?.status || "unknown",
    weatherObservedAt: payload?.climate?.weather?.observedAt || null,
    airObservedAt: payload?.climate?.air?.observedAt || null,
  };
}