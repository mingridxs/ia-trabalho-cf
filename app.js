/* Interface do simulador: campos, validação, controles, grafo, métricas,
   histórico e logs. O algoritmo e a validação das entradas estão em aco.js. */
(function () {
  'use strict';

  const A = ACO;
  const { fmt } = A;
  const $ = (id) => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const PARAMS = ['formigas', 'iteracoes', 'alfa', 'beta', 'rho', 'tau0', 'Q', 'semente'];

  // Cenário inicial (8 vértices) e instância de referência da seção 6.1
  const CENARIO = [
    ['A', '2', '2'], ['B', '9', '1'], ['C', '12', '5'], ['D', '10', '10'],
    ['E', '5', '11'], ['F', '1', '8'], ['G', '6', '6'], ['H', '3', '5'],
  ];
  const REFERENCIA = [['A', '0', '0'], ['B', '3', '0'], ['C', '3', '4'], ['D', '0', '4']];
  const PARAMS_REFERENCIA = { formigas: '10', iteracoes: '30', alfa: '1', beta: '2', rho: '50', tau0: '1', Q: '14', semente: '42' };

  let estado = null; // estado do algoritmo (ACO.criarEstado)
  let sujo = false; // dados/parâmetros alterados desde o último reinício
  let executando = false;
  let temporizador = null;
  let linhasHistorico = 0;
  let tauRef = 1; // escala visual fixa durante a execução
  let arestaSel = null; // "i-j"
  let grafo = null; // elementos do SVG montados no reinício

  /* ================= Leitura e validação ================= */
  function lerBruto() {
    const vertices = [];
    document.querySelectorAll('#tabVertices tbody tr').forEach((tr) => {
      const [id, x, y] = tr.querySelectorAll('input');
      vertices.push({ id: id.value, x: x.value, y: y.value });
    });
    const bruto = { vertices, deposito: $('deposito').value };
    PARAMS.forEach((p) => (bruto[p] = $(p).value));
    return bruto;
  }

  function validar() {
    const r = A.validarConfig(lerBruto());
    document.querySelectorAll('input.invalido').forEach((e) => e.classList.remove('invalido'));
    const linhas = document.querySelectorAll('#tabVertices tbody tr');
    r.erros.forEach((e) => {
      const m = /^v(\d+)\.(id|x|y)$/.exec(e.campo);
      let el = null;
      if (m) el = linhas[Number(m[1])].querySelectorAll('input')[{ id: 0, x: 1, y: 2 }[m[2]]];
      else if (PARAMS.includes(e.campo)) el = $(e.campo);
      if (el) el.classList.add('invalido');
    });
    return r;
  }

  function mostrarErros(erros) {
    const ul = $('erros');
    ul.innerHTML = '';
    erros.forEach((e) => {
      const li = document.createElement('li');
      li.textContent = e.msg;
      ul.appendChild(li);
    });
  }

  /* ================= Lista de vértices ================= */
  function criarLinhaVertice(id, x, y) {
    const tr = document.createElement('tr');
    [['Identificador', id, 'text'], ['x', x, 'decimal'], ['y', y, 'decimal']].forEach(([rotulo, valor, modo]) => {
      const td = document.createElement('td');
      td.dataset.rotulo = rotulo;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.inputMode = modo;
      inp.value = valor;
      inp.autocomplete = 'off';
      inp.setAttribute('aria-label', rotulo === 'Identificador' ? 'Identificador do vértice' : `Coordenada ${rotulo}`);
      if (rotulo === 'Identificador') inp.maxLength = 12;
      td.appendChild(inp);
      tr.appendChild(td);
    });
    const td = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'remover';
    btn.textContent = '✕';
    btn.title = 'Remover vértice';
    btn.setAttribute('aria-label', 'Remover vértice');
    btn.addEventListener('click', () => {
      const linhas = [...document.querySelectorAll('#tabVertices tbody tr')];
      const i = linhas.indexOf(tr);
      const dep = Number($('deposito').value);
      tr.remove();
      atualizarListaVertices(dep === i ? 0 : dep > i ? dep - 1 : dep);
      marcarSujo();
    });
    td.appendChild(btn);
    tr.appendChild(td);
    return tr;
  }

  // Refaz as opções do depósito e os limites de adicionar/remover.
  function atualizarListaVertices(depositoIndice) {
    const linhas = document.querySelectorAll('#tabVertices tbody tr');
    const sel = $('deposito');
    const atual = depositoIndice === undefined ? Number(sel.value) || 0 : depositoIndice;
    sel.innerHTML = '';
    linhas.forEach((tr, i) => {
      const id = tr.querySelector('input').value.trim();
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = id || `(vértice nº ${i + 1}, sem identificador)`;
      sel.appendChild(o);
      tr.querySelector('button.remover').disabled = linhas.length <= A.LIMITES.vertices[0];
    });
    sel.value = String(Math.min(atual, linhas.length - 1));
    linhas.forEach((tr, i) => tr.classList.toggle('deposito', String(i) === sel.value));
    $('btnAdicionar').disabled = linhas.length >= A.LIMITES.vertices[1];
  }

  function preencherVertices(lista, deposito) {
    const tbody = $('tabVertices').querySelector('tbody');
    tbody.innerHTML = '';
    lista.forEach(([id, x, y]) => tbody.appendChild(criarLinhaVertice(id, x, y)));
    atualizarListaVertices(deposito || 0);
  }

  function adicionarVertice() {
    const tbody = $('tabVertices').querySelector('tbody');
    const b = lerBruto().vertices;
    if (b.length >= A.LIMITES.vertices[1]) return;
    const usados = new Set(b.map((v) => v.id.trim()));
    const id = LETRAS.split('').find((l) => !usados.has(l)) || `V${b.length + 1}`;
    // Posição nova dentro da área já ocupada, sem repetir coordenadas.
    const xs = b.map((v) => A.lerDecimal(v.x, 2)).filter((v) => v !== null);
    const ys = b.map((v) => A.lerDecimal(v.y, 2)).filter((v) => v !== null);
    const [x0, x1] = xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 100];
    const [y0, y1] = ys.length ? [Math.min(...ys), Math.max(...ys)] : [0, 100];
    const ocupado = new Set(b.map((v) => `${A.lerDecimal(v.x, 2)};${A.lerDecimal(v.y, 2)}`));
    let x = 0;
    let y = 0;
    for (let k = 1; k < 500; k++) {
      x = Math.round((x0 + ((k * 0.381966) % 1) * Math.max(x1 - x0, 1)) * 100) / 100;
      y = Math.round((y0 + ((k * 0.754877) % 1) * Math.max(y1 - y0, 1)) * 100) / 100;
      if (!ocupado.has(`${x};${y}`)) break;
    }
    tbody.appendChild(criarLinhaVertice(id, String(x).replace('.', ','), String(y).replace('.', ',')));
    atualizarListaVertices();
    marcarSujo();
  }

  /* ================= Controles ================= */
  function marcarSujo() {
    pausar();
    sujo = true;
    mostrarErros(validar().erros);
    atualizarControles();
  }

  function atualizarControles() {
    const fim = estado && A.terminou(estado);
    const pode = estado && !sujo && !fim && !executando;
    $('btnExecutar').disabled = !pode;
    $('btnAvancar').disabled = !pode;
    $('btnPausar').disabled = !executando;

    const st = $('status');
    st.className = 'status';
    if (sujo) {
      st.textContent = 'Dados ou parâmetros alterados: clique em Reiniciar para aplicá-los.';
      st.classList.add('aviso');
    } else if (!estado) {
      st.textContent = '';
    } else if (fim) {
      st.textContent = `Execução encerrada: ${estado.config.iteracoes} iterações concluídas.`;
      st.classList.add('fim');
    } else if (executando) {
      st.textContent = 'Executando…';
    } else {
      st.textContent = `Pausado na iteração ${estado.iteracao} de ${estado.config.iteracoes}.`;
    }
  }

  /* Escala visual do feromônio: fixa durante toda a execução.
     tauRef é um limite superior teórico de τ para os parâmetros aplicados:
     nenhuma aresta recebe mais que m·Q/Lmín por iteração, e Lmín ≥ limite inferior
     do comprimento de uma rota (metade da soma das duas menores arestas de cada vértice). */
  function calcularTauRef(cfg, dist) {
    let inferior = 0;
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i].filter((_, j) => j !== i).sort((a, b) => a - b);
      inferior += (d[0] + d[1]) / 2;
    }
    const porIteracao = (cfg.formigas * cfg.Q) / inferior;
    return cfg.rho > 0 ? Math.max(cfg.tau0, porIteracao / cfg.rho) : cfg.tau0 + cfg.iteracoes * porIteracao;
  }

  function reiniciar() {
    pausar();
    const { erros, config } = validar();
    mostrarErros(erros);
    if (erros.length) {
      sujo = true;
      atualizarControles();
      return;
    }
    estado = A.criarEstado(config); // restaura τ₀ e recria o gerador com a semente
    tauRef = calcularTauRef(config, estado.dist);
    sujo = false;
    linhasHistorico = 0;
    arestaSel = null;
    $('tabHistorico').querySelector('tbody').innerHTML = '';
    montarGrafo();
    montarTabelaArestas();
    renderizar();
    atualizarControles();
  }

  function avancar() {
    if (!estado || sujo || executando || A.terminou(estado)) return;
    A.passo(estado);
    renderizar();
    atualizarControles();
  }

  function executar() {
    if (!estado || sujo || executando || A.terminou(estado)) return;
    executando = true;
    atualizarControles();
    ciclo();
  }

  // O intervalo só define a espera entre iterações; não participa dos sorteios.
  function ciclo() {
    if (!executando) return;
    A.passo(estado);
    renderizar();
    if (A.terminou(estado)) executando = false;
    else temporizador = setTimeout(ciclo, Number($('intervalo').value));
    atualizarControles();
  }

  function pausar() {
    executando = false;
    clearTimeout(temporizador);
    atualizarControles();
  }

  /* ================= Grafo (SVG) ================= */
  const el = (nome, attrs, pai) => {
    const e = document.createElementNS(SVG, nome);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (pai) pai.appendChild(e);
    return e;
  };
  const chave = (i, j) => `${Math.min(i, j)}-${Math.max(i, j)}`;

  function montarGrafo() {
    const svg = $('grafo');
    svg.innerHTML = '';
    const V = estado.config.vertices;
    const W = 640, H = 440, M = 46;
    const xs = V.map((v) => v.x);
    const ys = V.map((v) => v.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const escala = Math.min((W - 2 * M) / Math.max(x1 - x0, 1e-9), (H - 2 * M) / Math.max(y1 - y0, 1e-9));
    const s = Number.isFinite(escala) ? escala : 1;
    // Mesma escala nos dois eixos (preserva as distâncias); y cresce para cima.
    const pos = V.map((v) => ({
      x: W / 2 + (v.x - (x0 + x1) / 2) * s,
      y: H / 2 - (v.y - (y0 + y1) / 2) * s,
    }));

    const gArestas = el('g', {}, svg);
    const gRota = el('g', {}, svg);
    const gRotulos = el('g', {}, svg);
    const gAlvos = el('g', {}, svg);
    const gNos = el('g', {}, svg);
    const arestas = {};
    for (let i = 0; i < V.length; i++) {
      for (let j = i + 1; j < V.length; j++) {
        const k = chave(i, j);
        const coords = { x1: pos[i].x, y1: pos[i].y, x2: pos[j].x, y2: pos[j].y };
        const linha = el('line', Object.assign({ class: 'aresta' }, coords), gArestas);
        const alvo = el('line', Object.assign({ class: 'alvo' }, coords), gAlvos);
        const titulo = el('title', {}, alvo);
        alvo.addEventListener('mouseenter', () => mostrarInfoAresta(k));
        alvo.addEventListener('mouseleave', () => mostrarInfoAresta(arestaSel));
        alvo.addEventListener('click', () => selecionarAresta(k));
        arestas[k] = { i, j, linha, titulo };
      }
    }
    const rota = el('polyline', { class: 'rota', points: '' }, gRota);
    const gSetas = el('g', {}, gRota);

    V.forEach((v, i) => {
      const dep = i === estado.config.deposito;
      const g = el('g', { class: 'no' + (dep ? ' dep' : '') }, gNos);
      if (dep) el('rect', { x: pos[i].x - 15, y: pos[i].y - 15, width: 30, height: 30, rx: 6 }, g);
      else el('circle', { cx: pos[i].x, cy: pos[i].y, r: 14 }, g);
      el('text', { x: pos[i].x, y: pos[i].y }, g).textContent = v.id.length > 3 ? v.id.slice(0, 3) : v.id;
      el('title', {}, g).textContent = `${v.id} (${fmt(v.x)}; ${fmt(v.y)})${dep ? ' — depósito' : ''}`;
      if (dep) el('text', { class: 'legenda-dep', x: pos[i].x, y: pos[i].y + 29 }, gNos).textContent = 'depósito';
    });
    grafo = { pos, arestas, rota, gSetas, gRotulos };
  }

  function atualizarGrafo() {
    if (!grafo) return;
    const V = estado.config.vertices;
    Object.keys(grafo.arestas).forEach((k) => {
      const a = grafo.arestas[k];
      const tau = estado.tau[a.i][a.j];
      const f = Math.max(0, Math.min(1, tau / tauRef)); // função crescente de τ, com escala fixa
      a.linha.setAttribute('stroke-width', (0.8 + 12 * f).toFixed(2));
      a.linha.setAttribute('stroke-opacity', (0.16 + 0.84 * f).toFixed(3));
      a.linha.classList.toggle('sel', k === arestaSel);
      a.titulo.textContent = `${V[a.i].id}–${V[a.j].id}: distância ${fmt(estado.dist[a.i][a.j])}; feromônio ${fmt(tau)}`;
    });

    // Melhor rota acumulada, com setas no sentido do percurso
    grafo.gSetas.innerHTML = '';
    const m = estado.melhorGlobal;
    if (m) {
      grafo.rota.setAttribute('points', m.rota.map((v) => `${grafo.pos[v].x},${grafo.pos[v].y}`).join(' '));
      for (let p = 0; p + 1 < m.rota.length; p++) {
        const a = grafo.pos[m.rota[p]];
        const b = grafo.pos[m.rota[p + 1]];
        const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        el('polygon', {
          class: 'seta', points: '-7,-6 7,0 -7,6',
          transform: `translate(${(a.x + b.x) / 2},${(a.y + b.y) / 2}) rotate(${ang})`,
        }, grafo.gSetas);
      }
    } else {
      grafo.rota.setAttribute('points', '');
    }

    // Rótulos numéricos opcionais
    grafo.gRotulos.innerHTML = '';
    if ($('mostrarTau').checked) {
      Object.keys(grafo.arestas).forEach((k) => {
        const a = grafo.arestas[k];
        const p = grafo.pos[a.i];
        const q = grafo.pos[a.j];
        // um pouco fora do meio, para os rótulos de arestas que se cruzam não coincidirem
        el('text', { class: 'rotulo-tau', x: p.x + (q.x - p.x) * 0.38, y: p.y + (q.y - p.y) * 0.38 + 4 }, grafo.gRotulos)
          .textContent = estado.tau[a.i][a.j] < 0.0005 ? '≈0' : fmt(estado.tau[a.i][a.j], 3);
      });
    }

    $('escala').textContent =
      `Espessura e intensidade proporcionais a τ, em escala fixa durante toda a execução: de 0 até τ = ${fmt(tauRef, 3)} ` +
      '(limite superior teórico para estes parâmetros). A escala não muda entre iterações: linha mais grossa sempre significa mais feromônio.';
  }

  function selecionarAresta(k) {
    arestaSel = arestaSel === k ? null : k;
    renderizarArestas();
    atualizarGrafo();
    mostrarInfoAresta(arestaSel);
  }

  function mostrarInfoAresta(k) {
    const p = $('infoAresta');
    p.innerHTML = '';
    if (!k || !grafo || !grafo.arestas[k]) {
      p.textContent = 'Passe o cursor ou toque em uma aresta (ou em uma linha da tabela de arestas) para consultar a distância e o feromônio.';
      return;
    }
    const a = grafo.arestas[k];
    const V = estado.config.vertices;
    const forte = document.createElement('strong');
    forte.textContent = `Aresta ${V[a.i].id}–${V[a.j].id}`;
    let texto = `: distância ${fmt(estado.dist[a.i][a.j])} (fixa); feromônio τ = ${fmt(estado.tau[a.i][a.j])}`;
    const ult = estado.eventos[estado.eventos.length - 1];
    const reg = ult && ult.arestas.find((x) => x.i === a.i && x.j === a.j);
    texto += reg
      ? `. Na iteração ${ult.iteracao}: anterior ${fmt(reg.anterior)}; após evaporação ${fmt(reg.evaporado)}; depósito ${fmt(reg.deposito)}; final ${fmt(reg.final)}.`
      : ` (valor inicial τ₀; nenhuma iteração concluída).`;
    p.append(forte, document.createTextNode(texto));
  }

  /* ================= Tabelas, métricas, gráfico e log ================= */
  function montarTabelaArestas() {
    const tbody = $('tabArestas').querySelector('tbody');
    tbody.innerHTML = '';
    const V = estado.config.vertices;
    Object.keys(grafo.arestas).forEach((k) => {
      const a = grafo.arestas[k];
      const tr = document.createElement('tr');
      tr.dataset.k = k;
      [`${V[a.i].id}–${V[a.j].id}`, fmt(estado.dist[a.i][a.j]), ''].forEach((t) => {
        const td = document.createElement('td');
        td.textContent = t;
        tr.appendChild(td);
      });
      tr.addEventListener('click', () => selecionarAresta(k));
      tbody.appendChild(tr);
    });
  }

  function renderizarArestas() {
    $('tabArestas').querySelectorAll('tbody tr').forEach((tr) => {
      const a = grafo.arestas[tr.dataset.k];
      tr.lastChild.textContent = fmt(estado.tau[a.i][a.j]);
      tr.classList.toggle('sel', tr.dataset.k === arestaSel);
    });
  }

  function renderizar() {
    const cfg = estado.config;
    const h = estado.historico[estado.historico.length - 1];
    $('mIteracao').textContent = `${estado.iteracao} / ${cfg.iteracoes}`;
    $('mMelhor').textContent = h ? fmt(h.melhor, 4) : '—';
    $('mMedia').textContent = h ? fmt(h.media, 4) : '—';
    // Na iteração 0 não há rota: a melhor distância não é exibida como zero.
    $('mAcumulado').textContent = h ? fmt(h.acumulado, 4) : 'ainda não calculada';
    $('mAcumulado').style.fontSize = h ? '' : '1.05rem';

    // Melhor rota
    $('tituloMelhor').textContent = A.terminou(estado)
      ? 'Resultado final: melhor rota de toda a execução'
      : 'Melhor rota encontrada até agora';
    const caixa = $('melhor');
    caixa.innerHTML = '';
    const dl = document.createElement('dl');
    const item = (t, txt, pendente) => {
      const dt = document.createElement('dt');
      dt.textContent = t;
      const dd = document.createElement('dd');
      dd.textContent = txt;
      if (pendente) dd.className = 'pendente';
      dl.append(dt, dd);
    };
    const m = estado.melhorGlobal;
    if (m) {
      item('Sequência', A.nomeRota(m.rota, cfg.vertices));
      item('Distância total', fmt(m.L));
      item('Encontrada na iteração', String(m.iteracao));
    } else {
      item('Sequência', 'ainda não calculada (iteração 0)', true);
      item('Distância total', 'ainda não calculada', true);
    }
    item('Depósito', cfg.vertices[cfg.deposito].id);
    caixa.appendChild(dl);

    // Histórico
    const tbody = $('tabHistorico').querySelector('tbody');
    for (; linhasHistorico < estado.historico.length; linhasHistorico++) {
      const r = estado.historico[linhasHistorico];
      const tr = document.createElement('tr');
      [r.iteracao, fmt(r.melhor, 4), fmt(r.media, 4), fmt(r.acumulado, 4)].forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    $('histVazio').style.display = estado.historico.length ? 'none' : '';
    const caixaHist = $('tabHistorico').parentElement;
    caixaHist.scrollTop = caixaHist.scrollHeight;

    atualizarGrafo();
    renderizarArestas();
    mostrarInfoAresta(arestaSel);
    renderGrafico();
    renderLog();
  }

  function renderGrafico() {
    const cv = $('grafico');
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx || !estado) return;
    const css = getComputedStyle(document.documentElement);
    const cor = (n) => css.getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 600;
    const H = 260;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const h = estado.historico;
    const m = { e: 52, d: 12, t: 12, b: 28 };
    const maxX = Math.max(estado.config.iteracoes, 1);
    let minY = 0;
    let maxY = 1;
    if (h.length) {
      const todos = h.flatMap((r) => [r.melhor, r.media, r.acumulado]);
      const lo = Math.min(...todos);
      const hi = Math.max(...todos);
      const folga = Math.max((hi - lo) * 0.15, hi * 0.02, 1e-9);
      minY = Math.max(0, lo - folga);
      maxY = hi + folga;
    }
    const X = (g) => m.e + (g / maxX) * (W - m.e - m.d);
    const Y = (v) => H - m.b - ((v - minY) / (maxY - minY)) * (H - m.t - m.b);

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = cor('--suave');
    ctx.strokeStyle = cor('--grade');
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = minY + ((maxY - minY) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(m.e, Y(v));
      ctx.lineTo(W - m.d, Y(v));
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(h.length ? fmt(v, 2) : '', m.e - 6, Y(v) + 4);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const g = Math.round((maxX * i) / 5);
      ctx.fillText(String(g), X(g), H - 8);
    }
    if (!h.length) {
      ctx.fillText('Nenhuma iteração concluída', (m.e + W - m.d) / 2, H / 2);
      return;
    }
    const linha = (campo, tinta, larg) => {
      ctx.strokeStyle = tinta;
      ctx.lineWidth = larg;
      ctx.beginPath();
      h.forEach((r, i) => (i ? ctx.lineTo(X(r.iteracao), Y(r[campo])) : ctx.moveTo(X(r.iteracao), Y(r[campo]))));
      ctx.stroke();
      ctx.fillStyle = tinta;
      h.forEach((r, i) => {
        if (h.length <= 40 || i === h.length - 1) {
          ctx.beginPath();
          ctx.arc(X(r.iteracao), Y(r[campo]), 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    };
    linha('acumulado', cor('--elite'), 4);
    linha('media', cor('--p2'), 2);
    linha('melhor', cor('--p1'), 2);
  }

  function renderLog() {
    const selI = $('logIteracao');
    const selF = $('logFormiga');
    const seguir = $('logSeguir').checked;
    const antI = selI.value;
    const antF = selF.value;

    selI.innerHTML = '';
    if (!estado.eventos.length) {
      const o = document.createElement('option');
      o.value = '0';
      o.textContent = '0';
      selI.appendChild(o);
    }
    estado.eventos.forEach((ev) => {
      const o = document.createElement('option');
      o.value = String(ev.iteracao);
      o.textContent = String(ev.iteracao);
      selI.appendChild(o);
    });
    const existe = estado.eventos.some((ev) => String(ev.iteracao) === antI);
    selI.value = seguir || !existe ? String(estado.iteracao) : antI;

    selF.innerHTML = '';
    for (let k = 0; k < estado.config.formigas; k++) {
      const o = document.createElement('option');
      o.value = String(k);
      o.textContent = String(k + 1);
      selF.appendChild(o);
    }
    selF.value = Number(antF) < estado.config.formigas && antF !== '' ? antF : '0';
    escreverLog();
  }

  function escreverLog() {
    const it = Number($('logIteracao').value);
    const ev = estado.eventos.find((e) => e.iteracao === it);
    $('log').textContent = ev
      ? A.descreverIteracao(ev, estado.config.vertices, Number($('logFormiga').value))
      : `ITERAÇÃO 0\n\nEstado inicial: τ = ${fmt(estado.config.tau0)} em todas as arestas; nenhuma rota calculada.\nMelhor distância: ainda não calculada.`;
  }

  /* ================= Tema claro/escuro (só aparência) ================= */
  function aplicarTema(tema, salvar) {
    document.documentElement.dataset.tema = tema;
    const escuro = tema === 'escuro';
    $('btnTema').textContent = escuro ? '☀️ Modo claro' : '🌙 Modo noturno';
    $('btnTema').setAttribute('aria-pressed', String(escuro));
    if (salvar) {
      try { localStorage.setItem('tema', tema); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
    }
    renderGrafico();
  }

  /* ================= Inicialização ================= */
  function iniciar() {
    aplicarTema(document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro', false);
    $('btnTema').addEventListener('click', () => {
      aplicarTema(document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro', true);
    });

    preencherVertices(CENARIO, 0);
    $('btnAdicionar').addEventListener('click', adicionarVertice);
    $('btnReferencia').addEventListener('click', () => {
      preencherVertices(REFERENCIA, 0);
      PARAMS.forEach((p) => ($(p).value = PARAMS_REFERENCIA[p]));
      reiniciar();
    });

    // Qualquer alteração em dados ou parâmetros exige reinício.
    $('tabVertices').addEventListener('input', (e) => {
      if (e.target.closest('td') && e.target.closest('td').dataset.rotulo === 'Identificador') atualizarListaVertices();
      marcarSujo();
    });
    $('deposito').addEventListener('change', () => {
      atualizarListaVertices();
      marcarSujo();
    });
    $('secParametros').addEventListener('input', marcarSujo);

    $('btnExecutar').addEventListener('click', executar);
    $('btnPausar').addEventListener('click', pausar);
    $('btnAvancar').addEventListener('click', avancar);
    $('btnReiniciar').addEventListener('click', reiniciar);
    $('intervalo').addEventListener('input', () => {
      $('intervaloTxt').textContent = `${$('intervalo').value} ms`;
    });
    $('mostrarTau').addEventListener('change', atualizarGrafo);

    $('logIteracao').addEventListener('change', () => {
      $('logSeguir').checked = false;
      escreverLog();
    });
    $('logFormiga').addEventListener('change', escreverLog);
    $('logSeguir').addEventListener('change', () => estado && renderLog());

    $('btnTestes').addEventListener('click', () => {
      const r = TestesACO.executar(A);
      $('saidaTestes').textContent = `${r.filter((t) => t.ok).length} de ${r.length} grupos de teste aprovados\n\n` + TestesACO.comoTexto(r);
    });

    window.addEventListener('resize', renderGrafico);
    reiniciar();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
