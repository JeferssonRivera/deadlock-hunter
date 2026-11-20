/**
 * Deadlock Hunter — Interfaz del simulador
 * Dibuja el grafo de asignación (SVG), conecta los controles con el
 * motor y muestra el análisis, las matrices y el registro de eventos.
 * Todos los textos dinámicos pasan por DeadlockI18n.t().
 */
(function () {
  'use strict';

  const I18n = window.DeadlockI18n;
  const t = I18n.t;
  const { ResourceSystem, SimError, eventText } = window.DeadlockEngine;
  const SCENARIOS = window.DeadlockScenarios;
  const $ = (id) => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const W = 900, H = 560, PROC_R = 30;

  let sys = new ResourceSystem();
  let pos = new Map();          // id -> {x, y}
  let player = null;            // { sc, index }
  let analysis = sys.analyze();
  let lastStatus = 'ok';
  let selectedProc = null, selectedRes = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** Texto de un escenario en el idioma actual. */
  const sct = (sc, field) => (I18n.lang === 'en' && sc.en && sc.en[field]) || sc[field];

  /* ======================= utilidades SVG ======================= */

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function resSize(rid) {
    const n = sys.resources.get(rid).total;
    const cols = Math.min(n, 5), rows = Math.ceil(n / 5);
    return { w: Math.max(66, cols * 16 + 26), h: 36 + rows * 16, cols, rows };
  }

  /** Punto del borde del nodo `id` en dirección a `toward`. */
  function boundary(id, toward) {
    const c = pos.get(id);
    const dx = toward.x - c.x, dy = toward.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    if (sys.processes.has(id)) {
      return { x: c.x + dx / len * (PROC_R + 2), y: c.y + dy / len * (PROC_R + 2) };
    }
    const { w, h } = resSize(id);
    const k = Math.min((w / 2 + 2) / Math.abs(dx || 1e-9), (h / 2 + 2) / Math.abs(dy || 1e-9));
    return { x: c.x + dx * k, y: c.y + dy * k };
  }

  /* ======================= distribución ======================= */

  /** Distribuye los nodos en una elipse intercalando P y R (los ciclos se ven como polígonos). */
  function layout() {
    const P = [...sys.processes.keys()], R = [...sys.resources.keys()];
    const order = [];
    for (let i = 0; i < Math.max(P.length, R.length); i++) {
      if (P[i]) order.push(P[i]);
      if (R[i]) order.push(R[i]);
    }
    const n = order.length;
    const ry = n <= 1 ? 0 : Math.min(215, 110 + n * 14);
    const rx = ry * 1.45;
    order.forEach((id, i) => {
      const a = -Math.PI + Math.PI / n + i * 2 * Math.PI / n;
      pos.set(id, { x: W / 2 + rx * Math.cos(a), y: H / 2 + ry * Math.sin(a) });
    });
  }

  /* ======================= render del grafo ======================= */

  function renderGraph() {
    const gE = $('g-edges'), gN = $('g-nodes');
    gE.innerHTML = ''; gN.innerHTML = '';
    $('empty-hint').style.display = (sys.processes.size + sys.resources.size) ? 'none' : 'flex';
    renderGraphHint();

    const deadEdges = new Set(), cycleEdges = new Set(), deadRes = new Set();
    for (const c of analysis.cycles) {
      const target = c.deadlocked ? deadEdges : cycleEdges;
      for (const s of c.steps) {
        target.add(`${s.pid}>${s.rid}`);
        target.add(`${s.rid}>${s.holder}`);
        if (c.deadlocked) deadRes.add(s.rid);
      }
    }

    const edges = sys.edges();
    const keys = new Set(edges.map(e => `${e.from}>${e.to}`));
    for (const e of edges) {
      const a = pos.get(e.from), b = pos.get(e.to);
      if (!a || !b) continue;
      const key = `${e.from}>${e.to}`;
      const reverse = keys.has(`${e.to}>${e.from}`);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      let ctrl = { x: mx, y: my };
      if (reverse) {
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        ctrl = { x: mx - dy / len * 34, y: my + dx / len * 34 };
      }
      const s = boundary(e.from, reverse ? ctrl : b);
      const d = boundary(e.to, reverse ? ctrl : a);
      let cls = 'edge ' + e.type;
      if (deadEdges.has(key)) cls += ' dead';
      else if (cycleEdges.has(key)) cls += ' cycle';
      const path = el('path', { d: `M${s.x},${s.y} Q${ctrl.x},${ctrl.y} ${d.x},${d.y}`, class: cls }, gE);
      el('title', {}, path).textContent = e.type === 'request'
        ? t('tip.req', { from: e.from, to: e.to })
        : t(e.count > 1 ? 'tip.asgN' : 'tip.asg', { from: e.from, to: e.to, n: e.count });
      if (e.count > 1) {
        const lx = 0.25 * s.x + 0.5 * ctrl.x + 0.25 * d.x, ly = 0.25 * s.y + 0.5 * ctrl.y + 0.25 * d.y;
        el('text', { x: lx, y: ly - 6, class: 'edge-label', 'text-anchor': 'middle' }, gE).textContent = '×' + e.count;
      }
    }

    const dead = new Set(analysis.deadlocked), indirect = new Set(analysis.indirect);
    for (const p of sys.processes.values()) {
      const c = pos.get(p.id);
      let state = 'ready', sub = t('node.running');
      if (dead.has(p.id)) { state = 'dead'; sub = t('node.dead'); }
      else if (indirect.has(p.id)) { state = 'indirect'; sub = t('node.indirect'); }
      else if (p.waiting) { state = 'blocked'; sub = t('node.waiting'); }
      const g = el('g', { class: `node proc ${state}${selectedProc === p.id ? ' selected' : ''}`, transform: `translate(${c.x},${c.y})`, 'data-id': p.id }, gN);
      el('circle', { r: PROC_R }, g);
      el('text', { class: 'label' }, g).textContent = p.id;
      el('text', { class: 'sub', y: PROC_R + 16 }, g).textContent = sub;
      const holds = [...p.holds].map(([r, n]) => n > 1 ? `${r}×${n}` : r).join(', ') || t('word.nothing');
      el('title', {}, g).textContent = t('tip.proc', { id: p.id, holds, waiting: p.waiting || '—' });
    }

    for (const r of sys.resources.values()) {
      const c = pos.get(r.id);
      const { w, h, cols } = resSize(r.id);
      const used = sys.allocated(r.id);
      const g = el('g', { class: `node res${deadRes.has(r.id) ? ' dead' : ''}${selectedRes === r.id ? ' selected' : ''}`, transform: `translate(${c.x},${c.y})`, 'data-id': r.id }, gN);
      el('rect', { class: 'box', x: -w / 2, y: -h / 2, width: w, height: h, rx: 8 }, g);
      el('text', { class: 'label', y: -h / 2 + 17 }, g).textContent = r.id;
      for (let i = 0; i < r.total; i++) {
        const col = i % 5, row = Math.floor(i / 5);
        const rowCols = Math.min(cols, r.total - row * 5);
        el('circle', {
          class: 'dot' + (i < used ? ' used' : ''), r: 5,
          cx: -(rowCols - 1) * 8 + col * 16, cy: -h / 2 + 29 + row * 16,
        }, g);
      }
      const holders = sys.holdersOf(r.id).map(x => x.count > 1 ? `${x.pid}×${x.count}` : x.pid).join(', ') || t('word.nobody');
      el('title', {}, g).textContent = t('tip.res', { id: r.id, free: r.total - used, total: r.total, holders, queue: r.queue.join(', ') || t('word.empty') });
    }
  }

  /** Aviso dentro del grafo cuando hay nodos pero todavía no hay flechas. */
  function renderGraphHint() {
    const hint = $('graph-hint');
    const hasNodes = sys.processes.size > 0 && sys.resources.size > 0;
    const noEdges = sys.edges().length === 0;
    const scenarioPending = !!player && player.index === 0;
    const show = hasNodes && noEdges && (scenarioPending || !player);
    hint.hidden = !show;
    if (show) hint.innerHTML = t(scenarioPending ? 'hint.scenario' : 'hint.noEdges');
    // resaltar los botones del reproductor mientras el escenario no ha empezado
    $('btn-step').classList.toggle('attention', scenarioPending);
    $('btn-run-all').classList.toggle('attention', scenarioPending);
  }

  /* ======================= arrastre y selección ======================= */

  (function setupDrag() {
    const svgEl = $('graph');
    let drag = null;
    const toSvg = (ev) => {
      const pt = svgEl.createSVGPoint();
      pt.x = ev.clientX; pt.y = ev.clientY;
      return pt.matrixTransform(svgEl.getScreenCTM().inverse());
    };
    svgEl.addEventListener('pointerdown', (ev) => {
      const node = ev.target.closest('.node');
      if (!node) return;
      const id = node.getAttribute('data-id');
      const p = toSvg(ev), c = pos.get(id);
      drag = { id, dx: c.x - p.x, dy: c.y - p.y, moved: false, sx: ev.clientX, sy: ev.clientY };
      svgEl.setPointerCapture(ev.pointerId);
    });
    svgEl.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const p = toSvg(ev);
      pos.set(drag.id, { x: Math.max(40, Math.min(W - 40, p.x + drag.dx)), y: Math.max(40, Math.min(H - 40, p.y + drag.dy)) });
      renderGraph();
    });
    const end = () => {
      if (drag && !drag.moved) {
        if (sys.processes.has(drag.id)) { selectedProc = drag.id; $('sel-proc').value = drag.id; }
        else { selectedRes = drag.id; $('sel-res').value = drag.id; }
        renderGraph();
      }
      drag = null;
    };
    svgEl.addEventListener('pointerup', end);
    svgEl.addEventListener('pointercancel', end);
  })();

  /* ======================= paneles ======================= */

  function renderSelectors() {
    const fill = (sel, ids, current) => {
      sel.innerHTML = ids.length ? ids.map(id => `<option value="${esc(id)}">${esc(id)}</option>`).join('') : '<option value="">—</option>';
      if (current && ids.includes(current)) sel.value = current;
      return sel.value || null;
    };
    selectedProc = fill($('sel-proc'), [...sys.processes.keys()], selectedProc);
    selectedRes = fill($('sel-res'), [...sys.resources.keys()], selectedRes);
    const noP = !sys.processes.size, noR = !sys.resources.size;
    $('btn-request').disabled = noP || noR;
    $('btn-release').disabled = noP || noR;
    $('btn-terminate').disabled = noP;
    $('btn-del-res').disabled = noR;
  }

  function renderStatus() {
    const st = $('status');
    const a = analysis;
    if (!sys.processes.size) { st.className = 'status ok'; st.textContent = t('status.empty'); return; }
    if (a.status === 'deadlock') {
      st.className = 'status dead';
      st.textContent = t('status.dead', { list: a.deadlocked.join(', ') }) +
        (a.indirect.length ? t('status.affected', { list: a.indirect.join(', ') }) : '');
    } else if (a.status === 'cycle-no-deadlock') {
      st.className = 'status cycle';
      st.textContent = t('status.cycle');
    } else {
      st.className = 'status ok';
      st.textContent = a.blocked.length ? t('status.okWaiting', { n: a.blocked.length }) : t('status.okNone');
    }
  }

  function explainCycle(c) {
    const lines = c.steps.map(s => {
      const total = sys.resources.get(s.rid).total;
      return '<li>' + t('cycle.waitLine', {
        pid: esc(s.pid), rid: esc(s.rid), holder: esc(s.holder),
        inst: total > 1 ? t('cycle.inst', { n: total }) : '',
      }) + '</li>';
    }).join('');
    let verdict;
    if (c.deadlocked && c.singleInstance) verdict = t('cycle.single');
    else if (c.deadlocked) verdict = t('cycle.multi');
    else {
      const finished = new Set(analysis.detection.order);
      const helpers = [];
      for (const rid of c.resources) {
        for (const h of sys.holdersOf(rid)) {
          if (!c.processes.includes(h.pid) && finished.has(h.pid)) helpers.push(t('cycle.helper', { pid: h.pid, rid }));
        }
      }
      verdict = t('cycle.possible') +
        (helpers.length ? t('cycle.helpers', { list: esc(helpers.join(', ')) }) : t('cycle.helpersGeneric')) +
        t('cycle.necessary');
    }
    return `<div class="cycle-box ${c.deadlocked ? 'dead' : ''}">
      <div class="cycle-path">${esc(c.path)}</div>
      <span class="pill ${c.deadlocked ? 'dead' : 'warn'}">${t(c.deadlocked ? 'pill.deadlock' : 'pill.cycleOnly')}</span>
      <ul>${lines}</ul>
      <div>${verdict}</div>
    </div>`;
  }

  function renderAnalysis() {
    const a = analysis;
    const box = $('analysis');
    if (!sys.processes.size && !sys.resources.size) {
      box.innerHTML = `<p class="hint">${t('an.empty')}</p>`;
      return;
    }
    let html = `<div class="an-section">
      <span class="pill ok">${t('pill.procs', { n: sys.processes.size })}</span>
      <span class="pill ok">${t('pill.res', { n: sys.resources.size })}</span>
      <span class="pill ${a.blocked.length ? 'warn' : 'ok'}">${t('pill.waiting', { n: a.blocked.length })}</span>
      <span class="pill ${a.cycles.length ? (a.status === 'deadlock' ? 'dead' : 'warn') : 'ok'}">${t('pill.cycles', { n: a.cycles.length })}</span>
    </div>`;

    html += `<div class="an-section"><h3>${t('an.cyclesTitle')}</h3>`;
    html += a.cycles.length
      ? a.cycles.map(explainCycle).join('')
      : '<p>' + t('an.noCycles') + (a.blocked.length ? t('an.noCyclesWaiting', { list: esc(a.blocked.join(', ')) }) : '') + '</p>';
    html += '</div>';

    if (a.coffman) {
      html += `<div class="an-section"><h3>${t('an.coffman')}</h3><ul class="coffman">` +
        a.coffman.map(c => `<li>${c.ok ? '✔' : '✘'} <b>${esc(c.name)}</b>: ${esc(c.detail)}</li>`).join('') + '</ul></div>';
    }
    if (a.indirect.length) {
      html += `<div class="an-section"><h3>${t('an.indirectTitle')}</h3><p>${t('an.indirectText', { list: esc(a.indirect.join(', ')) })}</p></div>`;
    }

    const det = a.detection;
    html += `<div class="an-section"><h3>${t('an.detection')}</h3>
      <details ${a.cycles.length || a.status === 'deadlock' ? 'open' : ''}>
        <summary>${esc(det.unfinished.length ? t('an.cannot', { list: det.unfinished.join(', ') }) : t('an.allFinish', { order: det.order.join(' → ') || '—' }))}</summary>
        <ol class="trace">${det.trace.map(x => `<li class="${x.kind}">${esc(x.text)}</li>`).join('')}</ol>
      </details></div>`;

    if (a.recovery) {
      const r = a.recovery;
      html += `<div class="an-section"><h3>${t('an.recovery')}</h3><p>${esc(r.reason)}</p><div class="recovery-actions">`;
      r.terminations.forEach((x, i) => {
        html += `<button data-act="terminate" data-pid="${esc(x.pid)}" class="${i === 0 ? 'best' : ''}">
          <span>${t('rec.abort', { pid: esc(x.pid) })}${i === 0 ? t('rec.suggested') : ''}</span>
          <small>${t('rec.abortMeta', { held: x.held, rem: x.remaining })}</small></button>`;
      });
      r.preemptions.forEach(p => {
        html += `<button data-act="preempt" data-pid="${esc(p.pid)}" data-rid="${esc(p.rid)}">
          <span>${t('rec.preempt', { rid: esc(p.rid), pid: esc(p.pid) })}${p.beneficiary ? ` → ${esc(p.beneficiary)}` : ''}</span>
          <small>${t('rec.preemptMeta', { rem: p.remaining })}</small></button>`;
      });
      html += `<button data-act="auto" class="primary"><span>${t('rec.auto')}</span><small style="color:inherit">${t('rec.autoSub')}</small></button></div></div>`;
    }
    box.innerHTML = html;
  }

  function renderMatrices() {
    const P = [...sys.processes.values()], R = [...sys.resources.values()];
    if (!P.length || !R.length) { $('matrices').innerHTML = `<p class="hint">${t('mx.none')}</p>`; return; }
    const head = '<tr><th></th>' + R.map(r => `<th>${esc(r.id)}</th>`).join('') + '</tr>';
    const table = (cap, fn, cls) => `<div class="scroll"><table><caption>${cap}</caption>${head}` +
      P.map(p => `<tr><th>${esc(p.id)}</th>` + R.map(r => { const v = fn(p, r); return `<td class="${v ? cls : ''}">${v}</td>`; }).join('') + '</tr>').join('') +
      '</table></div>';
    const vec = (cap, fn) => `<div class="scroll"><table><caption>${cap}</caption>${head}<tr><th></th>` + R.map(r => `<td>${fn(r)}</td>`).join('') + '</tr></table></div>';
    $('matrices').innerHTML =
      table(t('mx.alloc'), (p, r) => p.holds.get(r.id) || 0, 'nz') +
      table(t('mx.req'), (p, r) => p.waiting === r.id ? 1 : 0, 'req') +
      vec(t('mx.total'), r => r.total) +
      vec(t('mx.avail'), r => sys.available(r.id));
  }

  let logCount = 0, logOwner = null;
  function renderLog(full) {
    const ol = $('log');
    const evs = sys.events;
    if (full || logOwner !== sys || evs.length < logCount) { ol.innerHTML = ''; logCount = 0; logOwner = sys; }
    for (let i = logCount; i < evs.length; i++) {
      const li = document.createElement('li');
      li.className = evs[i].type;
      li.innerHTML = `<span class="t">${evs[i].t}</span><span>${esc(eventText(evs[i]))}</span>`;
      ol.appendChild(li);
    }
    logCount = evs.length;
    ol.scrollTop = ol.scrollHeight;
  }

  function renderScenarioList() {
    $('scenario-list').innerHTML = SCENARIOS.map((sc, i) =>
      `<button data-sc="${i}"><span class="tag ${sc.kind}">${t(sc.kind === 'deadlock' ? 'tag.deadlock' : 'tag.safe')}</span>${esc(sct(sc, 'short'))}</button>`).join('');
  }

  function renderPlayer() {
    const box = $('scenario-player');
    if (!player) { box.hidden = true; return; }
    box.hidden = false;
    const { sc, index } = player;
    $('sc-title').textContent = sct(sc, 'title');
    $('sc-desc').textContent = sct(sc, 'description');
    $('sc-steps').innerHTML = sc.steps.map((s, i) =>
      `<li class="${i < index ? 'done' : i === index ? 'next' : ''}">${esc(stepText(s))}</li>`).join('');
    const done = index >= sc.steps.length;
    $('sc-count').textContent = done ? t('player.done') : t('player.count', { i: index + 1, n: sc.steps.length });
    $('btn-step').disabled = done;
    $('btn-run-all').disabled = done;
    const lesson = $('sc-lesson');
    lesson.hidden = !done;
    if (done) lesson.innerHTML = `<b>${t('lesson.title')}</b> ${esc(sct(sc, 'lesson'))}`;
  }

  function stepText([op, p, r]) {
    return t('step.' + op, { p, r });
  }

  /* ======================= ciclo de actualización ======================= */

  function refresh() {
    analysis = sys.analyze();
    if (analysis.status !== lastStatus) {
      if (analysis.status === 'deadlock') {
        sys.note('alert', 'ev.alertDeadlock', {
          list: analysis.deadlocked.join(', '),
          cycles: analysis.cycles.filter(c => c.deadlocked).map(c => c.path).join(' | '),
        });
      } else if (analysis.status === 'cycle-no-deadlock') {
        sys.note('wait', 'ev.alertCycle');
      } else if (lastStatus === 'deadlock' && sys.processes.size) {
        sys.note('recovery', 'ev.recovered');
      }
      lastStatus = analysis.status;
    }
    renderSelectors();
    renderGraph();
    renderStatus();
    renderAnalysis();
    renderMatrices();
    renderLog();
    renderPlayer();
  }

  let toastTimer;
  function toast(msg, isError) {
    const box = $('toast');
    box.textContent = msg;
    box.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.className = 'toast'; }, 3200);
  }

  function act(fn) {
    try {
      fn();
    } catch (e) {
      if (!(e instanceof SimError)) throw e;
      sys.note('error', e.key, e.params);
      toast(e.message, true);
    }
    refresh();
  }

  function runStep(step) {
    const [op, p, r] = step;
    if (op === 'request') sys.request(p, r);
    else if (op === 'release') sys.release(p, r);
    else if (op === 'terminate') sys.terminate(p);
  }

  /* ======================= escenarios ======================= */

  function loadScenario(sc) {
    sys = new ResourceSystem();
    pos = new Map();
    lastStatus = 'ok';
    sys.note('info', 'ev.scenario', { title: sct(sc, 'title') });
    sc.processes.forEach(p => sys.addProcess(p));
    sc.resources.forEach(([r, n]) => sys.addResource(r, n));
    layout();
    player = { sc, index: 0 };
    selectedProc = selectedRes = null;
    refresh();
    // en pantallas angostas la barra queda debajo de la lista: llevarla a la vista
    const bar = $('scenario-player');
    const r = bar.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + r.top - 84, behavior: 'instant' });
  }

  renderScenarioList();
  $('scenario-list').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-sc]');
    if (b) loadScenario(SCENARIOS[+b.dataset.sc]);
  });

  $('btn-step').addEventListener('click', () => {
    if (!player || player.index >= player.sc.steps.length) return;
    const step = player.sc.steps[player.index++];
    act(() => runStep(step));
  });
  $('btn-run-all').addEventListener('click', () => {
    if (!player) return;
    act(() => {
      while (player.index < player.sc.steps.length) {
        const step = player.sc.steps[player.index++];
        runStep(step);
        // registrar el estado intermedio para que las alertas aparezcan en orden
        if (sys.analyze().status !== lastStatus) refresh();
      }
    });
  });

  /* ======================= controles ======================= */

  $('btn-add-proc').addEventListener('click', () => act(() => {
    const id = sys.addProcess($('in-proc').value);
    $('in-proc').value = '';
    selectedProc = id;
    layout();
  }));
  $('btn-add-res').addEventListener('click', () => act(() => {
    const id = sys.addResource($('in-res').value, $('in-inst').value);
    $('in-res').value = '';
    selectedRes = id;
    layout();
  }));
  $('in-proc').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-add-proc').click(); });
  $('in-res').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-add-res').click(); });

  $('sel-proc').addEventListener('change', e => { selectedProc = e.target.value; renderGraph(); });
  $('sel-res').addEventListener('change', e => { selectedRes = e.target.value; renderGraph(); });

  $('btn-request').addEventListener('click', () => act(() => sys.request(selectedProc, selectedRes)));
  $('btn-release').addEventListener('click', () => act(() => sys.release(selectedProc, selectedRes)));
  $('btn-terminate').addEventListener('click', () => act(() => { sys.terminate(selectedProc); pos.delete(selectedProc); }));
  $('btn-del-res').addEventListener('click', () => act(() => { sys.removeResource(selectedRes); pos.delete(selectedRes); }));

  $('analysis').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    const { act: kind, pid, rid } = b.dataset;
    act(() => {
      if (kind === 'terminate') { sys.terminate(pid, 'recovery'); pos.delete(pid); }
      else if (kind === 'preempt') sys.preempt(pid, rid);
      else if (kind === 'auto') {
        const victims = sys.autoRecover();
        victims.forEach(v => pos.delete(v));
        toast(t('toast.auto', { list: victims.join(', ') }));
      }
    });
  });

  $('btn-reset').addEventListener('click', () => {
    sys = new ResourceSystem();
    pos = new Map();
    player = null;
    lastStatus = 'ok';
    selectedProc = selectedRes = null;
    refresh();
  });

  $('btn-clear-log').addEventListener('click', () => { sys.events = []; renderLog(); });

  $('btn-export').addEventListener('click', () => {
    const a = sys.analyze();
    const data = {
      herramienta: 'Deadlock Hunter',
      idioma: I18n.lang,
      generado: new Date().toISOString(),
      escenario: player ? sct(player.sc, 'title') : null,
      estado: sys.toJSON(),
      posiciones: Object.fromEntries(pos),
      analisis: {
        estado: a.status,
        ciclos: a.cycles.map(c => ({ ruta: c.path, interbloqueo: c.deadlocked, unaInstancia: c.singleInstance })),
        interbloqueados: a.deadlocked,
        bloqueoIndirecto: a.indirect,
        deteccion: a.detection.trace.map(x => x.text),
        victimaSugerida: a.recovery ? a.recovery.victim : null,
      },
      registro: sys.events.map(e => ({ ...e, mensaje: eventText(e) })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `deadlock-hunter-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $('file-import').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const next = ResourceSystem.fromJSON(data.estado || data);
      next.events = Array.isArray(data.registro)
        ? data.registro.map(e => e.key ? e : { ...e, message: e.mensaje || e.message })
        : [];
      next.time = next.events.reduce((m, e) => Math.max(m, e.t || 0), 0);
      next.note('info', 'ev.imported', { name: f.name });
      sys = next;
      pos = new Map();
      layout();
      if (data.posiciones) for (const [k, v] of Object.entries(data.posiciones)) if (pos.has(k)) pos.set(k, v);
      player = null;
      lastStatus = sys.analyze().status;
      refresh();
      toast(t('toast.imported'));
    } catch (e) {
      toast(t('toast.importFail', { msg: e.message }), true);
    }
  });

  /* ======================= idioma ======================= */

  I18n.onChange(() => {
    renderScenarioList();
    renderLog(true);
    refresh();
  });

  // API mínima para el resto del sitio (botones "Probar en el simulador").
  window.DeadlockApp = {
    loadScenario: (i) => loadScenario(SCENARIOS[i]),
  };

  refresh();
})();
