// Ejecuta las pruebas desde la terminal:  node tests/run-node.js
const E = require('../js/engine.js');
const S = require('../js/scenarios.js');
const T = require('./cases.js');

const results = T.run(E, S);
for (const r of results) console.log(`${r.pass ? '✔' : '✘'} ${r.name}${r.pass ? '' : '\n    ' + r.error}`);
const ok = results.filter(r => r.pass).length;
console.log(`\n${ok}/${results.length} pruebas superadas`);
process.exit(ok === results.length ? 0 : 1);
