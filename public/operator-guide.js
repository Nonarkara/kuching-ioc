const COPY = {
  en: {
    title: 'Padawan operator guide', manual: 'How to use', close: 'Close guide',
    nav: ['Map', 'River gauges', 'Today’s actions', 'Data sources'],
    note: 'Decision support, not an emergency dispatch system. Task marks stay in this browser.',
    sections: [
      ['1. Start your shift', 'Choose Padawan for the council view. Check the payload time and data sources before interpreting a number. A static snapshot is not a live feed; refreshing the page does not guarantee newer observations. A snapshot older than six hours is flagged for review, not certified safe.'],
      ['2. Find what needs attention', 'Read the warning summary, then open Today’s actions. Confirm the location and report with the responsible agency. Missing gauges mean unknown conditions—not normal rivers. “Normal” at a gauge does not rule out flooding elsewhere.'],
      ['3. Follow the water', 'Open River gauges and select a station, or use Trace in the water panel. The map highlights connected drainage geometry. This is not a verified flow direction, flood extent or arrival time. Compare the gauge’s observation time with field reports.'],
      ['4. Read the map layers', 'Satellite imagery is dated imagery, not live video. Cloud cover can hide the ground. Flood-risk areas and drainage lines are reference layers, not proof of current inundation. Forecasts and attention scores support judgement; they are not orders or measured water levels.'],
      ['5. Assign work through your council process', 'Click or press Enter on an action to cycle queued → active → done. These marks are saved only in this browser and are not shared with another officer. Assign crews, confirm road closures and verify shelter activation through established council and agency channels.'],
      ['6. Hand over clearly', 'Use SHARE BRIEF to copy the brief; review its timestamps and sources before sending it. Include location, observation time, the agency contacted and what remains unconfirmed. The dashboard does not send or acknowledge an assignment.'],
      ['When a feed is missing', 'Open Data sources and check the original agency page. Do not infer a safe condition from zero readings. Public CCTV coverage has not been verified; no camera view should be assumed available. Use confirmed field reports and official council procedures.']
    ]
  },
  ms: {
    title: 'Panduan petugas Padawan', manual: 'Cara guna', close: 'Tutup panduan',
    nav: ['Peta', 'Tolok sungai', 'Tindakan hari ini', 'Sumber data'],
    note: 'Sokongan keputusan, bukan sistem penghantaran kecemasan. Tanda tugas disimpan dalam pelayar ini sahaja.',
    sections: [
      ['1. Mulakan syif', 'Pilih Padawan untuk paparan majlis. Semak masa data dan sumber sebelum mentafsir bacaan. Paparan statik bukan suapan langsung; muat semula halaman tidak menjamin pemerhatian baharu. Data yang berusia lebih enam jam ditandakan untuk semakan, bukan disahkan selamat.'],
      ['2. Kenal pasti perkara penting', 'Baca ringkasan amaran, kemudian buka Tindakan hari ini. Sahkan lokasi dan laporan dengan agensi bertanggungjawab. Tiada bacaan tolok bermaksud keadaan tidak diketahui, bukan sungai normal. Bacaan normal di satu tolok tidak menolak kemungkinan banjir di tempat lain.'],
      ['3. Jejaki sistem air', 'Buka Tolok sungai dan pilih stesen, atau tekan Trace pada panel air. Peta menyerlahkan saliran yang bersambung. Garisan ini bukan arah aliran yang disahkan, kawasan banjir semasa atau masa ketibaan banjir. Bandingkan masa bacaan dengan laporan lapangan.'],
      ['4. Fahami lapisan peta', 'Imej satelit mempunyai tarikh rakaman dan bukan video langsung. Awan boleh menutup permukaan bumi. Kawasan risiko banjir dan garisan saliran ialah rujukan, bukan bukti banjir semasa. Ramalan dan skor perhatian membantu pertimbangan; ia bukan arahan atau paras air yang diukur.'],
      ['5. Tugaskan kerja melalui proses majlis', 'Klik tindakan atau tekan Enter untuk menukar queued → active → done, iaitu menunggu → sedang dibuat → selesai. Tanda ini disimpan dalam pelayar ini sahaja dan tidak dikongsi dengan pegawai lain. Tugaskan pasukan serta sahkan penutupan jalan dan pembukaan pusat pemindahan melalui saluran rasmi.'],
      ['6. Serah tugas dengan jelas', 'Gunakan SHARE BRIEF untuk menyalin ringkasan. Semak masa dan sumber sebelum menghantarnya. Sertakan lokasi, masa pemerhatian, agensi yang dihubungi dan perkara yang belum disahkan. Papan pemuka tidak menghantar atau mengesahkan penerimaan tugasan.'],
      ['Jika suapan tiada', 'Buka Sumber data dan semak halaman asal agensi. Jangan anggap keadaan selamat apabila tiada bacaan. Liputan CCTV awam belum disahkan; jangan anggap paparan kamera tersedia. Gunakan laporan lapangan yang disahkan dan prosedur rasmi majlis.']
    ]
  },
  zh: {
    title: '巴达旺工作人员指南', manual: '使用指南', close: '关闭指南',
    nav: ['地图', '河流水位站', '今日行动', '数据来源'],
    note: '本系统用于辅助决策，并非紧急调度系统。任务标记仅保存在此浏览器中。',
    sections: [
      ['1. 开始值班', '选择 Padawan 查看市议会辖区。解读数据前，先检查数据时间和来源。静态快照不是实时数据；刷新页面不保证获得新的观测。超过六小时的快照会提示复核，这不是安全认证。'],
      ['2. 找出需要处理的事项', '先读警报摘要，再打开今日行动。向负责机构核实地点和报告。没有水位读数表示情况未知，不代表河流正常。某个测站读数正常，也不能排除其他地点发生洪水。'],
      ['3. 查看水系连接', '打开河流水位站并选择测站，或点击水情面板中的 Trace。地图会突出显示相连的排水线。这些线不代表已核实的流向、当前淹水范围或洪水到达时间。请将观测时间与现场报告对照。'],
      ['4. 理解地图图层', '卫星影像有拍摄日期，并非实时视频；云层可能遮挡地面。洪水风险区和排水线是参考图层，不是当前发生洪水的证据。预测和关注评分用于辅助判断，不是调度命令或实测水位。'],
      ['5. 通过市议会流程分派工作', '点击行动卡或按 Enter，可依次切换 queued → active → done，即待处理 → 处理中 → 已完成。这些标记仅保存在此浏览器中，不会与其他工作人员同步。请通过既有官方渠道调派人员，并确认道路封闭和疏散中心启用情况。'],
      ['6. 清楚交班', '使用 SHARE BRIEF 复制摘要。发送前检查数据时间和来源，并补充地点、观测时间、已联系的机构和未确认事项。本仪表板不会发送任务，也不会确认任务已被接收。'],
      ['数据缺失时', '打开数据来源，查看原机构网页。读数为零条不代表安全。公共 CCTV 覆盖尚未核实，不应假定摄像头画面可用。请依据已确认的现场报告和市议会正式程序处理。']
    ]
  }
};

