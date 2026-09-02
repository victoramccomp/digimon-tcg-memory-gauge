/* =========================================================
   Fundo de circuitos
   -----------------------------------------------------------
   Traços de placa gerados a partir de uma grade, com os cantos
   cortados em 45°, vias nas pontas e alguns chips.

   Camadas, do fundo para a frente:

     base   os traços, vias e chips, sempre visíveis e fracos
     lit    vias e chips que acendem e apagam parados
     pulse  as luzes que percorrem os traços

   As luzes são feitas com stroke-dasharray: um traço curto e um
   vão maior que o comprimento do caminho, então só existe uma
   luz por vez e ela some entre uma passagem e outra. A duração
   sai da velocidade, não do comprimento, senão traço longo teria
   luz rápida e traço curto luz lenta.

   Só dashoffset e opacidade são animados — nada de blur ou
   filtro, que pesariam numa partida longa de celular.
   ========================================================= */

(function () {
  'use strict';

  var host = document.getElementById('circuit');
  if (!host) return;

  var NS = 'http://www.w3.org/2000/svg';
  var SEED = 20260902;

  /* Teto de luzes simultâneas. O resto dos traços fica como
     circuitaria parada: dá densidade sem custo de animação. */
  var MAX_PULSES = 14;

  /* ---------------------------------------------------------
     Utilidades
     --------------------------------------------------------- */

  function makeRandom(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  /* Ponto a `dist` de `from` na direção de `toward`. */
  function trim(from, toward, dist) {
    var dx = toward[0] - from[0];
    var dy = toward[1] - from[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = Math.min(dist, len / 2) / len;
    return [Math.round(from[0] + dx * k), Math.round(from[1] + dy * k)];
  }

  /* Polilinha -> path com os cantos chanfrados em 45°. */
  function toPath(pts, cut) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var a = trim(pts[i], pts[i - 1], cut);
      var b = trim(pts[i], pts[i + 1], cut);
      d += 'L' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1];
    }
    var last = pts[pts.length - 1];
    return d + 'L' + last[0] + ' ' + last[1];
  }

  /* ---------------------------------------------------------
     Geração
     --------------------------------------------------------- */

  /* Caminha pela grade virando 90° a cada trecho, partindo de
     onde o chamador mandar. */
  function walk(rand, cols, rows, grid, startCol, startRow) {
    var x = startCol;
    var y = startRow;
    var horizontal = rand() < 0.5;
    var sign = rand() < 0.5 ? 1 : -1;

    var pts = [[x * grid, y * grid]];
    var steps = 2 + Math.floor(rand() * 3);

    for (var i = 0; i < steps; i++) {
      var len = 1 + Math.floor(rand() * 3);
      if (horizontal) x = Math.max(0, Math.min(cols, x + sign * len));
      else            y = Math.max(0, Math.min(rows, y + sign * len));

      var pt = [x * grid, y * grid];
      var prev = pts[pts.length - 1];
      if (pt[0] !== prev[0] || pt[1] !== prev[1]) pts.push(pt);

      horizontal = !horizontal;
      sign = rand() < 0.5 ? 1 : -1;
    }
    return pts;
  }

  function build() {
    var w = host.clientWidth;
    var h = host.clientHeight;
    if (!w || !h) return;

    var rand = makeRandom(SEED);
    var grid = w < 620 ? 46 : 62;
    var cols = Math.max(4, Math.round(w / grid));
    var rows = Math.max(4, Math.round(h / grid));
    var total = Math.min(28, Math.max(12, Math.round(cols * rows / 7)));

    var svg = el('svg', {
      viewBox: '0 0 ' + w + ' ' + h,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true'
    });

    /* Gradiente vertical: laranja no lado do jogador de cima,
       ciano no de baixo, acompanhando o resto do tema. */
    var defs = el('defs', {});
    var grad = el('linearGradient', {
      id: 'circuitGrad', gradientUnits: 'userSpaceOnUse',
      x1: 0, y1: 0, x2: 0, y2: h
    });
    grad.appendChild(el('stop', { offset: '0',   'stop-color': '#ff8a3d' }));
    grad.appendChild(el('stop', { offset: '0.5', 'stop-color': '#8fa8c8' }));
    grad.appendChild(el('stop', { offset: '1',   'stop-color': '#35c8ff' }));
    defs.appendChild(grad);

    /* As luzes são mais claras que os traços, para lerem como luz
       e não como um traço grosso. */
    var lightGrad = el('linearGradient', {
      id: 'circuitLight', gradientUnits: 'userSpaceOnUse',
      x1: 0, y1: 0, x2: 0, y2: h
    });
    lightGrad.appendChild(el('stop', { offset: '0',   'stop-color': '#ffd0a8' }));
    lightGrad.appendChild(el('stop', { offset: '0.5', 'stop-color': '#dbe7f5' }));
    lightGrad.appendChild(el('stop', { offset: '1',   'stop-color': '#a8e8ff' }));
    defs.appendChild(lightGrad);

    var halo = el('radialGradient', { id: 'circuitHalo' });
    halo.appendChild(el('stop', { offset: '0', 'stop-color': '#bfe9ff', 'stop-opacity': '.85' }));
    halo.appendChild(el('stop', { offset: '1', 'stop-color': '#bfe9ff', 'stop-opacity': '0' }));
    defs.appendChild(halo);
    svg.appendChild(defs);

    var gBase  = el('g', { class: 'circuit__base' });
    var gLit   = el('g', { class: 'circuit__lit' });
    var gPulse = el('g', { class: 'circuit__pulse' });
    svg.appendChild(gBase);
    svg.appendChild(gLit);
    svg.appendChild(gPulse);

    /* Vias e chips respiram parados, cada um no seu tempo. */
    function breathe(node, minDur, spanDur) {
      var dur = minDur + rand() * spanDur;
      node.style.setProperty('--dur', dur.toFixed(2) + 's');
      node.style.setProperty('--delay', (-rand() * dur).toFixed(2) + 's');
      node.style.setProperty('--peak', (0.22 + rand() * 0.28).toFixed(2));
      return node;
    }

    /* Os inícios são sorteados dentro de faixas, um por faixa, em vez
       de soltos pela tela: sorteio puro deixava cantos inteiros vazios. */
    var bandsX = Math.max(1, Math.round(Math.sqrt(total * w / h)));
    var bandsY = Math.max(1, Math.ceil(total / bandsX));

    var pulseEvery = Math.max(1, Math.round(total / MAX_PULSES));
    var pulses = [];

    var i, j, pts, d;

    /* ---- traços ---- */
    for (i = 0; i < total; i++) {
      var bx = i % bandsX;
      var by = Math.floor(i / bandsX) % bandsY;
      var startCol = Math.round((bx + rand()) * cols / bandsX);
      var startRow = Math.round((by + rand()) * rows / bandsY);

      pts = walk(rand, cols, rows, grid, startCol, startRow);
      d = toPath(pts, grid * 0.42);
      if (!d) continue;

      gBase.appendChild(el('path', { d: d }));

      /* vias nas duas pontas */
      [pts[0], pts[pts.length - 1]].forEach(function (p) {
        gBase.appendChild(el('circle', { cx: p[0], cy: p[1], r: 3.2 }));
        gLit.appendChild(breathe(el('circle', {
          cx: p[0], cy: p[1], r: grid * 0.22, fill: 'url(#circuitHalo)', stroke: 'none'
        }), 5, 7));
      });

      /* só uma parte dos traços recebe luz */
      if (i % pulseEvery === 0 && pulses.length < MAX_PULSES) {
        var pulseHalo = el('path', { d: d, class: 'circuit__pulse-halo' });
        var pulseCore = el('path', { d: d, class: 'circuit__pulse-core' });
        gPulse.appendChild(pulseHalo);
        gPulse.appendChild(pulseCore);
        pulses.push({ core: pulseCore, nodes: [pulseHalo, pulseCore] });
      }
    }

    /* ---- chips ---- */
    var chips = w < 620 ? 2 : 4;
    for (i = 0; i < chips; i++) {
      var cw = grid * (1.6 + rand());
      var ch = grid * (1.1 + rand() * 0.7);
      var cx = Math.round(rand() * Math.max(1, w - cw));
      var cy = Math.round(rand() * Math.max(1, h - ch));

      gBase.appendChild(el('rect', {
        x: cx, y: cy, width: Math.round(cw), height: Math.round(ch), rx: 5
      }));

      /* pinos nos dois lados */
      var pins = 3;
      for (j = 1; j <= pins; j++) {
        var py = Math.round(cy + (ch * j) / (pins + 1));
        gBase.appendChild(el('path', { d: 'M' + Math.round(cx - grid * 0.35) + ' ' + py + 'H' + cx }));
        gBase.appendChild(el('path', {
          d: 'M' + Math.round(cx + cw) + ' ' + py + 'H' + Math.round(cx + cw + grid * 0.35)
        }));
      }

      gLit.appendChild(breathe(el('rect', {
        x: cx, y: cy, width: Math.round(cw), height: Math.round(ch), rx: 5, fill: 'none'
      }), 7, 9));
    }

    host.replaceChildren(svg);

    /* ---- tempos das luzes ----
       Só agora, com o svg no documento, dá para medir o caminho.
       Velocidade fixa -> a luz anda igual em traço curto e longo. */
    pulses.forEach(function (p) {
      var len = p.core.getTotalLength();
      if (!len) return;

      var dash = 30 + rand() * 30;              // tamanho da luz
      var visible = 0.18 + rand() * 0.24;       // fração do ciclo com luz na tela
      var period = (len + dash) / visible;      // dash + vão
      var speed = 70 + rand() * 80;             // px/s
      var dur = period / speed;

      p.nodes.forEach(function (n) {
        n.style.setProperty('--dash', dash.toFixed(1) + 'px');
        n.style.setProperty('--gap', (period - dash).toFixed(1) + 'px');
        n.style.setProperty('--from', period.toFixed(1) + 'px');
        n.style.setProperty('--to', '0px');
        n.style.setProperty('--dur', dur.toFixed(2) + 's');
        n.style.setProperty('--delay', (-rand() * dur).toFixed(2) + 's');
      });
    });
  }

  /* ---------------------------------------------------------
     Ciclo de vida
     --------------------------------------------------------- */

  var last = '';
  function refresh() {
    var key = host.clientWidth + 'x' + host.clientHeight;
    if (key === last) return;
    last = key;
    build();
  }

  var timer = null;
  function scheduleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 180);
  }

  refresh();

  /* Três gatilhos, porque `refresh` não faz nada quando o tamanho não
     mudou e nenhum deles sozinho cobre tudo:
       - ResizeObserver pega qualquer mudança de caixa (girar a tela, a
         barra do navegador recolhendo), mas depende do ciclo de
         renderização, que fica suspenso com a aba em segundo plano;
       - os eventos de janela cobrem navegadores sem o observer;
       - visibilitychange refaz o desenho se a tela girou enquanto o
         app estava escondido, quando o resto ficou congelado.
     Sem isso o desenho antigo fica esticado no tamanho novo. */
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(scheduleRefresh).observe(host);
  }
  window.addEventListener('resize', scheduleRefresh);
  window.addEventListener('orientationchange', scheduleRefresh);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') scheduleRefresh();
  });
})();
