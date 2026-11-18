/**
 * Escenarios predefinidos para el reto de experimentación.
 * Cada paso es [operación, proceso, recurso].
 * expect = estado final esperado del análisis ('deadlock' | 'ok' | 'cycle-no-deadlock').
 * Los textos están en español; `en` contiene la versión en inglés.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeadlockScenarios = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return [
    {
      id: 'deadlock-2',
      title: 'Con bloqueo: interbloqueo clásico',
      short: 'Interbloqueo clásico',
      kind: 'deadlock',
      expect: 'deadlock',
      description: 'P1 y P2 necesitan R1 y R2, pero los piden en orden opuesto. Cada uno toma uno y espera el otro.',
      processes: ['P1', 'P2'],
      resources: [['R1', 1], ['R2', 1]],
      steps: [
        ['request', 'P1', 'R1'],
        ['request', 'P2', 'R2'],
        ['request', 'P1', 'R2'],
        ['request', 'P2', 'R1'],
      ],
      lesson: 'Se cumplen las 4 condiciones de Coffman. P1 retiene R1 y espera R2; P2 retiene R2 y espera R1. ' +
        'Como R1 y R2 tienen una sola instancia, el ciclo P1 → R2 → P2 → R1 → P1 es un interbloqueo: ninguno puede avanzar.',
      en: {
        title: 'With deadlock: classic deadlock',
        short: 'Classic deadlock',
        description: 'P1 and P2 need R1 and R2, but request them in opposite order. Each one takes one and waits for the other.',
        lesson: 'All 4 Coffman conditions hold. P1 holds R1 and waits for R2; P2 holds R2 and waits for R1. ' +
          'Since R1 and R2 have a single instance, the cycle P1 → R2 → P2 → R1 → P1 is a deadlock: neither can progress.',
      },
    },
    {
      id: 'safe-order',
      title: 'Sin bloqueo: orden global de recursos',
      short: 'Orden global de recursos',
      kind: 'safe',
      expect: 'ok',
      description: 'Los mismos procesos y recursos, pero ambos piden siempre R1 antes que R2 (orden total).',
      processes: ['P1', 'P2'],
      resources: [['R1', 1], ['R2', 1]],
      steps: [
        ['request', 'P1', 'R1'],
        ['request', 'P2', 'R1'],
        ['request', 'P1', 'R2'],
        ['release', 'P1', 'R2'],
        ['release', 'P1', 'R1'],
        ['request', 'P2', 'R2'],
        ['release', 'P2', 'R2'],
        ['release', 'P2', 'R1'],
      ],
      lesson: 'P2 también tiene que esperar, pero espera SIN retener nada. Al imponer un orden global (R1 < R2) ' +
        'se rompe la condición de espera circular: quien tiene R1 nunca espera por alguien que pida R1. Hay espera, pero no ciclo.',
      en: {
        title: 'No deadlock: global resource ordering',
        short: 'Global resource ordering',
        description: 'Same processes and resources, but both always request R1 before R2 (total order).',
        lesson: 'P2 also has to wait, but it waits WITHOUT holding anything. Imposing a global order (R1 < R2) ' +
          'breaks the circular-wait condition: whoever holds R1 never waits for someone requesting R1. There is waiting, but no cycle.',
      },
    },
    {
      id: 'cycle-multi',
      title: 'Ciclo sin interbloqueo (multi-instancia)',
      short: 'Ciclo sin interbloqueo (multi-instancia)',
      kind: 'safe',
      expect: 'cycle-no-deadlock',
      description: 'R1 tiene 2 instancias. Se forma un ciclo P1 → R1 → P2 → R2 → P1, pero P3 (fuera del ciclo) también tiene R1.',
      processes: ['P1', 'P2', 'P3'],
      resources: [['R1', 2], ['R2', 1]],
      steps: [
        ['request', 'P2', 'R1'],
        ['request', 'P3', 'R1'],
        ['request', 'P1', 'R2'],
        ['request', 'P1', 'R1'],
        ['request', 'P2', 'R2'],
      ],
      lesson: 'Con recursos de varias instancias, un ciclo es condición NECESARIA pero no SUFICIENTE. P3 no espera nada, ' +
        'puede terminar y liberar su instancia de R1, que se asigna a P1. El algoritmo de detección lo confirma: todos terminan. ' +
        'Prueba "Liberar R1" de P3 para ver cómo el ciclo desaparece.',
      en: {
        title: 'Cycle without deadlock (multi-instance)',
        short: 'Cycle without deadlock (multi-instance)',
        description: 'R1 has 2 instances. A cycle P1 → R1 → P2 → R2 → P1 forms, but P3 (outside the cycle) also holds R1.',
        lesson: 'With multi-instance resources, a cycle is a NECESSARY but not SUFFICIENT condition. P3 waits for nothing, ' +
          'so it can finish and release its instance of R1, which goes to P1. The detection algorithm confirms it: everyone finishes. ' +
          'Try "Release" R1 from P3 to watch the cycle disappear.',
      },
    },
    {
      id: 'deadlock-3',
      title: 'Con bloqueo: cadena circular de 3 procesos',
      short: 'Cadena circular de 3 procesos',
      kind: 'deadlock',
      expect: 'deadlock',
      description: 'Tres procesos en "mesa redonda": cada uno toma su recurso y pide el del vecino.',
      processes: ['P1', 'P2', 'P3'],
      resources: [['R1', 1], ['R2', 1], ['R3', 1]],
      steps: [
        ['request', 'P1', 'R1'],
        ['request', 'P2', 'R2'],
        ['request', 'P3', 'R3'],
        ['request', 'P1', 'R2'],
        ['request', 'P2', 'R3'],
        ['request', 'P3', 'R1'],
      ],
      lesson: 'La espera circular puede involucrar cualquier número de procesos. Abortar uno solo (la víctima) basta para romper el ciclo.',
      en: {
        title: 'With deadlock: circular chain of 3 processes',
        short: 'Circular chain of 3 processes',
        description: 'Three processes at a "round table": each takes its own resource and asks for its neighbor\'s.',
        lesson: 'Circular wait can involve any number of processes. Aborting just one (the victim) is enough to break the cycle.',
      },
    },
    {
      id: 'deadlock-indirect',
      title: 'Con bloqueo: proceso afectado indirectamente',
      short: 'Proceso afectado indirectamente',
      kind: 'deadlock',
      expect: 'deadlock',
      description: 'P1 y P2 forman un interbloqueo; P3 no está en el ciclo, pero espera R1, que nunca se liberará.',
      processes: ['P1', 'P2', 'P3'],
      resources: [['R1', 1], ['R2', 1]],
      steps: [
        ['request', 'P1', 'R1'],
        ['request', 'P2', 'R2'],
        ['request', 'P1', 'R2'],
        ['request', 'P2', 'R1'],
        ['request', 'P3', 'R1'],
      ],
      lesson: 'Un interbloqueo propaga sus efectos: P3 queda bloqueado para siempre aunque no forma parte del ciclo. ' +
        'El algoritmo de detección lo marca como no finalizable; la herramienta lo clasifica como "bloqueado indirectamente".',
      en: {
        title: 'With deadlock: indirectly affected process',
        short: 'Indirectly affected process',
        description: 'P1 and P2 form a deadlock; P3 is not in the cycle, but waits for R1, which will never be released.',
        lesson: 'A deadlock spreads its effects: P3 stays blocked forever even though it is not part of the cycle. ' +
          'The detection algorithm marks it as unable to finish; the tool classifies it as "indirectly blocked".',
      },
    },
  ];
});
