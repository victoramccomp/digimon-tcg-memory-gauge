/* =========================================================
   Fundo de circuitos
   -----------------------------------------------------------
   Gera traços a partir de uma grade, com cantos cortados em
   45° (o que dá cara de placa), vias nas pontas e alguns
   chips. Cada traço acende e apaga devagar, em tempos
   desencontrados, então o fundo respira sem chamar atenção.

   A semente é fixa: o desenho é sempre o mesmo em cada
   tamanho de tela, sem sorteio a cada carregamento.

   Só anima opacidade — nada de filtro ou blur, que custariam
   caro numa partida longa de celular.
   ========================================================= */

(function () {
  'use strict';

  var host = document.getElementById('circuit');
  if (!host) return;

  var NS = 'http://www.w3.org/2000/svg';
  var SEED = 20260902;

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

    var halo = el('radialGradient', { id: 'circuitHalo' });
    halo.appendChild(el('stop', { offset: '0',   'stop-color': '#bfe9ff', 'stop-opacity': '.85' }));
    halo.appendChild(el('stop', { offset: '1',   'stop-color': '#bfe9ff', 'stop-opacity': '0' }));
    defs.appendChild(halo);
    svg.appendChild(defs);

    var gBase = el('g', { class: 'circuit__base' });
    var gLit  = el('g', { class: 'circuit__lit' });
    svg.appendChild(gBase);
    svg.appendChild(gLit);

    /* Cada elemento aceso recebe duração, atraso e pico próprios.
       O atraso é negativo para o ciclo já começar adiantado — sem
       isso a tela inteira acenderia junto no primeiro segundo. */
    function timing(node, minDur, spanDur) {
      var dur = minDur + rand() * spanDur;
      node.style.setProperty('--dur', dur.toFixed(2) + 's');
      node.style.setProperty('--delay', (-rand() * dur).toFixed(2) + 's');
      node.style.setProperty('--peak', (0.22 + rand() * 0.28).toFixed(2));
      return node;
    }

    var i, pts, d;

    /* Os inícios são sorteados dentro de faixas, um por faixa, em vez
       de soltos pela tela: sorteio puro deixava cantos inteiros vazios. */
    var bandsX = Math.max(1, Math.round(Math.sqrt(total * w / h)));
    var bandsY = Math.max(1, Math.ceil(total / bandsX));

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
      gLit.appendChild(timing(el('path', { d: d }), 6, 8));

      /* vias nas duas pontas */
      [pts[0], pts[pts.length - 1]].forEach(function (p) {
        gBase.appendChild(el('circle', { cx: p[0], cy: p[1], r: 3.2 }));
        gLit.appendChild(timing(el('circle', {
          cx: p[0], cy: p[1], r: grid * 0.22, fill: 'url(#circuitHalo)', stroke: 'none'
        }), 5, 7));
      });
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
      for (var p = 1; p <= pins; p++) {
        var py = Math.round(cy + (ch * p) / (pins + 1));
        gBase.appendChild(el('path', {
          d: 'M' + Math.round(cx - grid * 0.35) + ' ' + py + 'H' + cx
        }));
        gBase.appendChild(el('path', {
          d: 'M' + Math.round(cx + cw) + ' ' + py + 'H' + Math.round(cx + cw + grid * 0.35)
        }));
      }

      gLit.appendChild(timing(el('rect', {
        x: cx, y: cy, width: Math.round(cw), height: Math.round(ch), rx: 5, fill: 'none'
      }), 7, 9));
    }

    host.replaceChildren(svg);
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
