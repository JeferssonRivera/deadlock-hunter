/**
 * Casos de prueba del motor. Se ejecutan en el navegador (tests/index.html)
 * o en Node.js (node tests/run-node.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeadlockTests = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function makeAssert() {
    return {
      ok(cond, msg) { if (!cond) throw new Error(msg || 'Se esperaba verdadero'); },
      equal(a, b, msg) { if (a !== b) throw new Error(`${msg || 'Valores distintos'}: obtenido ${JSON.stringify(a)}, esperado ${JSON.stringify(b)}`); },
      deepEqual(a, b, msg) {
        const ja = JSON.stringify(a), jb = JSON.stringify(b);
        if (ja !== jb) throw new Error(`${msg || 'Estructuras distintas'}: obtenido ${ja}, esperado ${jb}`);
      },
      throws(fn, msg) {
        let threw = false;
        try { fn(); } catch (e) { threw = true; }
        if (!threw) throw new Error(msg || 'Se esperaba una excepción');
      },
    };
  }

  function build(E, procs, res) {
    const s = new E.ResourceSystem();
    procs.forEach(p => s.addProcess(p));
    res.forEach(([r, n]) => s.addResource(r, n));
    return s;
  }

  function runScenario(E, sc) {
    const s = build(E, sc.processes, sc.resources);
    const statuses = [];
    for (const [op, p, r] of sc.steps) {
      if (op === 'request') s.request(p, r);
      else if (op === 'release') s.release(p, r);
      else if (op === 'terminate') s.terminate(p);
      statuses.push(s.analyze().status);
    }
    return { s, statuses };
  }

  const cases = [
    ['T01 Solicitud concedida si hay instancias libres', (E, A) => {
      const s = build(E, ['P1'], [['R1', 1]]);
      A.equal(s.request('P1', 'R1').granted, true);
      A.equal(s.holding('P1', 'R1'), 1);
      A.equal(s.available('R1'), 0);
      A.deepEqual(s.edges(), [{ type: 'assign', from: 'R1', to: 'P1', count: 1 }]);
    }],

    ['T02 Solicitud sin instancias libres bloquea al proceso (arista P → R)', (E, A) => {
      const s = build(E, ['P1', 'P2'], [['R1', 1]]);
      s.request('P1', 'R1');
      A.equal(s.request('P2', 'R1').granted, false);
      A.equal(s.processState('P2'), 'blocked');
      A.ok(s.edges().some(e => e.type === 'request' && e.from === 'P2' && e.to === 'R1'));
      A.equal(s.analyze().status, 'ok', 'Esperar sin ciclo no es interbloqueo');
    }],

    ['T03 Interbloqueo clásico de 2 procesos detectado', (E, A) => {
      const s = build(E, ['P1', 'P2'], [['R1', 1], ['R2', 1]]);
      s.request('P1', 'R1'); s.request('P2', 'R2'); s.request('P1', 'R2'); s.request('P2', 'R1');
      const a = s.analyze();
      A.equal(a.status, 'deadlock');
      A.equal(a.cycles.length, 1);
      A.deepEqual(a.cycles[0].processes, ['P1', 'P2']);
      A.equal(a.cycles[0].path, 'P1 → R2 → P2 → R1 → P1');
      A.equal(a.cycles[0].singleInstance, true);
      A.deepEqual(a.deadlocked.sort(), ['P1', 'P2']);
    }],

    ['T04 Condiciones de Coffman reportadas en el interbloqueo', (E, A) => {
      const s = build(E, ['P1', 'P2'], [['R1', 1], ['R2', 1]]);
      s.request('P1', 'R1'); s.request('P2', 'R2'); s.request('P1', 'R2'); s.request('P2', 'R1');
      const c = s.analyze().coffman;
      A.equal(c.length, 4);
      A.ok(c.every(x => x.ok), 'Las 4 condiciones deben cumplirse');
    }],

    ['T05 Liberar atiende la cola FIFO y desbloquea', (E, A) => {
      const s = build(E, ['P1', 'P2', 'P3'], [['R1', 1]]);
      s.request('P1', 'R1'); s.request('P2', 'R1'); s.request('P3', 'R1');
      const r = s.release('P1', 'R1');
      A.deepEqual(r.granted, ['P2'], 'Debe recibirlo el primero de la cola');
      A.equal(s.processState('P2'), 'ready');
      A.equal(s.processState('P3'), 'blocked');
    }],

    ['T06 Un proceso bloqueado no puede hacer otra solicitud', (E, A) => {
      const s = build(E, ['P1', 'P2'], [['R1', 1], ['R2', 1]]);
      s.request('P1', 'R1'); s.request('P2', 'R1');
      A.throws(() => s.request('P2', 'R2'));
    }],

    ['T07 Validaciones: liberar sin retener, nombres duplicados, instancias', (E, A) => {
      const s = build(E, ['P1'], [['R1', 1]]);
      A.throws(() => s.release('P1', 'R1'), 'liberar sin retener');
      A.throws(() => s.addProcess('P1'), 'duplicado');
      A.throws(() => s.addResource('R9', 0), '0 instancias');
      A.throws(() => s.addResource('R9', 10), '10 instancias');
      s.request('P1', 'R1');
      A.throws(() => s.request('P1', 'R1'), 'pedir más de lo que existe');
    }],

    ['T08 Ciclo con recursos multi-instancia SIN interbloqueo', (E, A) => {
      const s = build(E, ['P1', 'P2', 'P3'], [['R1', 2], ['R2', 1]]);
      s.request('P2', 'R1'); s.request('P3', 'R1'); s.request('P1', 'R2');
      s.request('P1', 'R1'); s.request('P2', 'R2');
      const a = s.analyze();
      A.equal(a.cycles.length, 1, 'Debe existir el ciclo');
      A.equal(a.status, 'cycle-no-deadlock');
      A.deepEqual(a.detection.order, ['P3', 'P1', 'P2'], 'Orden de terminación del algoritmo');
    }],

    ['T09 Traza del algoritmo de detección (Work) verificable', (E, A) => {
      const s = build(E, ['P1', 'P2', 'P3'], [['R1', 2], ['R2', 1]]);
      s.request('P2', 'R1'); s.request('P3', 'R1'); s.request('P1', 'R2');
      s.request('P1', 'R1'); s.request('P2', 'R2');
      const t = s.analyze().detection.trace.map(x => x.text);
      A.equal(t[0], 'Work inicial = Disponible = {R1:0, R2:0}');
      A.ok(t[1].startsWith('P3') && t[1].endsWith('Work = {R1:1, R2:0}'), t[1]);
      A.ok(t[2].startsWith('P1') && t[2].endsWith('Work = {R1:1, R2:1}'), t[2]);
      A.ok(t[3].startsWith('P2') && t[3].endsWith('Work = {R1:2, R2:1}'), t[3]);
    }],

    ['T10 Liberar un recurso rompe el ciclo multi-instancia', (E, A) => {
      const s = build(E, ['P1', 'P2', 'P3'], [['R1', 2], ['R2', 1]]);
      s.request('P2', 'R1'); s.request('P3', 'R1'); s.request('P1', 'R2');
      s.request('P1', 'R1'); s.request('P2', 'R2');
      A.deepEqual(s.release('P3', 'R1').granted, ['P1']);
      A.equal(s.analyze().cycles.length, 0);
    }],

    ['T11 Cadena circular de 3 procesos', (E, A) => {
      const s = build(E, ['P1', 'P2', 'P3'], [['R1', 1], ['R2', 1], ['R3', 1]]);
      ['P1:R1', 'P2:R2', 'P3:R3', 'P1:R2', 'P2:R3', 'P3:R1'].forEach(x => { const [p, r] = x.split(':'); s.request(p, r); });
      const a = s.analyze();
      A.equal(a.status, 'deadlock');
      A.equal(a.cycles[0].processes.length, 3);
    }],

    ['T12 Bloqueo indirecto: proceso fuera del ciclo', (E, A) => {
      const s = build(E, ['P1', 'P2', 'P3'], [['R1', 1], ['R2', 1]]);
      s.request('P1', 'R1'); s.request('P2', 'R2'); s.request('P1', 'R2'); s.request('P2', 'R1'); s.request('P3', 'R1');
      const a = s.analyze();
      A.deepEqual(a.deadlocked.sort(), ['P1', 'P2']);
      A.deepEqual(a.indirect, ['P3']);
    }],

    ['T13 Recuperación: finalizar una víctima resuelve el interbloqueo', (E, A) => {
      const s = build(E, ['P1', 'P2'], [['R1', 1], ['R2', 1]]);
      s.request('P1', 'R1'); s.request('P2', 'R2'); s.request('P1', 'R2'); s.request('P2', 'R1');
      const rec = s.analyze().recovery;
      A.equal(rec.victim, 'P1', 'Empate de costo → orden alfabético');
      A.equal(rec.terminations[0].remaining, 0);
      const r = s.terminate(rec.victim, 'recovery');
      A.deepEqual(r.granted, ['P2'], 'P2 recibe R1 al abortar P1');
      A.equal(s.analyze().status, 'ok');
    }],

    ['T14 Recuperación: expropiar un recurso resuelve el interbloqueo', (E, A) => {
      const s = build(E, ['P1', 'P2'], [['R1', 1], ['R2', 1]]);
      s.request('P1', 'R1'); s.request('P2', 'R2'); s.request('P1', 'R2'); s.request('P2', 'R1');
      const r = s.preempt('P2', 'R2');
      A.deepEqual(r.granted, ['P1']);
      A.equal(s.analyze().status, 'ok');
    }],

    ['T15 Recuperación automática en cadena de 3 procesos', (E, A) => {
      const s = build(E, ['P1', 'P2', 'P3'], [['R1', 1], ['R2', 1], ['R3', 1]]);
      ['P1:R1', 'P2:R2', 'P3:R3', 'P1:R2', 'P2:R3', 'P3:R1'].forEach(x => { const [p, r] = x.split(':'); s.request(p, r); });
      const victims = s.autoRecover();
      A.equal(victims.length, 1, 'Basta con una víctima');
      A.equal(s.analyze().status, 'ok');
    }],

    ['T16 Finalizar un proceso que espera lo retira de la cola', (E, A) => {
      const s = build(E, ['P1', 'P2', 'P3'], [['R1', 1]]);
      s.request('P1', 'R1'); s.request('P2', 'R1'); s.request('P3', 'R1');
      s.terminate('P2');
      A.deepEqual(s.release('P1', 'R1').granted, ['P3']);
    }],

    ['T17 Serialización conserva el análisis', (E, A) => {
      const s = build(E, ['P1', 'P2'], [['R1', 1], ['R2', 2]]);
      s.request('P1', 'R1'); s.request('P1', 'R2'); s.request('P2', 'R2'); s.request('P2', 'R1');
      const c = E.ResourceSystem.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
      A.deepEqual(c.toJSON(), s.toJSON());
      A.equal(c.analyze().status, s.analyze().status);
    }],
  ];

  /** Nombres en inglés para mostrar las pruebas cuando la página está en inglés. */
  const EN = {
    T01: 'T01 Request granted when instances are free',
    T02: 'T02 Request without free instances blocks the process (edge P → R)',
    T03: 'T03 Classic 2-process deadlock detected',
    T04: 'T04 Coffman conditions reported for the deadlock',
    T05: 'T05 Release serves the FIFO queue and unblocks',
    T06: 'T06 A blocked process cannot make another request',
    T07: 'T07 Validations: release without holding, duplicate names, instances',
    T08: 'T08 Cycle with multi-instance resources WITHOUT deadlock',
    T09: 'T09 Detection algorithm trace (Work) is verifiable',
    T10: 'T10 Releasing a resource breaks the multi-instance cycle',
    T11: 'T11 Circular chain of 3 processes',
    T12: 'T12 Indirect blocking: process outside the cycle',
    T13: 'T13 Recovery: terminating a victim solves the deadlock',
    T14: 'T14 Recovery: preempting a resource solves the deadlock',
    T15: 'T15 Automatic recovery on a 3-process chain',
    T16: 'T16 Terminating a waiting process removes it from the queue',
    T17: 'T17 Serialization preserves the analysis',
  };

  function scenarioCases(E, scenarios) {
    return scenarios.map(sc => [`E-${sc.id}: escenario "${sc.title}" termina en estado ${sc.expect}`, (_, A) => {
      const { statuses } = runScenario(E, sc);
      A.equal(statuses[statuses.length - 1], sc.expect);
      if (sc.id === 'safe-order') A.ok(statuses.every(x => x === 'ok'), 'Nunca debe aparecer un ciclo: ' + statuses.join(','));
    }, `E-${sc.id}: scenario "${sc.en ? sc.en.title : sc.title}" ends in state ${sc.expect}`]);
  }

  /**
   * Ejecuta todas las pruebas. Si se pasa I18n, se ejecutan en español
   * (las aserciones comparan textos en español) y luego se restaura el idioma.
   */
  function run(E, scenarios, I18n) {
    const prev = I18n && I18n.lang;
    if (I18n) I18n.setLang('es');
    const all = cases.concat(scenarios ? scenarioCases(E, scenarios) : []);
    const out = all.map(([name, fn, enName]) => {
      const nameEn = enName || EN[name.slice(0, 3)] || name;
      try { fn(E, makeAssert()); return { name, nameEn, pass: true }; }
      catch (e) { return { name, nameEn, pass: false, error: e.message }; }
    });
    if (I18n && prev) I18n.setLang(prev);
    return out;
  }

  return { run };
});
