# Proyecto 3 · Deadlock Hunter: detector de bloqueos

**Universidad Simón Bolívar · Sede Cúcuta**
Programa de Ingeniería de Sistemas · Sistemas Operativos — Concurrencia y bloqueos

**Software elaborado por:** Brayan Casanova y Deivy Florez, estudiantes de 6.º semestre de Ingeniería de Sistemas.

Sitio web con un simulador gráfico de procesos que solicitan y retienen recursos. Dibuja el **grafo de asignación de recursos (RAG)**, detecta **ciclos** (espera circular), confirma si hay un **interbloqueo real** mediante el algoritmo de detección y permite **recuperarse** abortando un proceso o expropiando un recurso.

---

## 1. Cómo ejecutarlo

No requiere instalación ni dependencias (HTML + CSS + JavaScript puro).

- **Opción A:** abrir `index.html` con doble clic en Chrome, Edge o Firefox.
- **Opción B (servidor local):** desde la carpeta del proyecto:
  ```bash
  python -m http.server 8000
  ```
  y abrir `http://localhost:8000`.

Pruebas automatizadas: abrir `tests/index.html` en el navegador, o con Node.js instalado: `node tests/run-node.js`.

## 2. Estructura

```
deadlock-hunter/
├── index.html          Sitio web: inicio, simulador, teoría, experimento, pruebas y equipo
├── assets/             Logo de la Universidad Simón Bolívar y favicon
├── css/styles.css      Estilos con la paleta institucional (verde Unisimón), responsive
├── js/i18n.js          Traducciones español / inglés (botón ES | EN del menú)
├── js/engine.js        Motor: modelo, operaciones, detección y recuperación (sin DOM)
├── js/scenarios.js     Escenarios del reto de experimentación
├── js/app.js           Dibujo del grafo SVG y conexión con los controles
├── js/site.js          Vistas por sección, ventanas emergentes, idioma y pruebas en vivo
└── tests/
    ├── cases.js        22 casos de prueba
    ├── index.html      Ejecutor de pruebas en el navegador
    └── run-node.js     Ejecutor de pruebas en terminal
```

El motor está separado de la interfaz, así que la lógica se puede probar sola.

## 3. Especificaciones funcionales y dónde se cumplen

| Especificación | Implementación |
|---|---|
| Representar procesos y recursos en un grafo de asignación | Procesos = círculos; recursos = rectángulos con un punto por instancia (● asignada, ○ libre). Arista **R → P** continua = asignación; arista **P → R** punteada = solicitud en espera. Los nodos se pueden arrastrar. |
| Solicitar y liberar recursos | Panel *3 · Operar*: **Solicitar**, **Liberar**, **Finalizar proceso**. Si no hay instancias libres, el proceso queda bloqueado en una cola FIFO; al liberar, el recurso pasa automáticamente al primero de la cola. |
| Detectar ciclos y explicar la posible espera circular | Panel *Análisis*: lista cada ciclo (`P1 → R2 → P2 → R1 → P1`), explica quién espera a quién, indica si es interbloqueo o solo un ciclo, muestra las 4 condiciones de Coffman y la traza del algoritmo de detección. Las aristas del ciclo se pintan de rojo (interbloqueo) o ámbar (ciclo sin interbloqueo). |
| Simular recuperación (liberar recursos o finalizar un proceso) | Sección *Recuperación*: abortar cualquier proceso del ciclo, expropiar un recurso, o **Recuperación automática**. Cada opción indica cuántos procesos quedarían interbloqueados y la herramienta sugiere la víctima de menor costo. |

**Idiomas:** toda la página (incluidos el análisis, el registro de eventos y las pruebas) se puede ver en **español o inglés** con el selector **ES | EN** del menú. La elección se recuerda en el navegador.

Además: matrices de **Asignación / Solicitud / Total / Disponible**, registro de eventos numerado, y exportación/importación del estado en JSON como evidencia.

## 4. Modelo y algoritmos

### 4.1 Reglas de la simulación
- Cada solicitud pide **una** instancia. Para pedir varias se repite la solicitud.
- Si hay instancias libres se asignan al momento; si no, el proceso queda **bloqueado** y no puede hacer más solicitudes hasta que lo atiendan.
- Un proceso no puede pedir más instancias de las que existen.
- Al liberar (o al finalizar un proceso) se atiende la cola de espera del recurso en orden FIFO.

