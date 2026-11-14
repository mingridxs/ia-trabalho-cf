// Executa os testes da seção 6 no terminal:  node rodar-testes.js
const ACO = require('./aco.js');
const Testes = require('./testes.js');

const resultados = Testes.executar(ACO);
console.log(Testes.comoTexto(resultados));
process.exit(resultados.every((r) => r.ok) ? 0 : 1);
