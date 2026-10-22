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
      title: L("Public sources", "Sumber awam", "公共来源"),
      role: L("Observations, models and accounts", "Pemerhatian, model dan laporan", "观测、模型与报道"),
      desc: L(
        "JPS water levels and NREB readings are observations. Open-Meteo is model output; satellite detections and published news are different evidence types. Optional feeds may be disconnected. Citizen accounts are not independently verified here.",
        "Paras air JPS dan bacaan NREB ialah pemerhatian. Open-Meteo ialah output model; pengesanan satelit dan berita ialah jenis bukti berbeza. Suapan pilihan mungkin tidak disambungkan. Laporan awam tidak disahkan secara bebas di sini.",
        "JPS水位与NREB读数属于观测。Open-Meteo是模型输出；卫星探测与新闻是不同证据。部分可选数据源可能未接入，市民报告不在此独立核实。"
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
      title: L("Checks and interpretation", "Semakan dan tafsiran", "检查与解释"),
      role: L("Deterministic Validation", "Pengesahan Deterministik", "确定性校验与防幻觉"),
      desc: L(
        "Climate loaders check finite values, time and complete windows. Map renderers check regional bounds. The wind path is a simplified model. These checks reduce specific errors; they do not certify every input or establish causation.",
        "Pemuat iklim menyemak nilai, masa dan tetingkap lengkap. Peta menyemak sempadan wilayah. Laluan angin ialah model ringkas. Semakan ini mengurangkan ralat tertentu, bukan mengesahkan semua input atau sebab kejadian.",
        "气候加载器检查数值、时间与完整时段，地图渲染器检查区域边界。风向轨迹是简化模型。这些检查减少特定错误，并不认证所有输入或证明因果关系。"
      ),
      rule: L(
        "A geographic bounds check is not a surveyed boundary. A nearby waterway does not establish flow direction, flood depth or exposure at a locality.",
        "Semakan sempadan geografi bukan sempadan ukur. Saliran berhampiran tidak membuktikan arah aliran, kedalaman banjir atau pendedahan lokaliti.",
        "地理范围检查不等于测绘边界；附近水道不能证明流向、洪水深度或聚落暴露情况。"
      ),
    },
    {
      id: "vault",
      step: "03",
      pillar: L("Pillar 3", "Tonggak 3", "第三支柱"),
      title: L("Dated snapshots", "Rakaman bertarikh", "带日期的快照"),
      role: L("A record of the last build", "Rekod binaan terakhir", "上次构建的记录"),
      desc: L(
        "The build writes a dashboard snapshot and map artifacts. Later builds replace them. This reduces dependence on live upstream requests but does not guarantee availability or archive every raw response. Check each observation time.",
        "Binaan menulis rakaman papan dan artifak peta. Binaan kemudian menggantikannya. Ini mengurangkan kebergantungan pada permintaan langsung tetapi tidak menjamin ketersediaan atau mengarkibkan setiap respons asal. Semak masa setiap pemerhatian.",
        "构建生成看板快照及地图文件，后续构建会替换它们。这减少对即时上游请求的依赖，但不保证可用性，也不归档所有原始响应。请核对每项观测时间。"
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
      title: L("Map and human decisions", "Peta dan keputusan manusia", "地图与人工决策"),
      role: L("Decision support, not dispatch", "Sokongan keputusan, bukan penghantaran", "辅助决策，并非调度"),
      desc: L(
        "The map is the main view. Briefs, news, agency readings, contacts and evidence sit beside it on desktop and follow it on a phone. Open details when needed instead of showing every explanation at once.",
        "Peta ialah paparan utama. Ringkasan, berita, bacaan agensi, hubungan dan bukti berada di sisinya pada desktop dan selepasnya pada telefon. Buka butiran apabila perlu, bukan semua penjelasan serentak.",
        "地图是主视图。桌面上的简报、新闻、机构读数、联系方式和证据位于地图旁，手机上位于地图之后。按需打开详情，不必同时显示所有说明。"
      ),
      rule: L(
        "Published council and agency channels support the next human check. Confirm who is responsible; this board does not assign or acknowledge official work orders.",
        "Saluran majlis dan agensi menyokong semakan manusia seterusnya. Sahkan pihak bertanggungjawab; papan ini tidak menugaskan atau mengesahkan arahan kerja rasmi.",
        "通过公布的市议会与机构渠道进行下一步人工核查。请确认责任单位；本看板不分派或签收正式工单。"
      ),
    },
  ],
  schematic: `[ 01 PUBLIC SOURCES ] Observations · Models · Satellite products · News · Optional reports
       │
       ▼
[ 02 CHECKS ]         Time · Units · Coverage · Explicit spatial assumptions
       │
       ▼
[ 03 SNAPSHOT ]       Last build · Source timestamps · Missing feeds remain visible
       │
       ▼
[ 04 HUMAN DECISION ] Map context · Inspect evidence · Confirm through agency channels`,
  laws: [
    {
      name: L("Law of Spatial Grounding", "Hukum Ketetapan Ruang", "空间锚定法则"),
      text: L(
        "Coordinate validity is a data-quality check. Spatial hallucination (SH) is a separate design failure: space without a reading or task purpose. The owner's MSH law addresses that interface geometry.",
        "Kesahan koordinat ialah semakan kualiti data. Halusinasi ruang (SH) ialah kegagalan reka bentuk berasingan: ruang tanpa tujuan membaca atau bertugas. Hukum MSH pemilik menangani geometri antara muka itu.",
        "坐标有效性属于数据质量检查。空间幻觉（SH）是另一种设计问题：空间占用缺乏阅读或任务目的。所有者的MSH原则针对界面几何。"
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
        "Keep the evidence beside the decision. Missing service ownership or location remains unknown until confirmed; a suggested check is not an official instruction.",
        "Letakkan bukti bersama keputusan. Tanggungjawab perkhidmatan atau lokasi yang tiada kekal tidak diketahui sehingga disahkan; cadangan semakan bukan arahan rasmi.",
        "证据应紧邻决策。服务责任或位置缺失时，须保留未知直至确认；建议核查不等于正式指令。"
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
  aqi: [], // Selected NREB observation or Open-Meteo model; not an AND dependency.
  gauges: ["did-ihydro"],
  rainregime: ["rain-regime"],
  floodforecast: [], // Direct GloFAS artifact, not the composite action card.
  timesfm: [],
  growth: [],
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
      "The build combines loader results into dashboard.json and map files. Snapshots can be stale or incomplete; they do not guarantee an outage-free page.",
      "Binaan menggabungkan hasil pemuat ke dashboard.json dan fail peta. Rakaman boleh lama atau tidak lengkap; ia tidak menjamin halaman bebas gangguan.",
      "构建将加载结果汇入dashboard.json与地图文件。快照可能过时或不完整，不保证页面永不中断。",
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
    is: L("Dated NREB Kuching API when available; otherwise the Open-Meteo US AQI model. These are different scales and sources.", "API NREB Kuching bertarikh jika tersedia; jika tiada, model AQI AS Open-Meteo. Skala dan sumber ini berbeza.", "优先显示有日期的NREB古晋API，否则显示Open-Meteo美国AQI模型。两者量表与来源不同。"),
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
    is: L("GloFAS modelled discharge in cubic metres per second, with a dated ensemble outlook.", "Aliran model GloFAS dalam meter padu sesaat, dengan unjuran ensemble bertarikh.", "GloFAS模型流量，单位为立方米每秒，附带日期的集合预报。"),
    limit: L("A model range, not a flood warning. Never treat the upper band as a river level.", "Julat model, bukan amaran banjir. Jangan anggap julat atas sebagai paras sungai.", "模型区间，而非洪水警报。切勿将上界视为河流水位。"),
  },
  {
    id: "timesfm", signal: L("Experimental outlook", "Unjuran eksperimen", "实验性展望"),
    is: L("TimesFM fourteen-day forecast artifact, generated by the local pipeline at its stated date.", "Artifak ramalan empat belas hari TimesFM, dijana saluran tempatan pada tarikh dinyatakan.", "本地管线在所示日期生成的TimesFM十四日预报文件。"),
    limit: L("Not an agency flood warning. An old artifact is an archive, not today's forecast.", "Bukan amaran banjir agensi. Artifak lama ialah arkib, bukan ramalan hari ini.", "并非机构洪水警报。旧文件是存档，不是今日预报。"),
  },
  {
    id: "growth",
    signal: L("Satellite growth", "Pertumbuhan satelit", "卫星增长"),
    is: L("Built-up area and impervious surface compared between satellite passes.", "Kawasan terbina dan permukaan tidak lutus dibandingkan antara laluan satelit.", "卫星过境之间对比建成区与不透水面。"),
    limit: L("Embedding change is not proof of construction or its cause. Compare the stated years and area; imagery availability alone does not validate change.", "Perubahan embedding bukan bukti pembinaan atau puncanya. Bandingkan tahun dan kawasan dinyatakan; imej tersedia sahaja tidak mengesahkan perubahan.", "嵌入变化不能证明建设或其原因。请核对年份和范围；有影像不等于变化已获验证。"),
  },
  {
    id: "localities",
    signal: L("Localities", "Localiti", "聚落"),
    is: L("Named entries from the MPP directory, with locality codes and known ward links. No precise coordinates are supplied.", "Entri bernama daripada direktori MPP, dengan kod lokaliti dan hubungan wad diketahui. Tiada koordinat tepat dibekalkan.", "MPP目录中的具名条目，附聚落代码及已知辖区关联，不提供精确坐标。"),
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
