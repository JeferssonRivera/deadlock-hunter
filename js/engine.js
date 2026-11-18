/**
 * Deadlock Hunter — Motor de simulación
 * ------------------------------------------------------------
 * Modela procesos y recursos (con una o varias instancias), las
 * operaciones solicitar / liberar / finalizar y el análisis del
 * grafo de asignación de recursos (RAG):
 *   - Detección de ciclos (espera circular) sobre el grafo de espera.
 *   - Algoritmo de detección de interbloqueo (Work / Finish) que
 *     distingue "ciclo" de "interbloqueo real" cuando hay recursos
 *     con varias instancias.
 *   - Recuperación: finalización de un proceso víctima o
 *     expropiación (liberación forzada) de un recurso.
 *
 * No depende del DOM: funciona en el navegador (window.DeadlockEngine)
 * y en Node.js (module.exports). Los textos salen de i18n.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./i18n.js'));
  else root.DeadlockEngine = factory(root.DeadlockI18n);
})(typeof self !== 'undefined' ? self : this, function (I18n) {
  'use strict';

  const t = I18n.t;

  class SimError extends Error {
    constructor(key, params) {
      super(t(key, params));
      this.name = 'SimError';
      this.key = key;
      this.params = params;
    }
  }

  const MAX_INSTANCES = 9;
  const MAX_CYCLES = 100;

  function fmtVector(obj) {
    const keys = Object.keys(obj);
    if (!keys.length) return '∅';
    return '{' + keys.map(k => `${k}:${obj[k]}`).join(', ') + '}';
  }

  /** Texto de un evento del registro en el idioma actual. */
  function eventText(e) {
    return e.key ? t(e.key, e.params) : (e.message || '');
  }

  const fmtCounts = (list, idKey) => list.map(x => x.count > 1 ? `${x[idKey]}×${x.count}` : x[idKey]).join(', ');

  class ResourceSystem {
    constructor() { this.reset(); }

    reset() {
      /** @type {Map<string,{id:string, holds:Map<string,number>, waiting:string|null}>} */
      this.processes = new Map();
      /** @type {Map<string,{id:string, total:number, queue:string[]}>} */
      this.resources = new Map();
      this.counters = { P: 0, R: 0 };
      this.events = [];
      this.time = 0;
    }

    /* ---------------- utilidades internas ---------------- */

    _log(type, key, params) {
      const e = { t: ++this.time, type, key, params: params || {} };
      this.events.push(e);
      return e;
    }

    /** Agrega una nota al registro de eventos (usado por la interfaz). */
    note(type, key, params) { return this._log(type, key, params); }

    _proc(id) {
      const p = this.processes.get(id);
      if (!p) throw new SimError('err.noProc', { id });
      return p;
    }

    _res(id) {
      const r = this.resources.get(id);
      if (!r) throw new SimError('err.noRes', { id });
      return r;
    }

    _nextId(prefix) {
      let id;
      do { id = prefix + (++this.counters[prefix]); }
      while (this.processes.has(id) || this.resources.has(id));
      return id;
    }

    _checkNewId(id) {
      if (!/^[A-Za-z0-9_-]{1,12}$/.test(id)) throw new SimError('err.badName');
      if (this.processes.has(id) || this.resources.has(id)) throw new SimError('err.dupName', { id });
    }

    _assign(p, r) {
      p.holds.set(r.id, (p.holds.get(r.id) || 0) + 1);
    }

    /* ---------------- consultas ---------------- */

    allocated(rid) {
      let s = 0;
      for (const p of this.processes.values()) s += p.holds.get(rid) || 0;
      return s;
    }

    available(rid) { return this._res(rid).total - this.allocated(rid); }

    holding(pid, rid) { return this._proc(pid).holds.get(rid) || 0; }

    holdersOf(rid) {
      const out = [];
      for (const p of this.processes.values()) {
        const c = p.holds.get(rid) || 0;
        if (c > 0) out.push({ pid: p.id, count: c });
      }
      return out;
    }

    processState(pid) {
      const p = this._proc(pid);
      return p.waiting ? 'blocked' : 'ready';
    }

    /** Aristas del grafo de asignación. */
    edges() {
      const list = [];
      for (const p of this.processes.values()) {
        if (p.waiting) list.push({ type: 'request', from: p.id, to: p.waiting, count: 1 });
        for (const [rid, c] of p.holds) list.push({ type: 'assign', from: rid, to: p.id, count: c });
      }
      return list;
    }

    /* ---------------- estructura ---------------- */

    addProcess(id) {
      id = (id || '').trim() || this._nextId('P');
      this._checkNewId(id);
      this.processes.set(id, { id, holds: new Map(), waiting: null });
      this._log('info', 'ev.procCreated', { id });
      return id;
    }

    addResource(id, total = 1) {
      total = Number(total);
      if (!Number.isInteger(total) || total < 1 || total > MAX_INSTANCES) {
        throw new SimError('err.instances', { max: MAX_INSTANCES });
      }
      id = (id || '').trim() || this._nextId('R');
      this._checkNewId(id);
      this.resources.set(id, { id, total, queue: [] });
      this._log('info', 'ev.resCreated', { id, total });
      return id;
    }

    removeResource(rid) {
      const r = this._res(rid);
      if (this.allocated(rid) > 0 || r.queue.length) throw new SimError('err.removeBusy', { rid });
      this.resources.delete(rid);
      this._log('info', 'ev.resRemoved', { rid });
    }

    /* ---------------- operaciones ---------------- */

    /**
     * Un proceso solicita UNA instancia de un recurso.
     * Si hay instancias libres se asigna (arista R → P);
     * si no, el proceso queda bloqueado (arista P → R) en una cola FIFO.
     */
    request(pid, rid) {
      const p = this._proc(pid);
      const r = this._res(rid);
      if (p.waiting) throw new SimError('err.blockedReq', { pid, rid: p.waiting });
      if (this.holding(pid, rid) >= r.total) throw new SimError('err.overTotal', { pid, total: r.total, rid });
      if (this.available(rid) > 0) {
        this._assign(p, r);
        this._log('grant', 'ev.granted', { pid, rid, free: this.available(rid), total: r.total });
        return { granted: true };
      }
      p.waiting = rid;
      r.queue.push(pid);
      this._log('wait', 'ev.wait', { pid, rid, holders: fmtCounts(this.holdersOf(rid), 'pid') });
      return { granted: false };
    }

    /** Libera UNA instancia y atiende la cola de espera del recurso. */
    release(pid, rid, reason) {
      const p = this._proc(pid);
      this._res(rid);
      const held = this.holding(pid, rid);
      if (!held) throw new SimError('err.notHolding', { pid, rid });
      if (held === 1) p.holds.delete(rid); else p.holds.set(rid, held - 1);
      if (reason === 'preempt') this._log('recovery', 'ev.preempt', { pid, rid });
      else this._log('release', 'ev.release', { pid, rid, free: this.available(rid) });
      const granted = this._serveQueue(rid);
      return { granted };
    }

    /** Expropiación: liberación forzada de un recurso (técnica de recuperación). */
    preempt(pid, rid) { return this.release(pid, rid, 'preempt'); }

    _serveQueue(rid) {
      const r = this._res(rid);
      const granted = [];
      while (this.available(rid) > 0 && r.queue.length) {
        const qid = r.queue.shift();
        const q = this.processes.get(qid);
        q.waiting = null;
        this._assign(q, r);
        granted.push(qid);
        this._log('grant', 'ev.queueGrant', { rid, qid });
      }
      return granted;
    }

    /** Finaliza (aborta) un proceso: libera todo lo que retiene y sale de las colas. */
    terminate(pid, reason) {
      const p = this._proc(pid);
      if (p.waiting) {
        const r = this.resources.get(p.waiting);
        r.queue = r.queue.filter(x => x !== pid);
      }
      const released = [...p.holds.entries()].map(([rid, count]) => ({ rid, count }));
      this.processes.delete(pid);
      const rec = reason === 'recovery';
      if (released.length) this._log(rec ? 'recovery' : 'info', rec ? 'ev.abort' : 'ev.terminate', { pid, list: fmtCounts(released, 'rid') });
      else this._log(rec ? 'recovery' : 'info', rec ? 'ev.abortNone' : 'ev.terminateNone', { pid });
      const granted = [];
      for (const { rid } of released) granted.push(...this._serveQueue(rid));
      return { released, granted };
    }

    /* ---------------- análisis ---------------- */

    /** Grafo de espera: P → Q si P espera un recurso que Q retiene. */
    waitForGraph() {
      const g = new Map();
      for (const p of this.processes.values()) {
        g.set(p.id, p.waiting ? this.holdersOf(p.waiting).map(h => h.pid) : []);
      }
      return g;
    }

    /** Enumera los ciclos simples del grafo de espera (equivalentes a ciclos del RAG). */
    findCycles() {
      const g = this.waitForGraph();
      const order = [...g.keys()];
      const idx = new Map(order.map((k, i) => [k, i]));
      const cycles = [];
      for (const start of order) {
        const s = idx.get(start);
        const stack = [start];
        const onPath = new Set([start]);
        const dfs = (u) => {
          if (cycles.length >= MAX_CYCLES) return;
          for (const v of g.get(u)) {
            if (idx.get(v) < s) continue;          // cada ciclo se reporta una sola vez
            if (v === start) cycles.push(stack.slice());
            else if (!onPath.has(v)) {
              onPath.add(v); stack.push(v);
              dfs(v);
              stack.pop(); onPath.delete(v);
            }
          }
        };
        dfs(start);
      }
      // Expandir a la forma del RAG: P -(espera)-> R -(asignado a)-> P'
      return cycles.map(procs => {
        const steps = procs.map((pid, i) => {
          const next = procs[(i + 1) % procs.length];
          return { pid, rid: this.processes.get(pid).waiting, holder: next };
        });
        const rids = [...new Set(steps.map(s => s.rid))];
        return {
          processes: procs,
          resources: rids,
          steps,
          singleInstance: rids.every(r => this.resources.get(r).total === 1),
          path: steps.map(s => `${s.pid} → ${s.rid}`).join(' → ') + ` → ${procs[0]}`,
        };
      });
    }

    /**
     * Algoritmo de detección (variante para múltiples instancias):
     *   Work = Disponible; Finish[i] = false
     *   Repetir: buscar Pi con Finish[i] = false y Solicitud_i ≤ Work
     *            → Work += Asignación_i ; Finish[i] = true
     *   Los procesos con Finish = false al final están interbloqueados.
     */
    detect() {
      const work = {};
      for (const r of this.resources.values()) work[r.id] = this.available(r.id);
      const finish = {};
      for (const pid of this.processes.keys()) finish[pid] = false;
      const trace = [{ kind: 'init', text: t('trace.init', { work: fmtVector(work) }) }];
      const order = [];
      let progress = true;
      while (progress) {
        progress = false;
        for (const p of this.processes.values()) {
          if (finish[p.id]) continue;
          const req = p.waiting ? { [p.waiting]: 1 } : {};
          if (!p.waiting || work[p.waiting] >= 1) {
            const alloc = Object.fromEntries(p.holds);
            for (const [rid, c] of p.holds) work[rid] += c;
            finish[p.id] = true;
            order.push(p.id);
            progress = true;
            trace.push({
              kind: 'finish', pid: p.id,
              text: t('trace.finish', { pid: p.id, req: fmtVector(req), alloc: fmtVector(alloc), work: fmtVector(work) }),
            });
          }
        }
      }
      const unfinished = Object.keys(finish).filter(k => !finish[k]);
      for (const pid of unfinished) {
        const p = this.processes.get(pid);
        trace.push({ kind: 'stuck', pid, text: t('trace.stuck', { pid, rid: p.waiting, avail: work[p.waiting] }) });
      }
      return { order, unfinished, trace, work };
    }

    analyze() {
      const cycles = this.findCycles();
      const det = this.detect();
      const stuck = new Set(det.unfinished);
      cycles.forEach(c => { c.deadlocked = c.processes.every(p => stuck.has(p)); });
      const core = new Set();
      cycles.filter(c => c.deadlocked).forEach(c => c.processes.forEach(p => core.add(p)));
      const indirect = det.unfinished.filter(p => !core.has(p));
      const blocked = [...this.processes.values()].filter(p => p.waiting).map(p => p.id);
      let status = 'ok';
      if (stuck.size) status = 'deadlock';
      else if (cycles.length) status = 'cycle-no-deadlock';
      return {
        status,
        cycles,
        detection: det,
        deadlocked: [...core],
        indirect,
        blocked,
        coffman: status === 'deadlock' ? this._coffman([...core]) : null,
        recovery: status === 'deadlock' ? this.recoveryOptions() : null,
      };
    }

    _coffman(core) {
      const hw = core.filter(pid => {
        const p = this.processes.get(pid);
        return p.waiting && p.holds.size > 0;
      });
      return [
        { name: t('cf.mutex'), ok: true, detail: t('cf.mutexD') },
        { name: t('cf.hold'), ok: hw.length > 0, detail: t('cf.holdD', { list: hw.join(', ') }) },
        { name: t('cf.nopre'), ok: true, detail: t('cf.nopreD') },
        { name: t('cf.circ'), ok: true, detail: t('cf.circD') },
      ];
    }

    /* ---------------- recuperación ---------------- */

    clone() {
      const c = ResourceSystem.fromJSON(this.toJSON());
      c.events = [];
      return c;
    }

    /**
     * Evalúa cada opción de recuperación simulándola sobre una copia:
     *  - abortar cada proceso interbloqueado
     *  - expropiar cada recurso involucrado en un ciclo de interbloqueo
     * Elige la víctima que deja menos procesos interbloqueados y, a
     * igualdad, la que retiene menos instancias (menor trabajo perdido).
     */
    recoveryOptions() {
      const a = this._quickStuck();
      if (!a.length) return null;
      const cycles = this.findCycles();
      const stuck = new Set(a);
      const deadCycles = cycles.filter(c => c.processes.every(p => stuck.has(p)));
      const candidates = [...new Set(deadCycles.flatMap(c => c.processes))];

      const terminations = candidates.map(pid => {
        const sim = this.clone();
        sim.terminate(pid);
        const held = [...this.processes.get(pid).holds.values()].reduce((s, x) => s + x, 0);
        return { action: 'terminate', pid, held, remaining: sim._quickStuck().length };
      }).sort((x, y) => x.remaining - y.remaining || x.held - y.held || x.pid.localeCompare(y.pid));

      const seen = new Set();
      const preemptions = [];
      for (const c of deadCycles) {
        for (const s of c.steps) {
          const key = s.holder + '|' + s.rid;
          if (seen.has(key)) continue;
          seen.add(key);
          const sim = this.clone();
          const res = sim.preempt(s.holder, s.rid);
          preemptions.push({ action: 'preempt', pid: s.holder, rid: s.rid, beneficiary: res.granted[0] || null, remaining: sim._quickStuck().length });
        }
      }
      preemptions.sort((x, y) => x.remaining - y.remaining || x.pid.localeCompare(y.pid));

      const best = terminations[0];
      return {
        terminations,
        preemptions,
        victim: best ? best.pid : null,
        reason: best
          ? t('rec.reason', { pid: best.pid, remaining: best.remaining, held: best.held, list: candidates.join(', ') })
          : '',
      };
    }

    _quickStuck() { return this.detect().unfinished; }

    /** Aplica la víctima sugerida repetidamente hasta eliminar el interbloqueo. */
    autoRecover(maxSteps = 20) {
      const actions = [];
      for (let i = 0; i < maxSteps; i++) {
        const rec = this.recoveryOptions();
        if (!rec || !rec.victim) break;
        this.terminate(rec.victim, 'recovery');
        actions.push(rec.victim);
      }
      return actions;
    }

    /* ---------------- serialización ---------------- */

    toJSON() {
      return {
        processes: [...this.processes.values()].map(p => ({ id: p.id, holds: Object.fromEntries(p.holds), waiting: p.waiting })),
        resources: [...this.resources.values()].map(r => ({ id: r.id, total: r.total, queue: [...r.queue] })),
        counters: { ...this.counters },
      };
    }

    static fromJSON(data) {
      const s = new ResourceSystem();
      for (const r of data.resources || []) s.resources.set(r.id, { id: r.id, total: r.total, queue: [...(r.queue || [])] });
      for (const p of data.processes || []) {
        s.processes.set(p.id, { id: p.id, holds: new Map(Object.entries(p.holds || {})), waiting: p.waiting || null });
      }
      if (data.counters) s.counters = { ...data.counters };
      for (const r of s.resources.values()) {
        if (s.allocated(r.id) > r.total) throw new SimError('err.invalidState', { rid: r.id });
      }
      return s;
    }
  }

  return { ResourceSystem, SimError, fmtVector, eventText, MAX_INSTANCES };
});
