/*
 * Otimização por colônia de formigas, variante Ant System (sem dependências).
 * Funciona no navegador (window.ACO) e no Node (require), para que os testes
 * exercitem exatamente as funções usadas pela interface.
 *
 * Convenções:
 *  - vértices identificados pelo índice na lista; rota = [depósito, ..., depósito];
 *  - dist[i][j]: distância euclidiana (custo fixo); tau[i][j]: feromônio (atualizado);
 *  - as matrizes são simétricas e a diagonal não recebe feromônio.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ACO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PISO = 1e-12; // proteção numérica do feromônio
  const LIMITES = {
    vertices: [4, 12], coord: [0, 1000], formigas: [1, 100], iteracoes: [1, 200],
    alfa: [0, 5], beta: [0, 5], rho: [0, 90], tau0: [0.01, 100], Q: [0.01, 10000],
  };

  /* ---------- Gerador pseudoaleatório com semente (mulberry32) ---------- */
  function criarRng(semente) {
    let a = semente >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1)
    };
  }

  /* ---------- Distâncias e rotas ---------- */
  function distancias(vertices) {
    const n = vertices.length;
    const d = [];
    for (let i = 0; i < n; i++) {
      d.push(new Array(n).fill(0));
      for (let j = 0; j < n; j++) {
        if (i !== j) d[i][j] = Math.sqrt((vertices[i].x - vertices[j].x) ** 2 + (vertices[i].y - vertices[j].y) ** 2);
      }
    }
    return d;
  }

  // Soma de todas as arestas percorridas, incluindo o retorno ao depósito.
  function comprimento(rota, dist) {
    let L = 0;
    for (let k = 0; k + 1 < rota.length; k++) L += dist[rota[k]][rota[k + 1]];
    return L;
  }

  // Válida: começa e termina no depósito e visita cada outro vértice exatamente uma vez.
  function rotaValida(rota, n, deposito) {
    if (!Array.isArray(rota) || rota.length !== n + 1) return false;
    if (rota[0] !== deposito || rota[n] !== deposito) return false;
    const visto = new Set();
    for (let k = 0; k < n; k++) {
      const v = rota[k];
      if (!Number.isInteger(v) || v < 0 || v >= n || visto.has(v)) return false;
      visto.add(v);
    }
    return true;
  }

  /* ---------- Regra de escolha ----------
   * w(i,j) = tau(i,j)^alfa × (1/d(i,j))^beta, apenas para candidatos não visitados;
   * p(i,j) = w(i,j) / soma dos pesos dos candidatos.
   */
  function probabilidades(atual, candidatos, tau, dist, alfa, beta) {
    const itens = candidatos.map((v) => {
      const w = Math.pow(tau[atual][v], alfa) * Math.pow(1 / dist[atual][v], beta);
      return { v, tau: tau[atual][v], d: dist[atual][v], w };
    });
    const soma = itens.reduce((s, x) => s + x.w, 0);
    const degenerado = !(soma > 0) || !Number.isFinite(soma); // pesos numericamente nulos
    itens.forEach((x) => (x.p = degenerado ? 1 / itens.length : x.w / soma));
    return itens;
  }

  // Sorteio proporcional (roleta): r em [0, 1). Não escolhe sempre o maior peso.
  function sortear(probs, r) {
    let acumulado = 0;
    for (let k = 0; k < probs.length; k++) {
      acumulado += probs[k].p;
      if (r < acumulado) return k;
    }
    return probs.length - 1; // proteção contra arredondamento
  }

  // Uma formiga constrói uma rota completa a partir do depósito, lendo tau sem alterá-lo.
  function construirRota(deposito, n, tau, dist, alfa, beta, rng) {
    const rota = [deposito];
    const visitado = new Array(n).fill(false);
    visitado[deposito] = true;
    const passos = [];
    let atual = deposito;
    for (let etapa = 1; etapa < n; etapa++) {
      const candidatos = [];
      for (let v = 0; v < n; v++) if (!visitado[v]) candidatos.push(v);
      const probs = probabilidades(atual, candidatos, tau, dist, alfa, beta);
      let r = null;
      let k = 0;
      if (probs.length > 1) {
        r = rng();
        k = sortear(probs, r);
      }
      const escolhido = probs[k].v;
      passos.push({ atual, candidatos: probs, sorteio: r, escolhido });
      visitado[escolhido] = true;
      rota.push(escolhido);
      atual = escolhido;
    }
    rota.push(deposito); // retorno obrigatório
    return { rota, passos };
  }

  /* ---------- Evaporação e depósito ----------
   * tau_novo(i,j) = (1 − rho) × tau_antigo(i,j) + soma de Q/Lk das formigas que
   * percorreram a aresta (inclusive a de retorno). Aplicado somente depois que
   * todas as formigas da iteração completaram as rotas.
   */
  function atualizarFeromonio(tau, rotas, comprimentos, rho, Q) {
    const n = tau.length;
    const deposito = [];
    for (let i = 0; i < n; i++) deposito.push(new Array(n).fill(0));
    rotas.forEach((rota, k) => {
      const delta = Q / comprimentos[k];
      for (let p = 0; p + 1 < rota.length; p++) {
        const i = Math.min(rota[p], rota[p + 1]);
        const j = Math.max(rota[p], rota[p + 1]);
        deposito[i][j] += delta; // uma vez por formiga e por aresta (grafo não direcionado)
      }
    });
    const nova = [];
    for (let i = 0; i < n; i++) nova.push(new Array(n).fill(0));
    const arestas = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const anterior = tau[i][j];
        const evaporado = (1 - rho) * anterior;
        const final = Math.max(evaporado + deposito[i][j], PISO);
        nova[i][j] = final;
        nova[j][i] = final; // simetria
        arestas.push({ i, j, anterior, evaporado, deposito: deposito[i][j], final });
      }
    }
    return { tau: nova, arestas };
  }

  /* ---------- Execução ----------
   * config: { vertices:[{id,x,y}], deposito, formigas, iteracoes, alfa, beta,
   *           rho (fração 0..0,9), tau0, Q, semente, maxEventos? }
   */
  function criarEstado(config) {
    const n = config.vertices.length;
    const tau = [];
    for (let i = 0; i < n; i++) {
      tau.push(new Array(n).fill(config.tau0));
      tau[i][i] = 0; // sem feromônio na diagonal
    }
    return {
      config,
      rng: criarRng(config.semente),
      n,
      dist: distancias(config.vertices),
      tau,
      iteracao: 0,
      historico: [],
      eventos: [],
      melhorGlobal: null, // ainda não calculada
    };
  }

  const terminou = (estado) => estado.iteracao >= estado.config.iteracoes;

  // Completa exatamente uma iteração. `rotasForcadas` serve apenas aos testes controlados.
  function passo(estado, rotasForcadas) {
    if (terminou(estado)) return null;
    const c = estado.config;
    const formigas = [];
    const total = rotasForcadas ? rotasForcadas.length : c.formigas;
    for (let k = 0; k < total; k++) {
      // Todas as formigas usam o feromônio do fim da iteração anterior (estado.tau não muda aqui).
      const r = rotasForcadas
        ? { rota: rotasForcadas[k].slice(), passos: null }
        : construirRota(c.deposito, estado.n, estado.tau, estado.dist, c.alfa, c.beta, estado.rng);
      formigas.push({ rota: r.rota, passos: r.passos, L: comprimento(r.rota, estado.dist) });
    }

    let melhor = 0;
    let soma = 0;
    formigas.forEach((f, k) => {
      soma += f.L;
      if (f.L < formigas[melhor].L) melhor = k;
    });

    const at = atualizarFeromonio(estado.tau, formigas.map((f) => f.rota), formigas.map((f) => f.L), c.rho, c.Q);
    estado.tau = at.tau;
    estado.iteracao += 1;

    if (!estado.melhorGlobal || formigas[melhor].L < estado.melhorGlobal.L) {
      estado.melhorGlobal = { rota: formigas[melhor].rota.slice(), L: formigas[melhor].L, iteracao: estado.iteracao };
    }
    const registro = {
      iteracao: estado.iteracao,
      melhor: formigas[melhor].L,
      media: soma / formigas.length,
      acumulado: estado.melhorGlobal.L,
    };
    estado.historico.push(registro);
    const evento = {
      iteracao: estado.iteracao,
      formigas,
      melhorFormiga: melhor,
      arestas: at.arestas,
      registro,
    };
    estado.eventos.push(evento);
    const max = c.maxEventos || 40;
    while (estado.eventos.length > max) estado.eventos.shift();
    return evento;
  }

  function executarTudo(config) {
    const estado = criarEstado(config);
    while (!terminou(estado)) passo(estado);
    return estado;
  }

  /* ---------- Validação das entradas (texto digitado -> configuração) ---------- */
  function lerDecimal(s, casasMax) {
    s = String(s == null ? '' : s).trim();
    const re = casasMax ? new RegExp('^\\d+([.,]\\d{1,' + casasMax + '})?$') : /^\d+([.,]\d+)?$/;
    if (!re.test(s)) return null;
    const v = parseFloat(s.replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  }
  function lerInteiro(s, aceitaNegativo) {
    s = String(s == null ? '' : s).trim();
    if (!(aceitaNegativo ? /^-?\d+$/ : /^\d+$/).test(s)) return null;
    const v = parseInt(s, 10);
    return Number.isSafeInteger(v) ? v : null;
  }

  /* bruto: { vertices:[{id,x,y}], deposito, formigas, iteracoes, alfa, beta, rho, tau0, Q, semente }
     (todos como texto). Devolve { erros:[{campo, msg}], config }. */
  function validarConfig(bruto) {
    const erros = [];
    const erro = (campo, msg) => erros.push({ campo, msg });
    const vazio = (s) => String(s == null ? '' : s).trim() === '';
    const L = LIMITES;

    const vertices = [];
    (bruto.vertices || []).forEach((v, i) => {
      const id = String(v.id == null ? '' : v.id).trim();
      const nome = id || `nº ${i + 1}`;
      if (!id) erro(`v${i}.id`, `Vértice nº ${i + 1}: o identificador não pode ficar vazio.`);
      const coords = {};
      ['x', 'y'].forEach((eixo) => {
        const val = lerDecimal(v[eixo], 2);
        if (vazio(v[eixo])) erro(`v${i}.${eixo}`, `Vértice ${nome}: a coordenada ${eixo} está vazia.`);
        else if (val === null || val < L.coord[0] || val > L.coord[1]) {
          erro(`v${i}.${eixo}`, `Vértice ${nome}: a coordenada ${eixo} deve estar entre 0 e 1.000, com até duas casas decimais.`);
        }
        coords[eixo] = val;
      });
      vertices.push({ id, x: coords.x, y: coords.y });
    });
    if (vertices.length < L.vertices[0] || vertices.length > L.vertices[1]) {
      erro('vertices', `Cadastre entre ${L.vertices[0]} e ${L.vertices[1]} vértices (há ${vertices.length}).`);
    }
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const a = vertices[i];
        const b = vertices[j];
        if (a.id && a.id === b.id) {
          erro(`v${j}.id`, `Identificador repetido: "${a.id}" aparece nos vértices nº ${i + 1} e nº ${j + 1}.`);
        }
        if (a.x !== null && a.y !== null && a.x === b.x && a.y === b.y) {
          erro(`v${j}.x`, `Coordenadas duplicadas: os vértices ${a.id || 'nº ' + (i + 1)} e ${b.id || 'nº ' + (j + 1)} estão em (${a.x}; ${a.y}), o que daria distância zero.`);
        }
      }
    }

    const deposito = lerInteiro(bruto.deposito);
    if (deposito === null || deposito >= vertices.length) erro('deposito', 'Depósito: selecione um dos vértices cadastrados.');

    const inteiro = (campo, rotulo, faixa) => {
      const v = lerInteiro(bruto[campo]);
      if (vazio(bruto[campo])) erro(campo, `${rotulo}: o campo está vazio.`);
      else if (v === null || v < faixa[0] || v > faixa[1]) erro(campo, `${rotulo}: informe um inteiro entre ${faixa[0]} e ${faixa[1]}.`);
      return v;
    };
    const decimal = (campo, rotulo, faixa, sufixo) => {
      const v = lerDecimal(bruto[campo]);
      if (vazio(bruto[campo])) erro(campo, `${rotulo}: o campo está vazio.`);
      else if (v === null || v < faixa[0] || v > faixa[1]) {
        erro(campo, `${rotulo}: informe um número entre ${String(faixa[0]).replace('.', ',')} e ${faixa[1].toLocaleString('pt-BR')}${sufixo || ''}.`);
      }
      return v;
    };

    const formigas = inteiro('formigas', 'Número de formigas', L.formigas);
    const iteracoes = inteiro('iteracoes', 'Número de iterações', L.iteracoes);
    const alfa = decimal('alfa', 'Influência do feromônio (α)', L.alfa);
    const beta = decimal('beta', 'Influência da distância (β)', L.beta);
    const rhoPct = decimal('rho', 'Taxa de evaporação (ρ)', L.rho, '%');
    const tau0 = decimal('tau0', 'Feromônio inicial (τ₀)', L.tau0);
    const Q = decimal('Q', 'Constante de depósito (Q)', L.Q);
    const semente = lerInteiro(bruto.semente, true);
    if (vazio(bruto.semente)) erro('semente', 'Semente aleatória: o campo está vazio.');
    else if (semente === null) erro('semente', 'Semente aleatória: informe um número inteiro.');

    return {
      erros,
      config: {
        vertices, deposito, formigas, iteracoes, alfa, beta,
        rho: rhoPct === null ? null : rhoPct / 100, // percentual -> fração
        tau0, Q, semente,
      },
    };
  }

  /* ---------- Texto (formatação e logs) ---------- */
  // Valores muito pequenos (como o piso de 1e-12) aparecem em notação científica, não como 0.
  const fmt = (x, casas) =>
    x !== 0 && Math.abs(x) < 1e-6
      ? x.toExponential(2).replace('.', ',')
      : x.toLocaleString('pt-BR', { maximumFractionDigits: casas === undefined ? 6 : casas });
  const nomeRota = (rota, vertices) => rota.map((v) => vertices[v].id).join(' → ');
  const nomeAresta = (a, vertices) => `${vertices[a.i].id}–${vertices[a.j].id}`;

  // Log de uma iteração: construção da rota de uma formiga, comprimentos e feromônios.
  function descreverIteracao(ev, vertices, formiga) {
    const L = [];
    const id = (v) => vertices[v].id;
    const f = ev.formigas[formiga] || ev.formigas[0];
    const k = ev.formigas[formiga] ? formiga : 0;
    L.push(`ITERAÇÃO ${ev.iteracao}`);
    L.push('', `Construção da rota — formiga ${k + 1}`);
    if (f.passos) {
      f.passos.forEach((p) => {
        const cands = p.candidatos
          .map((c) => `${id(c.v)} (τ = ${fmt(c.tau)}; d = ${fmt(c.d)}; w = ${fmt(c.w)}; p = ${fmt(c.p)})`)
          .join('; ');
        const sorteio = p.sorteio === null ? 'único candidato' : `sorteio ${fmt(p.sorteio)}`;
        L.push(`Em ${id(p.atual)}: candidatos ${cands}; ${sorteio} → escolhido ${id(p.escolhido)}`);
      });
      L.push(`Todos visitados: retorno ao depósito ${id(f.rota[0])}.`);
    } else {
      L.push('Rota fornecida diretamente (teste controlado).');
    }
    L.push(`Rota: ${nomeRota(f.rota, vertices)}; comprimento ${fmt(f.L)}`);

    L.push('', 'Comprimento de cada rota');
    ev.formigas.forEach((x, i) => {
      L.push(`Formiga ${i + 1}: ${nomeRota(x.rota, vertices)}; L = ${fmt(x.L)}${i === ev.melhorFormiga ? '  ← menor da iteração' : ''}`);
    });
    L.push(`Menor da iteração: ${fmt(ev.registro.melhor)}; média: ${fmt(ev.registro.media)}; melhor acumulada: ${fmt(ev.registro.acumulado)}`);

    L.push('', 'Atualização do feromônio (após todas as rotas)');
    ev.arestas.forEach((a) => {
      L.push(`${nomeAresta(a, vertices)}: anterior ${fmt(a.anterior)}; após evaporação ${fmt(a.evaporado)}; depósito ${fmt(a.deposito)}; final ${fmt(a.final)}`);
    });
    return L.join('\n');
  }

  return {
    PISO, LIMITES, criarRng, distancias, comprimento, rotaValida, probabilidades, sortear,
    construirRota, atualizarFeromonio, criarEstado, passo, terminou, executarTudo,
    validarConfig, lerDecimal, lerInteiro, fmt, nomeRota, nomeAresta, descreverIteracao,
  };
});
