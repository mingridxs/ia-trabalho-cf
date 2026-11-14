/*
 * Testes de validação da seção 6 do enunciado.
 * Usados pela página (botão "Executar testes") e pelo Node (node rodar-testes.js).
 * Resultados decimais comparados com tolerância absoluta de 0,000001.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TestesACO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function executar(A) {
    const { fmt } = A;
    const TOL = 1e-6;
    const perto = (a, b) => Math.abs(a - b) <= TOL;
    const V = [
      { id: 'A', x: 0, y: 0 }, { id: 'B', x: 3, y: 0 }, { id: 'C', x: 3, y: 4 }, { id: 'D', x: 0, y: 4 },
    ];
    const D = A.distancias(V);
    const idx = (s) => s.split('').map((c) => 'ABCD'.indexOf(c));
    const nome = (rota) => A.nomeRota(rota, V);
    const base = {
      vertices: V, deposito: 0, formigas: 10, iteracoes: 30, alfa: 1, beta: 2,
      rho: 0.5, tau0: 1, Q: 14, semente: 42, maxEventos: 1000,
    };
    const resultados = [];

    function teste(titulo, corpo) {
      const linhas = [];
      let ok = true;
      const conferir = (cond, texto) => {
        if (!cond) ok = false;
        linhas.push(`${cond ? '[ok]' : '[FALHOU]'} ${texto}`);
      };
      const nota = (texto) => linhas.push(texto);
      corpo(conferir, nota);
      resultados.push({ titulo, ok, linhas });
    }

    const tauUniforme = (valor) => {
      const t = [];
      for (let i = 0; i < 4; i++) {
        t.push(new Array(4).fill(valor));
        t[i][i] = 0;
      }
      return t;
    };
    const perimetro = [[0, 1], [1, 2], [2, 3], [0, 3]];
    const diagonais = [[0, 2], [1, 3]];
    const descTau = (tau) =>
      `AB = ${fmt(tau[0][1])}; BC = ${fmt(tau[1][2])}; CD = ${fmt(tau[2][3])}; AD = ${fmt(tau[0][3])}; AC = ${fmt(tau[0][2])}; BD = ${fmt(tau[1][3])}`;
    const tauConfere = (tau, p, d) =>
      perimetro.every(([i, j]) => perto(tau[i][j], p) && perto(tau[j][i], p)) &&
      diagonais.every(([i, j]) => perto(tau[i][j], d) && perto(tau[j][i], d)) &&
      [0, 1, 2, 3].every((i) => tau[i][i] === 0);

    /* 6.1 */
    teste('6.1 Instância de referência e cálculo das rotas', (conferir, nota) => {
      nota(`Distâncias: A-B = ${fmt(D[0][1])}; A-C = ${fmt(D[0][2])}; A-D = ${fmt(D[0][3])}; B-C = ${fmt(D[1][2])}; B-D = ${fmt(D[1][3])}; C-D = ${fmt(D[2][3])}`);
      conferir(
        perto(D[0][1], 3) && perto(D[0][2], 5) && perto(D[0][3], 4) && perto(D[1][2], 4) && perto(D[1][3], 5) && perto(D[2][3], 3),
        'A-B = 3, A-C = 5, A-D = 4, B-C = 4, B-D = 5, C-D = 3'
      );
      let simetrica = true;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (D[i][j] !== D[j][i] || (i === j && D[i][j] !== 0)) simetrica = false;
      conferir(simetrica, 'distâncias inversas iguais e d(i, i) = 0');
      const rotas = [['ABCDA', 14], ['ABDCA', 16], ['ACBDA', 18], ['ACDBA', 16], ['ADBCA', 18], ['ADCBA', 14]];
      rotas.forEach(([s, esperado]) => {
        const r = idx(s);
        const L = A.comprimento(r, D);
        nota(`${nome(r)}: ${fmt(L)}`);
        conferir(A.rotaValida(r, 4, 0) && perto(L, esperado), `${nome(r)} é válida e mede ${esperado}`);
      });
      conferir(
        !A.rotaValida(idx('ABCA'), 4, 0) && !A.rotaValida(idx('ABBDA'), 4, 0) && !A.rotaValida(idx('ABCDB'), 4, 0) && !A.rotaValida(idx('BCDAB'), 4, 0),
        'rota incompleta, com vértice repetido, sem retorno ao depósito ou que não parte do depósito é inválida'
      );
    });

    /* 6.2 */
    teste('6.2 Probabilidades de escolha', (conferir, nota) => {
      const tau = tauUniforme(1);
      const p1 = A.probabilidades(0, [1, 2, 3], tau, D, 1, 2);
      nota('Em A (τ = 1, α = 1, β = 2): ' + p1.map((c) => `w(A,${V[c.v].id}) = ${fmt(c.w)}, p = ${fmt(c.p)}`).join('; '));
      conferir(perto(p1[0].w, 1 / 9) && perto(p1[1].w, 1 / 25) && perto(p1[2].w, 1 / 16), 'pesos w(A,B) = 1/9, w(A,C) = 1/25, w(A,D) = 1/16');
      conferir(perto(p1[0].p, 400 / 769) && perto(p1[1].p, 144 / 769) && perto(p1[2].p, 225 / 769),
        'p(A,B) = 400/769 ≈ 0,520156; p(A,C) = 144/769 ≈ 0,187256; p(A,D) = 225/769 ≈ 0,292588');
      conferir(perto(p1.reduce((s, c) => s + c.p, 0), 1), 'a soma das probabilidades é 1');

      // O sorteio é proporcional: nenhum candidato é excluído por não ter o maior peso.
      const rng = A.criarRng(123);
      const cont = [0, 0, 0];
      const N = 100000;
      for (let i = 0; i < N; i++) cont[A.sortear(p1, rng())]++;
      nota(`Frequências em ${N.toLocaleString('pt-BR')} sorteios: B = ${fmt(cont[0] / N, 4)}; C = ${fmt(cont[1] / N, 4)}; D = ${fmt(cont[2] / N, 4)}`);
      conferir(cont.every((c, i) => c > 0 && Math.abs(c / N - p1[i].p) < 0.01),
        'os três candidatos são escolhidos, com frequências próximas das probabilidades (diferença < 0,01)');

      const p2 = A.probabilidades(1, [2, 3], tau, D, 1, 2);
      nota('Após visitar B: ' + p2.map((c) => `p(B,${V[c.v].id}) = ${fmt(c.p)}`).join('; '));
      conferir(p2.length === 2 && perto(p2[0].p, 25 / 41) && perto(p2[1].p, 16 / 41),
        'p(B,C) = 25/41 ≈ 0,609756 e p(B,D) = 16/41 ≈ 0,390244; A e B não participam');
      const construida = A.construirRota(0, 4, tau, D, 1, 2, A.criarRng(5));
      conferir(
        construida.passos[1].candidatos.every((c) => c.v !== 0 && c.v !== construida.passos[0].escolhido),
        'na construção real da rota, o depósito e o vértice já visitado ficam fora do segundo sorteio'
      );

      const tauVar = tauUniforme(1);
      tauVar[0][1] = tauVar[1][0] = 7;
      tauVar[0][2] = tauVar[2][0] = 0.2;
      const p3 = A.probabilidades(0, [1, 2, 3], tauVar, D, 0, 0);
      nota('α = 0 e β = 0, com feromônios diferentes (7; 0,2; 1): ' + p3.map((c) => `p(A,${V[c.v].id}) = ${fmt(c.p)}`).join('; '));
      conferir(p3.every((c) => perto(c.p, 1 / 3)), 'probabilidades iguais (1/3), independentemente de distâncias e feromônios');
      const p4 = A.probabilidades(2, [3], tauVar, D, 1, 2);
      conferir(p4.length === 1 && perto(p4[0].p, 1), 'com um único candidato, a probabilidade é 1');
    });

    /* 6.3 */
    teste('6.3 Evaporação e depósito', (conferir, nota) => {
      const cfg = Object.assign({}, base, { formigas: 1, iteracoes: 5 });
      const rota = idx('ABCDA');
      const e = A.criarEstado(cfg);
      const ev1 = A.passo(e, [rota]);
      nota(`τ₀ = 1, ρ = 50%, Q = 14, uma formiga, rota forçada ${nome(rota)} (L = ${fmt(ev1.formigas[0].L)})`);
      conferir(ev1.arestas.every((a) => perto(a.evaporado, 0.5)), 'após a evaporação, as seis arestas têm feromônio 0,5');
      const ab = ev1.arestas.find((a) => a.i === 0 && a.j === 1);
      const ac = ev1.arestas.find((a) => a.i === 0 && a.j === 2);
      const ad = ev1.arestas.find((a) => a.i === 0 && a.j === 3);
      const log = (a) => `anterior ${fmt(a.anterior)}; após evaporação ${fmt(a.evaporado)}; depósito ${fmt(a.deposito)}; final ${fmt(a.final)}`;
      nota(`Log de AB: ${log(ab)}`);
      nota(`Log de AC: ${log(ac)}`);
      conferir(perto(ab.anterior, 1) && perto(ab.evaporado, 0.5) && perto(ab.deposito, 1) && perto(ab.final, 1.5), 'AB: anterior 1; após evaporação 0,5; depósito 1; final 1,5');
      conferir(perto(ac.anterior, 1) && perto(ac.evaporado, 0.5) && perto(ac.deposito, 0) && perto(ac.final, 0.5), 'AC: anterior 1; após evaporação 0,5; depósito 0; final 0,5');
      conferir(perto(ad.deposito, 1), 'a aresta de retorno D → A também recebe o depósito Q/L = 1');
      nota(`1ª iteração: ${descTau(e.tau)}`);
      conferir(tauConfere(e.tau, 1.5, 0.5), 'AB = BC = CD = AD = 1,5 e AC = BD = 0,5; matriz simétrica e diagonal sem feromônio');

      A.passo(e, [rota]);
      nota(`2ª iteração (mesma rota): ${descTau(e.tau)}`);
      conferir(tauConfere(e.tau, 1.75, 0.25), 'perímetro 1,75 e diagonais 0,25');

      const e2 = A.criarEstado(Object.assign({}, cfg, { formigas: 2 }));
      A.passo(e2, [rota, rota]);
      nota(`Reinício com duas formigas na mesma rota, uma iteração: ${descTau(e2.tau)}`);
      conferir(tauConfere(e2.tau, 2.5, 0.5), 'perímetro 2,5 e diagonais 0,5 (depósitos somados, sem atualização durante a construção)');

      const e3 = A.criarEstado(Object.assign({}, cfg, { rho: 0 }));
      const ev3 = A.passo(e3, [rota]);
      nota(`ρ = 0%: ${descTau(e3.tau)}`);
      conferir(ev3.arestas.every((a) => a.evaporado === a.anterior) && tauConfere(e3.tau, 2, 1),
        'com ρ = 0%, a evaporação não reduz o feromônio: perímetro 1 + 1 = 2 e diagonais 1');
    });

    /* 6.4 */
    teste('6.4 Execução completa e reprodutibilidade', (conferir, nota) => {
      const e0 = A.criarEstado(base);
      conferir(e0.iteracao === 0 && e0.melhorGlobal === null && e0.historico.length === 0 && tauConfere(e0.tau, 1, 1),
        'estado inicial (iteração 0): τ = 1 em todas as arestas, sem rota e melhor distância "ainda não calculada"');
      const e = A.executarTudo(base);
      const h = e.historico;
      nota('Parâmetros: 10 formigas; 30 iterações; α = 1; β = 2; ρ = 50%; τ₀ = 1; Q = 14; semente 42; depósito A');
      nota(`Melhor rota: ${nome(e.melhorGlobal.rota)}; comprimento ${fmt(e.melhorGlobal.L)}; encontrada na iteração ${e.melhorGlobal.iteracao}`);
      nota(`Iteração 1: menor ${fmt(h[0].melhor)}, média ${fmt(h[0].media)}; iteração 30: menor ${fmt(h[29].melhor)}, média ${fmt(h[29].media)}`);
      nota(`Feromônio final: ${descTau(e.tau)}`);
      conferir(h.length === 30, `histórico com ${h.length} registros, um por iteração concluída`);
      conferir(A.rotaValida(e.melhorGlobal.rota, 4, 0) && perto(A.comprimento(e.melhorGlobal.rota, D), e.melhorGlobal.L),
        'a melhor rota é válida e o comprimento informado confere com a soma das arestas');
      let todas = true;
      let quantas = 0;
      e.eventos.forEach((ev) => ev.formigas.forEach((f) => {
        quantas++;
        if (!A.rotaValida(f.rota, 4, 0) || ![14, 16, 18].some((x) => perto(f.L, x))) todas = false;
      }));
      conferir(todas, `as ${quantas} rotas construídas são válidas e medem 14, 16 ou 18`);
      conferir(h.every((r, i) => i === 0 || r.acumulado <= h[i - 1].acumulado), 'a melhor distância acumulada nunca aumenta');
      const e2 = A.executarTudo(base);
      conferir(JSON.stringify(e2.historico) === JSON.stringify(h) && JSON.stringify(e2.tau) === JSON.stringify(e.tau),
        'repetir dados, parâmetros e semente reproduz o mesmo histórico e os mesmos feromônios');
      // Avançar uma iteração por vez (como pausar e retomar) equivale à execução direta.
      const e3 = A.criarEstado(base);
      for (let i = 0; i < 30; i++) A.passo(e3);
      conferir(JSON.stringify(e3.historico) === JSON.stringify(h), 'avançar iteração por iteração produz o mesmo histórico da execução contínua');
    });

    /* 6.5 */
    teste('6.5 Efeito dos parâmetros e entradas inválidas', (conferir, nota) => {
      nota('Comparação de β (demais parâmetros da seção 6.4; sementes 1 a 5):');
      [0, 2].forEach((beta) => {
        const finais = [];
        const det = [];
        [1, 2, 3, 4, 5].forEach((semente) => {
          const e = A.executarTudo(Object.assign({}, base, { beta, semente }));
          finais.push(e.melhorGlobal.L);
          const medias = e.historico.reduce((s, r) => s + r.media, 0) / e.historico.length;
          det.push(`semente ${semente}: melhor ${fmt(e.melhorGlobal.L)} (iteração ${e.melhorGlobal.iteracao}); média das distâncias ao longo das 30 iterações ${fmt(medias, 3)}; média na iteração 30: ${fmt(e.historico[29].media, 3)}`);
        });
        const media = finais.reduce((s, x) => s + x, 0) / finais.length;
        nota(`β = ${beta}: média da melhor distância final = ${fmt(media)}; execuções que atingiram 14: ${finais.filter((x) => perto(x, 14)).length} de 5`);
        det.forEach((d) => nota('  ' + d));
      });

      const bruto = (mud) => Object.assign({
        vertices: V.map((v) => ({ id: v.id, x: String(v.x), y: String(v.y) })),
        deposito: '0', formigas: '10', iteracoes: '30', alfa: '1', beta: '2', rho: '50', tau0: '1', Q: '14', semente: '42',
      }, mud);
      conferir(A.validarConfig(bruto({})).erros.length === 0, 'a configuração de referência é aceita');
      const casos = [
        ['coordenadas duplicadas', { vertices: [{ id: 'A', x: '0', y: '0' }, { id: 'B', x: '3', y: '0' }, { id: 'C', x: '3', y: '4' }, { id: 'D', x: '3', y: '4' }] }],
        ['identificadores repetidos', { vertices: [{ id: 'A', x: '0', y: '0' }, { id: 'B', x: '3', y: '0' }, { id: 'C', x: '3', y: '4' }, { id: 'A', x: '0', y: '4' }] }],
        ['menos de quatro vértices', { vertices: [{ id: 'A', x: '0', y: '0' }, { id: 'B', x: '3', y: '0' }, { id: 'C', x: '3', y: '4' }] }],
        ['coordenada vazia', { vertices: [{ id: 'A', x: '', y: '0' }, { id: 'B', x: '3', y: '0' }, { id: 'C', x: '3', y: '4' }, { id: 'D', x: '0', y: '4' }] }],
        ['coordenada fora do intervalo', { vertices: [{ id: 'A', x: '1000.5', y: '0' }, { id: 'B', x: '3', y: '0' }, { id: 'C', x: '3', y: '4' }, { id: 'D', x: '0', y: '4' }] }],
        ['número de formigas vazio', { formigas: '' }],
        ['0 formigas', { formigas: '0' }],
        ['101 formigas', { formigas: '101' }],
        ['201 iterações', { iteracoes: '201' }],
        ['α = 5,1', { alfa: '5,1' }],
        ['β = −1', { beta: '-1' }],
        ['ρ = 91%', { rho: '91' }],
        ['τ₀ = 0', { tau0: '0' }],
        ['Q = 10.001', { Q: '10001' }],
        ['semente não inteira', { semente: '4.2' }],
      ];
      let todos = true;
      casos.forEach(([rot, mud]) => {
        const r = A.validarConfig(bruto(mud));
        if (!r.erros.length) todos = false;
        nota(`${rot} → ${r.erros.length ? 'bloqueado: ' + r.erros[0].msg : 'ACEITO'}`);
      });
      conferir(todos, 'coordenadas duplicadas, identificadores repetidos, menos de quatro vértices, campos vazios e valores fora dos intervalos impedem a execução, com mensagem');
    });

    return resultados;
  }

  function comoTexto(resultados) {
    return resultados
      .map((r) => `${r.titulo} — ${r.ok ? 'APROVADO' : 'REPROVADO'}\n${r.linhas.join('\n')}`)
      .join('\n\n');
  }

  return { executar, comoTexto };
});
