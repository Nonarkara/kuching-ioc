const copy = {
  en: { label: 'Available on Android & iPhone · Web app', title: 'Keep Kuching IOC on your home screen', close: 'Close', android: 'Android', androidSteps: 'Open this dashboard in Chrome. Open the ⋮ menu, then choose Add to home screen or Install app. Confirm to add Kuching IOC.', iphone: 'iPhone & iPad', iphoneSteps: 'Open this dashboard in Safari. Tap Share, then Add to Home Screen. Turn on Open as Web App if shown, then tap Add.', note: 'Free web app. No App Store download required. Internet access is needed for maps and dashboard data. Always check observation times.', install: 'Install web app', installed: 'You are using the installed web app.' },
  ms: { label: 'Tersedia pada Android & iPhone · Aplikasi web', title: 'Letakkan Kuching IOC pada skrin utama', close: 'Tutup', android: 'Android', androidSteps: 'Buka papan pemuka ini dalam Chrome. Buka menu ⋮, kemudian pilih Tambah pada skrin utama atau Pasang apl. Sahkan untuk menambah Kuching IOC.', iphone: 'iPhone & iPad', iphoneSteps: 'Buka papan pemuka ini dalam Safari. Ketik Kongsi, kemudian Tambah ke Skrin Utama. Hidupkan Buka sebagai Aplikasi Web jika dipaparkan, kemudian ketik Tambah.', note: 'Aplikasi web percuma. Tiada muat turun App Store diperlukan. Sambungan internet diperlukan untuk peta dan data. Sentiasa semak masa pemerhatian.', install: 'Pasang aplikasi web', installed: 'Anda sedang menggunakan aplikasi web yang dipasang.' },
  zh: { label: '支持 Android 和 iPhone · 网页应用', title: '将 Kuching IOC 添加到主屏幕', close: '关闭', android: 'Android', androidSteps: '在 Chrome 中打开此仪表板。打开 ⋮ 菜单，选择“添加到主屏幕”或“安装应用”，然后确认添加 Kuching IOC。', iphone: 'iPhone 和 iPad', iphoneSteps: '在 Safari 中打开此仪表板。点击“分享”，然后选择“添加到主屏幕”。如出现“作为网页应用打开”，请将其开启，然后点击“添加”。', note: '免费网页应用，无需从 App Store 下载。地图和仪表板数据需要互联网连接。请务必检查观测时间。', install: '安装网页应用', installed: '您正在使用已安装的网页应用。' }
};
let lang = 'en';
let installPrompt;
const button = document.createElement('button');
button.type = 'button';
button.className = 'web-app-button';
button.setAttribute('aria-haspopup', 'dialog');
const dialog = document.createElement('dialog');
dialog.className = 'web-app-dialog';
dialog.setAttribute('aria-labelledby', 'webAppTitle');
document.body.append(dialog);
// Join the existing operator toolbar after its dynamic initialization.
function placeButton() {
  const toolbar = document.querySelector('.operator-tools');
  if (toolbar) { toolbar.append(button); return true; }
  return false;
}
if (!placeButton()) {
  const observer = new MutationObserver(() => { if (placeButton()) observer.disconnect(); });
  observer.observe(document.querySelector('.dashboard-shell'), { childList: true });
}
function render(next = document.documentElement.lang) {
  lang = next.startsWith('zh') ? 'zh' : next.startsWith('ms') ? 'ms' : 'en';
  const c = copy[lang];
  button.innerHTML = `<img src="./assets/brand/mono-mark.png" alt="" width="24" height="24"><span>${c.label}</span>`;
  dialog.lang = lang === 'zh' ? 'zh-Hans' : lang;
  dialog.innerHTML = `<header><img class="web-app-lockup" src="./assets/brand/mono-lockup.png" alt="Greater Kuching IOC" width="280" height="145"><button type="button" data-close>${c.close}</button></header><h2 id="webAppTitle">${c.title}</h2><nav aria-label="Language">${[['en','English'],['ms','Bahasa Melayu'],['zh','中文']].map(([id,label]) => `<button type="button" data-language="${id}" aria-pressed="${id === lang}">${label}</button>`).join('')}</nav><h3>${c.android}</h3><p>${c.androidSteps}</p><h3>${c.iphone}</h3><p>${c.iphoneSteps}</p><p>${c.note}</p><button type="button" data-install ${installPrompt ? '' : 'hidden'}>${c.install}</button>${matchMedia('(display-mode: standalone)').matches || navigator.standalone ? `<p>${c.installed}</p>` : ''}`;
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.querySelectorAll('[data-language]').forEach(el => el.addEventListener('click', () => { render(el.dataset.language); dialog.querySelector(`[data-language="${lang}"]`).focus(); }));
  dialog.querySelector('[data-install]').addEventListener('click', async () => {
    if (!installPrompt) return;
    const pending = installPrompt;
    installPrompt = undefined;
    await pending.prompt();
    await pending.userChoice;
    render(lang);
  });
}
button.addEventListener('click', () => { render(); dialog.showModal(); });
document.addEventListener('operator-language', event => render(event.detail));
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; render(lang); });
window.addEventListener('appinstalled', () => { installPrompt = undefined; render(lang); });
render();
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Web app registration failed:', error.message));
}
