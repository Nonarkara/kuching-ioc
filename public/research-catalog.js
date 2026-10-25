// SIC: task taxonomy informed by OSINT4ALL (CC0); verification guidance by
// Bellingcat's toolkit. Original descriptions below; no third-party feed code.
const L = (en, ms, zh, th) => ({ en, ms, zh, th });
export const CATALOG_VERSION = 'sic-2026-10-25-r2';
export const RESEARCH_COPY = {
  open: L('Investigate', 'Semak bukti', '核查资料', 'ตรวจสอบข้อมูล'),
  title: L('Check the evidence', 'Semak bukti dan sumber', '核查证据与来源', 'ตรวจสอบหลักฐานและแหล่งข้อมูล'),
  close: L('Close', 'Tutup', '关闭', 'ปิด'),
  language: L('Language', 'Bahasa', '语言', 'ภาษา'),
  task: L('What do you need to check?', 'Apa yang perlu disemak?', '您需要核查什么？', 'ต้องการตรวจสอบอะไร'),
  context: L('Selected on this dashboard', 'Dipilih pada papan ini', '本看板所选内容', 'ข้อมูลที่เลือกบนหน้าจอนี้'),
  noContext: L('No place or event selected. Select one on the dashboard, then return here; you can also browse these tools now.', 'Tiada tempat atau kejadian dipilih. Pilih pada papan, kemudian kembali ke sini; alat ini juga boleh dilayari sekarang.', '尚未选择地点或事件。可先在看板上选择后返回，也可直接浏览这些工具。', 'ยังไม่ได้เลือกสถานที่หรือเหตุการณ์ เลือกบนแดชบอร์ดแล้วกลับมา หรือดูเครื่องมือได้ทันที'),
  locationLimit: L('This is research context. This panel has not verified the event or its exact location.', 'Ini konteks penyelidikan. Panel ini belum mengesahkan kejadian atau lokasi tepatnya.', '此处仅提供研究背景，本面板未核实事件或其准确位置。', 'นี่คือบริบทสำหรับค้นคว้า หน้านี้ยังไม่ได้ยืนยันเหตุการณ์หรือตำแหน่งที่แน่นอน'),
  manual: L('Research links, not connected feeds. Opening this panel makes no requests to these providers. Links open their websites without sending your selection.', 'Pautan penyelidikan, bukan suapan tersambung. Membuka panel ini tidak menghubungi penyedia. Pautan membuka laman mereka tanpa menghantar pilihan anda.', '这些是研究链接，并非已接入的数据源。打开面板不会向这些服务发送请求；点击链接也不会传送您的所选内容。', 'เป็นลิงก์ค้นคว้า ไม่ใช่ฟีดที่เชื่อมต่อ การเปิดหน้านี้ไม่ส่งคำขอไปยังผู้ให้บริการ ลิงก์เปิดเว็บไซต์โดยไม่ส่งข้อมูลที่คุณเลือก'),
  website: L('Open research tool', 'Buka alat penyelidikan', '打开研究工具', 'เปิดเครื่องมือค้นคว้า'),
  provider: L('Provider', 'Penyedia', '提供者', 'ผู้ให้บริการ'),
  coverage: L('Coverage', 'Liputan', '覆盖范围', 'พื้นที่ครอบคลุม'),
  worldwide: L('Worldwide; availability varies by place', 'Seluruh dunia; ketersediaan berbeza mengikut tempat', '全球；各地数据可用性不同', 'ทั่วโลก ข้อมูลแต่ละพื้นที่อาจไม่เท่ากัน'),
  access: L('Access and reuse', 'Akses dan penggunaan semula', '访问与再利用', 'การเข้าถึงและการนำไปใช้'),
  terms: L('Manual website access. Accounts, charges and reuse terms depend on the provider; no API entitlement is included.', 'Akses laman secara manual. Akaun, caj dan syarat penggunaan semula bergantung pada penyedia; akses API tidak disertakan.', '手动访问网站；账号、费用与再利用条款以提供者为准，不包含API授权。', 'เปิดเว็บไซต์ด้วยตนเอง บัญชี ค่าใช้จ่าย และเงื่อนไขขึ้นกับผู้ให้บริการ ไม่รวมสิทธิ์ใช้ API'),
  checked: L('Availability', 'Ketersediaan', '可用性', 'สถานะการใช้งาน'),
  unverified: L('Not live-checked by this dashboard; the provider may be unavailable.', 'Tidak disemak secara langsung oleh papan ini; penyedia mungkin tidak tersedia.', '本看板未实时检查，服务可能不可用。', 'แดชบอร์ดไม่ได้ตรวจสอบแบบสด ผู้ให้บริการอาจใช้งานไม่ได้'),
  details: L('Access, coverage and credits', 'Akses, liputan dan kredit', '访问、覆盖与致谢', 'การเข้าถึง พื้นที่ และเครดิต'),
  method: L('How to make a defensible decision', 'Cara membuat keputusan berasaskan bukti', '如何形成有据可查的判断', 'ใช้หลักฐานประกอบการตัดสินใจอย่างไร'),
  funnel: L('Start with the original observation or report → check its time, place and method → compare independent evidence → show the limits → choose the next human check.', 'Mulakan dengan pemerhatian atau laporan asal → semak masa, tempat dan kaedah → bandingkan bukti bebas → nyatakan batasan → tentukan semakan manusia seterusnya.', '原始观测或报告 → 核对时间、地点和方法 → 对照独立证据 → 说明局限 → 决定下一步人工核查。', 'เริ่มจากการสังเกตหรือรายงานต้นฉบับ → ตรวจเวลา สถานที่ และวิธีการ → เทียบหลักฐานอิสระ → ระบุข้อจำกัด → เลือกสิ่งที่คนต้องตรวจต่อ'),
  caution: L('A model is not a local sensor. Missing data is not zero. Translations and syndicated copies of one report are not independent confirmations. Keep observation, publication and retrieval times separate.', 'Model bukan sensor setempat. Data tiada bukan sifar. Terjemahan dan salinan laporan bersindiket bukan pengesahan bebas. Bezakan masa pemerhatian, penerbitan dan pengambilan.', '模型不等于本地传感器，缺失数据不等于零。同一报道的译文和转载不构成独立佐证。请区分观测、发布与获取时间。', 'แบบจำลองไม่ใช่เซนเซอร์ในพื้นที่ ข้อมูลที่ขาดไม่ใช่ศูนย์ คำแปลและข่าวที่เผยแพร่ซ้ำไม่ใช่การยืนยันอิสระ แยกเวลาสังเกต เผยแพร่ และดึงข้อมูล'),
  credit: L('Discovery: OSINT4ALL contributors (CC0 collection). Verification guidance: Bellingcat. Tools and data belong to their original providers; inclusion is not endorsement.', 'Penemuan: penyumbang OSINT4ALL (koleksi CC0). Panduan pengesahan: Bellingcat. Alat dan data milik penyedia asal; penyenaraian bukan sokongan.', '工具发现：OSINT4ALL贡献者（CC0合集）。核查指引参考Bellingcat。工具与数据归原提供者所有，收录不代表背书。', 'ค้นพบเครื่องมือจากผู้ร่วมจัดทำ OSINT4ALL (คอลเลกชัน CC0) แนวทางตรวจสอบจาก Bellingcat เครื่องมือและข้อมูลเป็นของผู้ให้บริการเดิม การแสดงชื่อไม่ใช่การรับรอง'),
  record: L('Copy research context', 'Salin konteks penyelidikan', '复制研究背景', 'คัดลอกบริบทการค้นคว้า'),
  copied: L('Copied locally', 'Disalin secara setempat', '已复制到本地剪贴板', 'คัดลอกแล้ว'),
  copyFailed: L('Clipboard unavailable. Select and copy the context text instead.', 'Papan keratan tidak tersedia. Pilih dan salin teks konteks.', '剪贴板不可用，请选择并复制背景文字。', 'ใช้คลิปบอร์ดไม่ได้ โปรดเลือกและคัดลอกข้อความแทน'),
  observed: L('Observation time supplied by dashboard', 'Masa pemerhatian daripada papan', '看板提供的观测时间', 'เวลาสังเกตจากแดชบอร์ด'),
  event: L('Event date supplied by dashboard', 'Tarikh kejadian daripada papan', '看板提供的事件日期', 'วันที่เหตุการณ์จากแดชบอร์ด'),
  published: L('Publication time supplied by dashboard', 'Masa penerbitan daripada papan', '看板提供的发布时间', 'เวลาเผยแพร่จากแดชบอร์ด'),
};
export const RESEARCH_TASKS = {
  place: L('Locate a place', 'Kenal pasti tempat', '核对地点', 'ตรวจสอบสถานที่'),
  imagery: L('Compare imagery', 'Bandingkan imej', '对照影像', 'เปรียบเทียบภาพ'),
  media: L('Check a report or video', 'Semak laporan atau video', '核查报道或视频', 'ตรวจสอบรายงานหรือวิดีโอ'),
  transport: L('Civil shipping context', 'Konteks perkapalan awam', '民用航运背景', 'บริบทการเดินเรือพลเรือน'),
  records: L('Published organization records', 'Rekod organisasi diterbitkan', '已公开的机构记录', 'เอกสารองค์กรที่เผยแพร่แล้ว'),
};
const all = ['padawan', 'globalmonitor', 'asiawatch', 'mem'];
const geo = ['globalmonitor', 'asiawatch', 'mem'];
export const RESEARCH_TOOLS = [
  { id: 'osm', name: 'OpenStreetMap', provider: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/', task: 'place', systems: all,
    limit: L('Check names and mapped roads. Mapped geometry does not establish where an incident occurred or certify an administrative boundary.', 'Semak nama dan jalan dipetakan. Geometri peta tidak menentukan lokasi kejadian atau mengesahkan sempadan pentadbiran.', '可核对地名与道路；地图几何信息不能证明事件发生地点，也不能认证行政边界。', 'ตรวจชื่อและถนนบนแผนที่ได้ แต่รูปทรงบนแผนที่ไม่ยืนยันจุดเกิดเหตุหรือรับรองเขตปกครอง') },
  { id: 'mapillary', name: 'Mapillary', provider: 'Mapillary', url: 'https://www.mapillary.com/app/', task: 'place', systems: all,
    limit: L('Compare available street-level images and their capture dates. Old or missing imagery cannot establish current road conditions.', 'Bandingkan imej aras jalan dan tarikh rakaman. Imej lama atau tiada tidak dapat menentukan keadaan jalan semasa.', '可对照街景及拍摄日期；历史影像或影像缺失不能说明当前路况。', 'เทียบภาพระดับถนนและวันที่ถ่าย ภาพเก่าหรือพื้นที่ที่ไม่มีภาพไม่ยืนยันสภาพถนนปัจจุบัน') },
  { id: 'worldview', name: 'NASA Worldview', provider: 'NASA Earthdata', url: 'https://worldview.earthdata.nasa.gov/', task: 'imagery', systems: all,
    limit: L('Inspect dated satellite imagery. Check acquisition date, cloud cover and resolution; an image is not a local flood-depth measurement.', 'Periksa imej satelit bertarikh. Semak tarikh pemerolehan, awan dan resolusi; imej bukan ukuran kedalaman banjir setempat.', '可查看带日期的卫星影像。请核对成像日期、云量与分辨率；影像不等于本地洪水深度测量。', 'ดูภาพดาวเทียมตามวันที่ ตรวจวันถ่าย เมฆ และความละเอียด ภาพไม่ใช่ค่าความลึกน้ำท่วมในพื้นที่') },
  { id: 'firms', name: 'NASA FIRMS', provider: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/map/', task: 'imagery', systems: all,
    limit: L('Inspect thermal detections with sensor and observation time. A thermal anomaly alone does not establish a fire cause, a strike or damage.', 'Periksa pengesanan haba bersama sensor dan masa pemerhatian. Anomali haba sahaja tidak menentukan punca kebakaran, serangan atau kerosakan.', '查看热异常时请核对传感器与观测时间。单一热异常不能证明起火原因、袭击或损毁。', 'ตรวจจุดความร้อนพร้อมเซนเซอร์และเวลาสังเกต จุดความร้อนอย่างเดียวไม่ยืนยันสาเหตุไฟ การโจมตี หรือความเสียหาย') },
  { id: 'bellingcat', name: 'Bellingcat Toolkit', provider: 'Bellingcat', url: 'https://bellingcat.gitbook.io/toolkit', task: 'media', systems: all,
    limit: L('Find photo/video verification guidance, including InVID. Inspect the original upload and corroborate time and place; a tool result is not verification.', 'Cari panduan pengesahan foto/video termasuk InVID. Periksa muat naik asal dan sahkan masa serta tempat dengan bukti lain; hasil alat bukan pengesahan.', '可查找包括InVID在内的照片与视频核查指引。请查看原始上传并交叉核对时间和地点；工具结果不等于核实。', 'ค้นแนวทางตรวจภาพและวิดีโอ รวมถึง InVID ตรวจต้นฉบับและเทียบหลักฐานเวลาและสถานที่ ผลจากเครื่องมือยังไม่ใช่การยืนยัน') },
  { id: 'wayback', name: 'Wayback Machine', provider: 'Internet Archive', url: 'https://web.archive.org/', task: 'media', systems: all,
    limit: L('Compare archived public pages and capture dates. An archive records publication, not truth. Do not submit private reports or personal information.', 'Bandingkan halaman awam diarkibkan dan tarikh rakaman. Arkib merekod penerbitan, bukan kebenaran. Jangan hantar laporan peribadi atau maklumat peribadi.', '可对照公开网页的存档及抓取日期。存档记录的是发布内容，并不证明其真实。请勿提交私人报告或个人资料。', 'เทียบหน้าเว็บสาธารณะที่เก็บไว้และวันที่บันทึก การเก็บหน้าเว็บไม่ยืนยันว่าเนื้อหาจริง อย่าส่งรายงานส่วนตัวหรือข้อมูลบุคคล') },
  { id: 'vesselfinder', name: 'VesselFinder', provider: 'VesselFinder', url: 'https://www.vesselfinder.com/', task: 'transport', systems: geo,
    limit: L('Research civil shipping context. Check coverage and timestamps; missing AIS does not prove an empty sea. Website access does not include API or redistribution rights.', 'Selidik konteks perkapalan awam. Semak liputan dan masa; AIS tiada tidak membuktikan laut kosong. Akses laman tidak merangkumi hak API atau pengedaran semula.', '用于了解民用航运背景。请核对覆盖与时间；AIS缺失不代表海域无船。网站访问不包含API或再分发权限。', 'ศึกษาบริบทเรือพลเรือน ตรวจพื้นที่ครอบคลุมและเวลา ไม่มี AIS ไม่ได้แปลว่าไม่มีเรือ การเปิดเว็บไม่รวมสิทธิ์ API หรือเผยแพร่ข้อมูลต่อ') },
  { id: 'icij', name: 'ICIJ Offshore Leaks', provider: 'International Consortium of Investigative Journalists', url: 'https://offshoreleaks.icij.org/', task: 'records', systems: geo,
    limit: L('Consult historical leaked records, not a standardized registry. Names may be duplicated; verify identity and dates. A listing does not imply wrongdoing.', 'Rujuk rekod bocor sejarah, bukan daftar piawai. Nama mungkin berulang; sahkan identiti dan tarikh. Penyenaraian tidak membayangkan salah laku.', '这是历史泄露文件记录，并非标准化登记册。姓名可能重复，请核对身份与日期；被收录不代表有违法行为。', 'ใช้ค้นเอกสารรั่วไหลในอดีต ไม่ใช่ทะเบียนมาตรฐาน ชื่ออาจซ้ำ ต้องตรวจตัวตนและวันที่ การมีชื่อไม่ได้แปลว่ากระทำผิด') },
].map(tool => Object.freeze({ ...tool, accessMode: 'manual-link', feedStatus: 'not-connected', coverage: 'worldwide', lastChecked: null, reuse: 'provider-terms-unverified', discovery: 'OSINT4ALL / Bellingcat Toolkit' }));