export function setupOperatorGuide(version = '') {
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = `./operator-guide.css?v=${encodeURIComponent(version)}`;
  document.head.append(style);
  const bar = document.createElement('nav');
  bar.className = 'operator-tools';
  bar.setAttribute('aria-label', 'Operator shortcuts');
  const targets = ['mapCanvas', 'hydroGaugePanel', 'operationList', 'sourceMatrix'];
  const buttons = targets.map(id => {
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      const target = document.getElementById(id);
      if (!target) return;
      if (id === 'sourceMatrix') target.closest('.source-panel')?.classList.add('operator-revealed');
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') parent.open = true;
      }
      target.tabIndex = -1;
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      target.focus({ preventScroll: true });
      window.dispatchEvent(new Event('resize'));
    });
    bar.append(button);
    return button;
  });
  const opener = document.createElement('button');
  opener.type = 'button';
  opener.className = 'operator-manual-button';
  opener.setAttribute('aria-haspopup', 'dialog');
  bar.append(opener);
  const note = document.createElement('p');
  bar.append(note);
  document.querySelector('.masthead')?.after(bar);
  const dialog = document.createElement('dialog');
  dialog.id = 'operatorGuide';
  dialog.className = 'operator-guide';
  dialog.setAttribute('aria-labelledby', 'operatorGuideTitle');
  document.body.append(dialog);
  let language = 'en';
  function render(lang) {
    language = COPY[lang] ? lang : 'en';
    const copy = COPY[language];
    bar.lang = dialog.lang = language === 'zh' ? 'zh-Hans' : language;
    buttons.forEach((button, i) => { button.textContent = copy.nav[i]; });
    opener.textContent = `${copy.manual} · EN / BM / 中文`;
    note.textContent = copy.note;
    // Content is authored here, never interpolated from a feed.
    dialog.innerHTML = `<header><h2 id="operatorGuideTitle">${copy.title}</h2><button type="button" data-close>${copy.close}</button></header><nav aria-label="Guide language">${[['en','English'],['ms','Bahasa Melayu'],['zh','简体中文']].map(([key,label]) => `<button type="button" data-guide-lang="${key}" lang="${key === 'zh' ? 'zh-Hans' : key}" aria-pressed="${key === language}">${label}</button>`).join('')}</nav><p>${copy.note}</p>${copy.sections.map(([title,body], i) => `<details ${i === 0 ? 'open' : ''}><summary>${title}</summary><p>${body}</p></details>`).join('')}`;
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.querySelectorAll('[data-guide-lang]').forEach(button => button.addEventListener('click', () => {
      render(button.dataset.guideLang);
      dialog.querySelector(`[data-guide-lang="${language}"]`).focus();
    }));
  }
  opener.addEventListener('click', () => { render(language); dialog.showModal(); });
  dialog.addEventListener('close', () => opener.focus());
  document.addEventListener('operator-language', event => render(event.detail));
  render(language);
}
