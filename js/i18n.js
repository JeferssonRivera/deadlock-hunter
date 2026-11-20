/**
 * Deadlock Hunter — Internacionalización (español / inglés)
 * - t(clave, parámetros): textos dinámicos del motor y del simulador.
 * - applyStatic(): textos fijos del HTML marcados con data-en,
 *   data-en-ph (placeholder) y data-en-title (tooltip).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeadlockI18n = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const dict = {
    es: {
      /* ---- errores del motor ---- */
      'err.noProc': 'No existe el proceso "{id}".',
      'err.noRes': 'No existe el recurso "{id}".',
      'err.badName': 'El nombre debe tener de 1 a 12 caracteres (letras, números, "_" o "-").',
      'err.dupName': 'Ya existe un nodo llamado "{id}".',
      'err.instances': 'El número de instancias debe ser un entero entre 1 y {max}.',
      'err.removeBusy': 'No se puede eliminar {rid}: está asignado o hay procesos esperándolo.',
      'err.blockedReq': '{pid} está bloqueado esperando {rid}; un proceso bloqueado no puede emitir nuevas solicitudes.',
      'err.overTotal': '{pid} ya retiene las {total} instancia(s) de {rid}; esa solicitud nunca podría satisfacerse.',
      'err.notHolding': '{pid} no retiene ninguna instancia de {rid}.',
      'err.invalidState': 'Estado inválido: {rid} tiene más asignaciones que instancias.',
      'err.select': 'Selecciona un proceso y un recurso.',

      /* ---- eventos del registro ---- */
      'ev.procCreated': 'Proceso {id} creado.',
      'ev.resCreated': 'Recurso {id} creado con {total} instancia(s).',
      'ev.resRemoved': 'Recurso {rid} eliminado.',
      'ev.granted': '{pid} solicita {rid} → concedido (libres ahora: {free}/{total}).',
      'ev.wait': '{pid} solicita {rid} → no hay instancias libres (las retiene {holders}). {pid} queda BLOQUEADO.',
      'ev.preempt': 'RECUPERACIÓN: se expropia una instancia de {rid} a {pid}.',
      'ev.release': '{pid} libera {rid} (libres ahora: {free}).',
      'ev.queueGrant': '{rid} se asigna a {qid}, que estaba en espera → {qid} se desbloquea.',
      'ev.terminate': 'Finaliza {pid}; libera {list}.',
      'ev.terminateNone': 'Finaliza {pid}; no retenía recursos.',
      'ev.abort': 'RECUPERACIÓN: se aborta {pid}; libera {list}.',
      'ev.abortNone': 'RECUPERACIÓN: se aborta {pid}; no retenía recursos.',
      'ev.scenario': '— Escenario: {title} —',
      'ev.imported': 'Estado importado desde {name}.',
      'ev.error': '✘ {msg}',
      'ev.alertDeadlock': '⚠ Interbloqueo detectado entre {list}. Ciclo: {cycles}',
      'ev.alertCycle': 'Se formó un ciclo, pero el algoritmo de detección muestra que todos los procesos pueden terminar.',
      'ev.recovered': '✔ El sistema salió del interbloqueo.',

      /* ---- algoritmo de detección ---- */
      'trace.init': 'Work inicial = Disponible = {work}',
      'trace.finish': '{pid}: Solicitud {req} ≤ Work → puede terminar y devuelve {alloc} ⇒ Work = {work}',
      'trace.stuck': '{pid}: Solicitud {{rid}:1} > Work ({rid}:{avail}) → no puede terminar',

      /* ---- Coffman ---- */
      'cf.mutex': 'Exclusión mutua',
      'cf.mutexD': 'Cada instancia de recurso se asigna a un único proceso a la vez.',
      'cf.hold': 'Retención y espera',
      'cf.holdD': '{list} retiene(n) recursos mientras espera(n) otro.',
      'cf.nopre': 'No expropiación',
      'cf.nopreD': 'Los recursos solo se liberan voluntariamente (salvo que se aplique recuperación).',
      'cf.circ': 'Espera circular',
      'cf.circD': 'Existe un ciclo cerrado de procesos que se esperan mutuamente.',

      'rec.reason': 'Abortar {pid} deja {remaining} proceso(s) interbloqueado(s) y solo pierde {held} instancia(s) asignada(s); es la opción de menor costo entre {list}.',

      /* ---- interfaz ---- */
      'status.empty': 'Sin procesos todavía',
      'status.dead': '¡INTERBLOQUEO DETECTADO! Procesos atrapados: {list}',
      'status.affected': ' · afectados: {list}',
      'status.cycle': 'Hay un ciclo (espera circular posible), pero NO hay interbloqueo',
      'status.okWaiting': 'Sin interbloqueo · {n} proceso(s) en espera, sin ciclo',
      'status.okNone': 'Sin interbloqueo · ningún proceso bloqueado',

      'node.running': 'en ejecución',
      'node.dead': 'interbloqueado',
      'node.indirect': 'bloqueo indirecto',
      'node.waiting': 'en espera',
      'tip.proc': '{id}\nRetiene: {holds}\nEspera: {waiting}',
      'tip.res': '{id}: {free}/{total} libres\nAsignado a: {holders}\nCola de espera: {queue}',
      'tip.req': '{from} solicita {to} (espera)',
      'tip.asg': '{from} asignado a {to}',
      'tip.asgN': '{from} asignado a {to} ({n} instancias)',
      'word.nothing': 'nada',
      'word.nobody': 'nadie',
      'word.empty': 'vacía',

      'an.empty': 'Aún no hay nada que analizar.',
      'pill.procs': '{n} procesos',
      'pill.res': '{n} recursos',
      'pill.waiting': '{n} en espera',
      'pill.cycles': '{n} ciclo(s)',
      'an.cyclesTitle': 'Detección de ciclos (espera circular)',
      'an.noCycles': 'No hay ciclos en el grafo ⇒ no existe espera circular ⇒ <b>no puede haber interbloqueo</b>.',
      'an.noCyclesWaiting': ' Los procesos en espera ({list}) avanzarán cuando se liberen sus recursos.',
      'cycle.waitLine': '<b>{pid}</b> espera <b>{rid}</b>{inst}, que está asignado a <b>{holder}</b>.',
      'cycle.inst': ' ({n} inst.)',
      'cycle.single': 'Todos los recursos del ciclo tienen <b>una sola instancia</b> ⇒ el ciclo <b>es un interbloqueo</b>: nadie puede liberar lo que el otro necesita.',
      'cycle.multi': 'Hay recursos con varias instancias, pero el algoritmo de detección confirma que <b>ninguno de estos procesos puede terminar</b> ⇒ interbloqueo.',
      'cycle.possible': 'Es una espera circular <b>posible</b>, pero no definitiva: ',
      'cycle.helpers': '{list} puede terminar y liberar una instancia que rompe el ciclo.',
      'cycle.helper': '{pid} (tiene {rid})',
      'cycle.helpersGeneric': 'otro proceso puede terminar y liberar instancias.',
      'cycle.necessary': ' Con recursos de varias instancias, un ciclo es condición necesaria pero no suficiente.',
      'pill.deadlock': 'Interbloqueo',
      'pill.cycleOnly': 'Ciclo sin interbloqueo',
      'an.coffman': 'Condiciones de Coffman',
      'an.indirectTitle': 'Bloqueo indirecto',
      'an.indirectText': '{list} no está(n) en el ciclo, pero espera(n) recursos retenidos por procesos interbloqueados: tampoco podrá(n) avanzar.',
      'an.detection': 'Algoritmo de detección',
      'an.cannot': 'No pueden terminar: {list}',
      'an.allFinish': 'Todos pueden terminar · orden: {order}',
      'an.recovery': 'Recuperación',
      'rec.abort': 'Abortar <b>{pid}</b>',
      'rec.suggested': ' (sugerido)',
      'rec.abortMeta': 'pierde {held} inst. · quedan {rem} interbloq.',
      'rec.preempt': 'Expropiar <b>{rid}</b> a {pid}',
      'rec.preemptMeta': 'quedan {rem} interbloq.',
      'rec.auto': 'Recuperación automática',
      'rec.autoSub': 'aborta víctimas hasta resolver',

      'mx.none': 'Se mostrarán al haber procesos y recursos.',
      'mx.alloc': 'Asignación (instancias que retiene cada proceso)',
      'mx.req': 'Solicitud (instancias que espera)',
      'mx.total': 'Total de instancias',
      'mx.avail': 'Disponible',

      'step.request': '{p} solicita {r}',
      'step.release': '{p} libera {r}',
      'step.terminate': 'Finaliza {p}',
      'lesson.title': '¿Qué ocurrió?',
      'player.count': 'Paso {i} de {n}',
      'player.done': '✔ Completado',
      'tag.deadlock': 'BLOQUEO',
      'tag.safe': 'SEGURO',

      'toast.auto': 'Recuperación automática: se abortó {list}.',
      'toast.imported': 'Estado importado correctamente.',
      'toast.importFail': 'No se pudo importar: {msg}',

      'hint.scenario': '▶ Escenario cargado. Pulsa <b>Paso ▶</b> para ejecutarlo paso a paso o <b>Ejecutar todo ⏩</b> para verlo completo: las flechas aparecen cuando los procesos piden recursos.',
      'hint.noEdges': 'Aún no hay flechas: elige un proceso y un recurso en <b>3 · Operar</b> y pulsa <b>Solicitar</b>, o carga un escenario.',
      'tests.ok': 'Todas las pruebas superadas',
      'tests.fail': '{n} prueba(s) fallida(s)',
      'tests.when': 'Ejecutadas: {date}',
      'doc.title': 'Deadlock Hunter · Universidad Simón Bolívar',
    },

    en: {
      'err.noProc': 'Process "{id}" does not exist.',
      'err.noRes': 'Resource "{id}" does not exist.',
      'err.badName': 'The name must be 1 to 12 characters long (letters, digits, "_" or "-").',
      'err.dupName': 'A node named "{id}" already exists.',
      'err.instances': 'The number of instances must be an integer between 1 and {max}.',
      'err.removeBusy': 'Cannot delete {rid}: it is allocated or processes are waiting for it.',
      'err.blockedReq': '{pid} is blocked waiting for {rid}; a blocked process cannot make new requests.',
      'err.overTotal': '{pid} already holds all {total} instance(s) of {rid}; that request could never be satisfied.',
      'err.notHolding': '{pid} does not hold any instance of {rid}.',
      'err.invalidState': 'Invalid state: {rid} has more allocations than instances.',
      'err.select': 'Select a process and a resource.',

      'ev.procCreated': 'Process {id} created.',
      'ev.resCreated': 'Resource {id} created with {total} instance(s).',
      'ev.resRemoved': 'Resource {rid} deleted.',
      'ev.granted': '{pid} requests {rid} → granted (free now: {free}/{total}).',
      'ev.wait': '{pid} requests {rid} → no free instances (held by {holders}). {pid} is now BLOCKED.',
      'ev.preempt': 'RECOVERY: one instance of {rid} is preempted from {pid}.',
      'ev.release': '{pid} releases {rid} (free now: {free}).',
      'ev.queueGrant': '{rid} is allocated to {qid}, which was waiting → {qid} is unblocked.',
      'ev.terminate': '{pid} terminates; releases {list}.',
      'ev.terminateNone': '{pid} terminates; it held no resources.',
      'ev.abort': 'RECOVERY: {pid} is aborted; releases {list}.',
      'ev.abortNone': 'RECOVERY: {pid} is aborted; it held no resources.',
      'ev.scenario': '— Scenario: {title} —',
      'ev.imported': 'State imported from {name}.',
      'ev.error': '✘ {msg}',
      'ev.alertDeadlock': '⚠ Deadlock detected among {list}. Cycle: {cycles}',
      'ev.alertCycle': 'A cycle was formed, but the detection algorithm shows that every process can finish.',
      'ev.recovered': '✔ The system is out of the deadlock.',

      'trace.init': 'Initial Work = Available = {work}',
      'trace.finish': '{pid}: Request {req} ≤ Work → can finish and returns {alloc} ⇒ Work = {work}',
      'trace.stuck': '{pid}: Request {{rid}:1} > Work ({rid}:{avail}) → cannot finish',

      'cf.mutex': 'Mutual exclusion',
      'cf.mutexD': 'Each resource instance is allocated to a single process at a time.',
      'cf.hold': 'Hold and wait',
      'cf.holdD': '{list} hold(s) resources while waiting for another one.',
      'cf.nopre': 'No preemption',
      'cf.nopreD': 'Resources are only released voluntarily (unless recovery is applied).',
      'cf.circ': 'Circular wait',
      'cf.circD': 'There is a closed chain of processes waiting for each other.',

      'rec.reason': 'Aborting {pid} leaves {remaining} deadlocked process(es) and only loses {held} allocated instance(s); it is the lowest-cost option among {list}.',

      'status.empty': 'No processes yet',
      'status.dead': 'DEADLOCK DETECTED! Trapped processes: {list}',
      'status.affected': ' · affected: {list}',
      'status.cycle': 'There is a cycle (possible circular wait), but NO deadlock',
      'status.okWaiting': 'No deadlock · {n} process(es) waiting, no cycle',
      'status.okNone': 'No deadlock · no blocked processes',

      'node.running': 'running',
      'node.dead': 'deadlocked',
      'node.indirect': 'indirectly blocked',
      'node.waiting': 'waiting',
      'tip.proc': '{id}\nHolds: {holds}\nWaiting for: {waiting}',
      'tip.res': '{id}: {free}/{total} free\nAllocated to: {holders}\nWait queue: {queue}',
      'tip.req': '{from} requests {to} (waiting)',
      'tip.asg': '{from} allocated to {to}',
      'tip.asgN': '{from} allocated to {to} ({n} instances)',
      'word.nothing': 'nothing',
      'word.nobody': 'nobody',
      'word.empty': 'empty',

      'an.empty': 'Nothing to analyze yet.',
      'pill.procs': '{n} processes',
      'pill.res': '{n} resources',
      'pill.waiting': '{n} waiting',
      'pill.cycles': '{n} cycle(s)',
      'an.cyclesTitle': 'Cycle detection (circular wait)',
      'an.noCycles': 'There are no cycles in the graph ⇒ no circular wait ⇒ <b>deadlock is impossible</b>.',
      'an.noCyclesWaiting': ' Waiting processes ({list}) will continue once their resources are released.',
      'cycle.waitLine': '<b>{pid}</b> waits for <b>{rid}</b>{inst}, which is allocated to <b>{holder}</b>.',
      'cycle.inst': ' ({n} inst.)',
      'cycle.single': 'Every resource in the cycle has <b>a single instance</b> ⇒ the cycle <b>is a deadlock</b>: nobody can release what the other one needs.',
      'cycle.multi': 'Some resources have several instances, but the detection algorithm confirms that <b>none of these processes can finish</b> ⇒ deadlock.',
      'cycle.possible': 'This is a <b>possible</b> circular wait, but not a definitive one: ',
      'cycle.helpers': '{list} can finish and release an instance that breaks the cycle.',
      'cycle.helper': '{pid} (holds {rid})',
      'cycle.helpersGeneric': 'another process can finish and release instances.',
      'cycle.necessary': ' With multi-instance resources, a cycle is a necessary but not sufficient condition.',
      'pill.deadlock': 'Deadlock',
      'pill.cycleOnly': 'Cycle without deadlock',
      'an.coffman': 'Coffman conditions',
      'an.indirectTitle': 'Indirect blocking',
      'an.indirectText': '{list} is not in the cycle, but waits for resources held by deadlocked processes: it will never progress either.',
      'an.detection': 'Detection algorithm',
      'an.cannot': 'Cannot finish: {list}',
      'an.allFinish': 'All can finish · order: {order}',
      'an.recovery': 'Recovery',
      'rec.abort': 'Abort <b>{pid}</b>',
      'rec.suggested': ' (suggested)',
      'rec.abortMeta': 'loses {held} inst. · {rem} left deadlocked',
      'rec.preempt': 'Preempt <b>{rid}</b> from {pid}',
      'rec.preemptMeta': '{rem} left deadlocked',
      'rec.auto': 'Automatic recovery',
      'rec.autoSub': 'aborts victims until solved',

      'mx.none': 'Shown once there are processes and resources.',
      'mx.alloc': 'Allocation (instances held by each process)',
      'mx.req': 'Request (instances being waited for)',
      'mx.total': 'Total instances',
      'mx.avail': 'Available',

      'step.request': '{p} requests {r}',
      'step.release': '{p} releases {r}',
      'step.terminate': '{p} terminates',
      'lesson.title': 'What happened?',
      'player.count': 'Step {i} of {n}',
      'player.done': '✔ Completed',
      'tag.deadlock': 'DEADLOCK',
      'tag.safe': 'SAFE',

      'toast.auto': 'Automatic recovery: aborted {list}.',
      'toast.imported': 'State imported successfully.',
      'toast.importFail': 'Could not import: {msg}',

      'hint.scenario': '▶ Scenario loaded. Press <b>Step ▶</b> to run it step by step or <b>Run all ⏩</b> to see it complete: arrows appear when processes request resources.',
      'hint.noEdges': 'No arrows yet: pick a process and a resource in <b>3 · Operate</b> and press <b>Request</b>, or load a scenario.',
      'tests.ok': 'All tests passed',
      'tests.fail': '{n} test(s) failed',
      'tests.when': 'Run at: {date}',
      'doc.title': 'Deadlock Hunter · Simón Bolívar University',
    },
  };

  let lang = 'es';
  const listeners = [];

  function t(key, params) {
    let s = (dict[lang] && dict[lang][key]) || dict.es[key] || key;
    if (params) {
      s = s.replace(/\{\{(\w+)\}/g, (m, k) => '{' + (k in params ? params[k] : m)); // "{{rid}" → "{R1"
      s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
    }
    return s;
  }

  function setLang(l) {
    if (!dict[l] || l === lang) return;
    lang = l;
    listeners.forEach(fn => fn(lang));
  }

  /** Aplica las traducciones a los textos fijos del HTML (solo navegador). */
  function applyStatic(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    doc.documentElement.lang = lang;
    doc.title = t('doc.title');
    doc.querySelectorAll('[data-en]').forEach(el => {
      if (el.dataset.es === undefined) el.dataset.es = el.innerHTML;
      el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.es;
    });
    [['enPh', 'esPh', 'placeholder'], ['enTitle', 'esTitle', 'title'], ['enAria', 'esAria', 'aria-label']].forEach(([en, es, attr]) => {
      const sel = '[data-' + en.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ']';
      doc.querySelectorAll(sel).forEach(el => {
        if (el.dataset[es] === undefined) el.dataset[es] = el.getAttribute(attr) || '';
        el.setAttribute(attr, lang === 'en' ? el.dataset[en] : el.dataset[es]);
      });
    });
  }

  return {
    t,
    setLang,
    applyStatic,
    get lang() { return lang; },
    onChange(fn) { listeners.push(fn); },
    dict,
  };
});