export function researchText(key, lang = 'en') {
  return RESEARCH_COPY[key]?.[lang] || RESEARCH_COPY[key]?.en || key;
}
export function toolsFor(system, task) {
  return RESEARCH_TOOLS.filter(tool => tool.systems.includes(system) && (!task || tool.task === task));
}
// Only curated destinations; no selected report text, coordinates or URL params
// ever enter an outbound URL. Do not expand this into a general URL proxy.
const destinations = new Set([...RESEARCH_TOOLS.map(t => t.url), 'https://github.com/osint4all/osint4all.github.io', 'https://bellingcat.gitbook.io/toolkit']);
export function researchUrl(value) {
  return destinations.has(value) ? value : null;
}
export function researchContext(value) {
  if (!value || typeof value.label !== 'string' || !value.label.trim()) return null;
  const text = v => typeof v === 'string' ? v.trim().slice(0, 240) : null;
  const time = v => v instanceof Date ? (Number.isFinite(v.getTime()) ? v.toISOString() : null) : text(v);
  return { label: text(value.label), observedAt: time(value.observedAt), publishedAt: time(value.publishedAt), eventAt: time(value.eventAt) };
}
export function researchRecord(system, context, at = new Date().toISOString()) {
  return { catalogVersion: CATALOG_VERSION, system, recordedAt: at, context: researchContext(context),
    assessment: 'Unverified research context; not a verified incident or location.',
    tools: toolsFor(system).map(t => ({ id: t.id, provider: t.provider, url: t.url, accessMode: t.accessMode, feedStatus: t.feedStatus, lastChecked: t.lastChecked })),
    method: RESEARCH_COPY.funnel.en, limitations: RESEARCH_COPY.caution.en };
}
