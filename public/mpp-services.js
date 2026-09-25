// Reference links checked against MPP's public website on 2026-09-25.
// This directory does not submit reports, book services or dispatch contractors.
export const MPP_SERVICES = [
  { id:'complaints', url:'https://talikhidmat.sarawak.gov.my/',
    en:['Report a service problem','Talikhidmat: submit and follow up public-service complaints.'],
    ms:['Lapor masalah perkhidmatan','Talikhidmat: hantar dan susuli aduan perkhidmatan awam.'],
    zh:['报告服务问题','通过 Talikhidmat 提交及跟进公共服务投诉。'] },
  { id:'drains', url:'https://mpp.sarawak.gov.my/web/subpage/webpage_view/258',
    en:['Drain clearing · 2026','Find the appointed contractor and MPP supervisor for the affected maintenance zone.'],
    ms:['Pembersihan longkang · 2026','Cari kontraktor dilantik dan penyelia MPP mengikut zon penyelenggaraan yang terjejas.'],
    zh:['清理排水沟 · 2026','按受影响的养护区域，查找承包商及 MPP 主管。'] },
  { id:'roads', url:'https://mpp.sarawak.gov.my/web/subpage/webpage_view/259',
    en:['Roads and minor civil works · 2026','Check the official contractor list before routing a road-maintenance request.'],
    ms:['Jalan dan kerja awam kecil · 2026','Semak senarai kontraktor rasmi sebelum menyalurkan permintaan penyelenggaraan jalan.'],
    zh:['道路及小型土木工程 · 2026','转交道路维修请求前，先查阅官方承包商名单。'] },
  { id:'trees', url:'https://mpp.sarawak.gov.my/web/subpage/webpage_view/257',
    en:['Trees, parks and landscaping · 2026','Locate the responsible maintenance team and council contact.'],
    ms:['Pokok, taman dan landskap · 2026','Cari pasukan penyelenggaraan dan pegawai majlis yang bertanggungjawab.'],
    zh:['树木、公园及景观养护 · 2026','查找负责的养护团队和市议会联系人。'] },
  { id:'refuse', url:'https://mpp.sarawak.gov.my/web/subpage/webpage_view/245',
    en:['Refuse collection days','Look up the collection zone and weekday for a street before logging a missed-collection complaint.'],
    ms:['Hari kutipan sampah','Semak zon dan hari kutipan bagi sesuatu jalan sebelum membuat aduan sampah tidak dikutip.'],
    zh:['垃圾收集日','投诉垃圾未收之前，先查该街道所属的收集区及收集日。'] },
  { id:'councillors', url:'https://mpp.sarawak.gov.my/web/subpage/webpage_view/175',
    en:['Councillors and areas · 2025–2028','Verify who represents the locality before escalation.'],
    ms:['Ahli majlis dan kawasan · 2025–2028','Sahkan wakil kawasan sebelum merujuk perkara kepada pihak berkenaan.'],
    zh:['市议员及负责区域 · 2025–2028','上报问题前，确认该地区的负责市议员。'] },
  { id:'payments', url:'https://paybills.sarawak.gov.my/',
    en:['Assessment bill payments','Open PayBills Sarawak. Payment takes place on the government portal, not here.'],
    ms:['Bayaran cukai taksiran','Buka PayBills Sarawak. Bayaran dibuat di portal kerajaan, bukan di sini.'],
    zh:['缴付门牌税','打开 PayBills Sarawak。付款在政府网站进行，不在本仪表板内进行。'] },
  { id:'service-sarawak', url:'https://service.sarawak.gov.my/web/',
    en:['Service Sarawak e-services','State portal for assessment bills, ownership transfers and other council e-services.'],
    ms:['E-perkhidmatan Service Sarawak','Portal negeri untuk bil taksiran, pindah milik dan e-perkhidmatan majlis yang lain.'],
    zh:['Service Sarawak 电子服务','州政府门户，办理门牌税账单、业权转移及其他市议会电子服务。'] },
  { id:'booking', url:'https://ebooking.sarawak.gov.my/',
    en:['Book council facilities','Open the official facility-booking portal to check availability.'],
    ms:['Tempah kemudahan majlis','Buka portal tempahan rasmi untuk menyemak kekosongan.'],
    zh:['预订市议会设施','打开官方设施预订网站查询可用时段。'] },
];
const COPY = {
  en:{title:'MPP services and responsible teams',intro:'Start with the affected location, then use the official channel below. Maintenance zones are not automatically the same as councillor wards.',contact:'Council contact',office:'Main office',messages:'WhatsApp / SMS only',hours:'Counter: Monday–Friday, 08:00–15:00; closed on public holidays.',source:'MPP official references · checked 25 September 2026 · not live service status',directory:'Contact details and office hours',secretary:'Municipal Secretary’s Office',note:'Original reports remain available. Translated summaries are labelled and must be checked against their sources before action.'},
  ms:{title:'Perkhidmatan MPP dan pasukan bertanggungjawab',intro:'Kenal pasti lokasi terjejas, kemudian gunakan saluran rasmi di bawah. Zon penyelenggaraan tidak semestinya sama dengan kawasan ahli majlis.',contact:'Hubungi majlis',office:'Pejabat utama',messages:'WhatsApp / SMS sahaja',hours:'Kaunter: Isnin–Jumaat, 08:00–15:00; tutup pada cuti umum.',source:'Rujukan rasmi MPP · disemak 25 September 2026 · bukan status perkhidmatan langsung',directory:'Maklumat hubungan dan waktu pejabat',secretary:'Pejabat Setiausaha Perbandaran',note:'Laporan asal kekal tersedia. Ringkasan terjemahan dilabel dan perlu disemak dengan sumber asal sebelum tindakan.'},
  zh:{title:'MPP 服务与负责团队',intro:'先确认受影响地点，再使用下列官方渠道。养护区域不一定与市议员负责区域相同。',contact:'联系市议会',office:'总机',messages:'仅限 WhatsApp / 短信',hours:'柜台：周一至周五 08:00–15:00；公共假日休息。',source:'MPP 官方参考资料 · 核对日期：2026年9月25日 · 并非实时服务状态',directory:'联系方式及办公时间',secretary:'市政秘书办公室',note:'保留原始报道。翻译摘要会明确标注，采取行动前请核对原始来源。'}
};
export function setupMppServices() {
  const masthead = document.querySelector('.masthead .eyebrow > span');
  if (masthead) masthead.textContent = 'MUNICIPAL SECRETARY GOH THIAM HO // MPP';
  const panel = document.createElement('details');
  panel.id = 'mppServices';
  panel.className = 'mpp-services';
  document.querySelector('.operator-tools')?.after(panel);
  function render(lang = 'en') {
    const locale = COPY[lang] ? lang : 'en', copy = COPY[locale];
    panel.lang = locale === 'zh' ? 'zh-Hans' : locale;
    panel.innerHTML = `<summary>${copy.title}</summary><div class="mpp-services-body"><p>${copy.intro}</p><p class="mpp-provenance">${copy.source}</p><div class="mpp-service-links">${MPP_SERVICES.map(item=>`<a href="${item.url}" target="_blank" rel="noopener noreferrer"><strong>${item[locale][0]} ↗</strong><span>${item[locale][1]}</span></a>`).join('')}</div><section><h3>${copy.contact}</h3><p>${copy.office}: <a href="tel:+6082615566">+60 82-615566</a><br>${copy.messages}: <a href="https://wa.me/60138025566" target="_blank" rel="noopener noreferrer">+60 13-8025566</a><br><a href="mailto:mpp@sarawak.gov.my">mpp@sarawak.gov.my</a></p><p>${copy.hours}</p><a href="https://mpp.sarawak.gov.my/web/subpage/webpage_view/225" target="_blank" rel="noopener noreferrer">${copy.directory} ↗</a><p>${copy.secretary}: <strong>Ir. Ts. Goh Thiam Ho</strong><br>+60 82-615566 · ext. 302<br><a href="https://mpp.sarawak.gov.my/web/subpage/staffcontact_view/72" target="_blank" rel="noopener noreferrer">MPP ↗</a></p></section><p class="mpp-provenance">${copy.note}</p></div>`;
  }
  document.addEventListener('operator-language', event => render(event.detail));
  render();
}
