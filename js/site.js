/**
 * Comportamiento del sitio (fuera del simulador):
 * vistas por sección, ventanas emergentes, idioma, menú móvil,
 * enlaces que cargan escenarios y pruebas en vivo.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const I18n = window.DeadlockI18n;
  const t = I18n.t;

  /* ======================= vistas (una sección a la vez) ======================= */
  const views = [...document.querySelectorAll('.view')];
  const viewIds = views.map(v => v.id);
  const links = $('nav-links');
  const navAs = [...links.querySelectorAll('a')];

  function showView() {
    const id = location.hash.slice(1);
    const current = viewIds.includes(id) ? id : 'inicio';
    views.forEach(v => {
      const on = v.id === current;
      v.hidden = !on;
      if (on) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
    });
    navAs.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.addEventListener('hashchange', showView);

  // "Volver arriba" no cambia de vista
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-scrolltop]')) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  window.addEventListener('scroll', () => {
    document.querySelector('.nav').classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  /* ======================= ventanas emergentes ======================= */
  const dialog = $('modal'), body = $('modal-body'), store = $('modal-store');
  let openNode = null;

  function openModal(id) {
    const node = $(id);
    if (!node) return;
    if (openNode) store.appendChild(openNode);
    body.appendChild(node);       // se mueve (no se copia): conserva ids y traducciones
    openNode = node;
    body.scrollTop = 0;
    if (!dialog.open) dialog.showModal();
  }
  dialog.addEventListener('close', () => {
    if (openNode) { store.appendChild(openNode); openNode = null; }
  });
  $('modal-close').addEventListener('click', () => dialog.close());
  // clic fuera del contenido = cerrar
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  // un enlace dentro de la ventana lleva a otra vista: cerrar primero
  body.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) dialog.close(); });

  document.addEventListener('click', (e) => {
    const trg = e.target.closest('[data-modal]');
    if (trg) openModal(trg.dataset.modal);
  });
  document.addEventListener('keydown', (e) => {
    const trg = e.target.closest && e.target.closest('[data-modal][role="button"]');
    if (trg && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openModal(trg.dataset.modal); }
  });

  /* ======================= idioma ======================= */
  const LANG_KEY = 'deadlock-hunter-lang';
  const langBtns = [...document.querySelectorAll('[data-lang]')];
  function paintLang() {
    I18n.applyStatic();
    langBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === I18n.lang));
    renderTests();
  }
  langBtns.forEach(b => b.addEventListener('click', () => {
    I18n.setLang(b.dataset.lang);
    try { localStorage.setItem(LANG_KEY, I18n.lang); } catch (e) { /* almacenamiento no disponible */ }
  }));
  I18n.onChange(paintLang);

  /* ======================= menú en móvil ======================= */
  const toggle = $('nav-toggle');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', (e) => { if (e.target.tagName === 'A') links.classList.remove('open'); });

  /* ======================= "Probar en el simulador" ======================= */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-load-sc]');
    if (!a || !window.DeadlockApp) return;
    window.DeadlockApp.loadScenario(+a.dataset.loadSc);
  });

  /* ======================= pruebas automatizadas en vivo ======================= */
  let results = null, ranAt = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function renderTests() {
    if (!results) return;
    const passed = results.filter(r => r.pass).length;
    const all = passed === results.length;
    $('tests-num').textContent = `${passed}/${results.length}`;
    $('tests-num').className = 'big-num ' + (all ? 'ok' : 'bad');
    $('tests-label').textContent = all ? t('tests.ok') : t('tests.fail', { n: results.length - passed });
    $('tests-when').textContent = t('tests.when', { date: ranAt.toLocaleString(I18n.lang === 'en' ? 'en-US' : 'es-CO') });
    $('tests-list').innerHTML = results.map(r =>
      `<li class="${r.pass ? 'pass' : 'fail'}">${esc(I18n.lang === 'en' ? r.nameEn : r.name)}${r.pass ? '' : `<span class="err">${esc(r.error)}</span>`}</li>`).join('');
  }

  /* ======================= arranque ======================= */
  let saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* sin almacenamiento */ }
  if (saved === 'en') I18n.setLang('en');
  if (window.DeadlockTests) {
    results = window.DeadlockTests.run(window.DeadlockEngine, window.DeadlockScenarios, I18n);
    ranAt = new Date();
  }
  paintLang();
  showView();
})();