### 4.2 Detección de ciclos
Se construye el **grafo de espera** (P → Q si P espera un recurso que Q retiene) y se buscan sus ciclos simples con DFS. Cada ciclo se reporta una sola vez y luego se expande a la forma del RAG (P → R → P' …).

### 4.3 ¿Ciclo = interbloqueo?
- Si **todos los recursos del ciclo tienen 1 instancia**, el ciclo **es** un interbloqueo.
- Si hay recursos con **varias instancias**, el ciclo es condición **necesaria pero no suficiente**. Para decidir se usa el **algoritmo de detección**:

```
Work ← Disponible ;  Finish[i] ← false para todo i
repetir
   buscar Pi con Finish[i] = false  y  Solicitud_i ≤ Work
   Work ← Work + Asignación_i ;  Finish[i] ← true
hasta que no se encuentre ninguno
Los Pi con Finish[i] = false están interbloqueados.
```

Los procesos que no pueden terminar y pertenecen a un ciclo se marcan **interbloqueados**; los que no pueden terminar pero están fuera del ciclo se marcan **bloqueo indirecto** (esperan a un proceso interbloqueado).

**Caso de prueba verificable a mano** (escenario *Ciclo sin interbloqueo*, R1 = 2 instancias, R2 = 1):

| Paso | Proceso | Solicitud | ¿≤ Work? | Devuelve | Work resultante |
|---|---|---|---|---|---|
| inicio | — | — | — | — | {R1:0, R2:0} |
| 1 | P3 | ∅ | sí | {R1:1} | {R1:1, R2:0} |
| 2 | P1 | {R1:1} | sí | {R2:1} | {R1:1, R2:1} |
| 3 | P2 | {R2:1} | sí | {R1:1} | {R1:2, R2:1} |

Todos terminan ⇒ hay ciclo (P1 → R1 → P2 → R2 → P1) pero **no** interbloqueo. Esta misma traza aparece en la aplicación y la verifica la prueba T09.

### 4.4 Recuperación
Para cada proceso interbloqueado se simula (sobre una copia del sistema) qué pasaría si se aborta, y para cada recurso del ciclo qué pasaría si se expropia. Se elige la **víctima** que:
1. deja menos procesos interbloqueados;
2. a igualdad, retiene menos instancias (menos trabajo perdido);
3. a igualdad, por orden alfabético (para que el resultado sea reproducible).

La *recuperación automática* repite esto hasta que no queda interbloqueo.

## 5. Reto de experimentación: con bloqueo vs. sin bloqueo

En el panel *1 · Escenarios* se cargan; se ejecutan paso a paso (**Paso ▶**) o completos (**Ejecutar todo ⏩**) desde la barra que aparece encima del grafo. Al terminar se muestra la explicación.

| | Con bloqueo: *interbloqueo clásico* | Sin bloqueo: *orden global de recursos* |
|---|---|---|
| Recursos | R1 (1), R2 (1) | R1 (1), R2 (1) |
| Pasos | P1 pide R1 · P2 pide R2 · P1 pide R2 · P2 pide R1 | P1 pide R1 · P2 pide R1 (espera) · P1 pide R2 · P1 libera R2 y R1 · P2 recibe R1, pide R2, libera todo |
| Orden de petición | P1: R1→R2, P2: R2→R1 (opuesto) | ambos R1→R2 (mismo orden) |
| ¿Retención y espera? | Sí: cada uno retiene uno y espera el otro | P2 espera **sin retener nada** |
| ¿Espera circular? | Sí: P1 → R2 → P2 → R1 → P1 | No: nunca se forma un ciclo |
| Resultado | **Interbloqueo**: ninguno avanza | Todos terminan |

**Diferencia clave:** los dos escenarios usan los mismos procesos y recursos, solo cambia el **orden** en que se piden. Con un orden global (R1 antes que R2) un proceso que tiene R1 nunca espera por alguien que pida R1, así que **no puede cerrarse el ciclo**: se rompe la condición de *espera circular* de Coffman. Esperar no es lo mismo que estar interbloqueado.

Escenarios adicionales:
- **Ciclo sin interbloqueo (multi-instancia):** muestra que un ciclo no siempre es interbloqueo.
- **Cadena circular de 3 procesos:** espera circular con más de dos procesos; basta abortar una víctima.
- **Proceso afectado indirectamente:** P3 queda bloqueado para siempre sin estar en el ciclo.

## 6. Evidencia de pruebas

`tests/index.html` ejecuta **22 pruebas** (17 unitarias del motor y 5 que comprueban el estado final de cada escenario). Resultado obtenido: **22/22 pruebas superadas**.

| ID | Qué verifica |
|---|---|
| T01–T02 | Asignación inmediata y bloqueo cuando no hay instancias (sin ciclo ≠ interbloqueo) |
| T03–T04 | Interbloqueo de 2 procesos, ruta del ciclo y condiciones de Coffman |
| T05, T16 | Cola FIFO al liberar y al finalizar procesos |
| T06–T07 | Validaciones (proceso bloqueado, liberar sin retener, nombres, instancias) |
| T08–T10 | Ciclo multi-instancia sin interbloqueo, traza de *Work* y ruptura del ciclo |
| T11–T12 | Ciclo de 3 procesos y bloqueo indirecto |
| T13–T15 | Recuperación por víctima, por expropiación y automática |
| T17 | Exportar/importar conserva el estado |
| E-* | Cada escenario termina en el estado esperado; el escenario seguro nunca forma ciclos |

Pruebas manuales recomendadas para la sustentación:
1. Cargar *interbloqueo clásico* → **Ejecutar todo** → el banner se pone rojo y se ve el ciclo resaltado.
2. Pulsar **Abortar P1 (sugerido)** → P2 recibe R1 y el registro muestra “El sistema salió del interbloqueo”.
3. Cargar *Ciclo sin interbloqueo* → **Ejecutar todo** → banner ámbar; luego seleccionar P3 y R1 y pulsar **Liberar** → el ciclo desaparece.
4. **Exportar evidencia** para guardar el JSON con el estado, el análisis y el registro.

## 7. Limitaciones conocidas

- Cada solicitud pide **una** instancia y un proceso bloqueado espera **un solo** recurso a la vez (modelo de solicitud única). No se modelan solicitudes simultáneas de varios recursos.
- La simulación es **por eventos**, no en tiempo real: no hay hilos reales, ni tiempos de CPU, ni planificador.
- Solo se hace **detección y recuperación**; no se implementan prevención ni evitación (algoritmo del banquero con demandas máximas).
- La **expropiación** solo libera el recurso; no simula el *rollback* del proceso afectado, que sigue como si nada.
- El costo de la víctima es heurístico (procesos que siguen interbloqueados e instancias retenidas); no considera prioridad ni tiempo ejecutado.
- La enumeración de ciclos se limita a 100 ciclos y a un máximo de 9 instancias por recurso; está pensada para grafos didácticos pequeños.
- La distribución automática del grafo puede cruzar aristas en grafos grandes; los nodos se pueden arrastrar, pero al agregar un nodo se redistribuyen todos.
