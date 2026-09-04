/* =========================================================
   Memory Gauge — Digimon TCG
   -----------------------------------------------------------
   Modelo: a memória é UM contador compartilhado, guardado em
   `state.mem`, um inteiro de -10 a +10.

     mem < 0  -> contador no lado do jogador A (ele tem -mem)
     mem > 0  -> contador no lado do jogador B (ele tem  mem)
     mem = 0  -> centro da régua

   O turno pertence a quem NÃO tem o contador do lado do
   oponente: assim que o contador cruza para o outro lado, o
   turno passa com exatamente a memória que foi empurrada.

   A partida começa com o contador em 0. Os 3 de memória só
   entram quando o jogador ENCERRA o turno voluntariamente com
   o contador em 0 ou do próprio lado — nunca como piso de
   início de turno. É isso que permite passar o turno com 1 ou
   2 de memória gastando custos, a base do controle de memória.
   ========================================================= */

(function () {
  'use strict';

  var MAX = 10;
  var PASS = 3;   // memória entregue ao encerrar o turno voluntariamente
  var COSTS = [1, 2, 3, 4, 5, 6, 7, 8];
  var K_STATE = 'dmg:state:v1';
  var K_SETTINGS = 'dmg:settings:v1';
  var UNDO_LIMIT = 80;

  /* ---------------------------------------------------------
     Estado
     --------------------------------------------------------- */

  // A partida abre com o contador no centro da régua.
  function freshState(first) {
    return { mem: 0, turn: first || 'a', turnNo: 1 };
  }

  var defaultSettings = {
    names: { a: 'Jogador 1', b: 'Jogador 2' },
    rotate: true,
    circuit: true,
    vibrate: true,
    wake: true
  };

  var state = freshState('a');
  var settings = clone(defaultSettings);
  var undoStack = [];

  /* ---------------------------------------------------------
     Helpers de domínio
     --------------------------------------------------------- */

  function dir(p) { return p === 'a' ? -1 : 1; }          // sinal do lado do jogador
  function other(p) { return p === 'a' ? 'b' : 'a'; }
  function sideOf(m) { return m < 0 ? 'a' : m > 0 ? 'b' : null; }
  function clamp(m) { return Math.max(-MAX, Math.min(MAX, m)); }
  function memOf(p, m) { return Math.max(0, dir(p) * (m === undefined ? state.mem : m)); }
  function nameOf(p) { return settings.names[p] || defaultSettings.names[p]; }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------------------------------------------------
     DOM
     --------------------------------------------------------- */

  var el = {};
  function $(id) { return document.getElementById(id); }

  function cacheDom() {
    el.body = document.body;
    el.track = $('track');
    el.gaugeViewport = $('gaugeViewport');
    el.turnName = $('turnName');
    el.turnMeta = $('turnMeta');
    el.toast = $('toast');
    el.btnUndo = $('btnUndo');
    el.mem = { a: $('memA'), b: $('memB') };
    el.name = { a: $('nameA'), b: $('nameB') };
    el.end = { a: $('endA'), b: $('endB') };
    el.panel = {
      a: document.querySelector('.player--a'),
      b: document.querySelector('.player--b')
    };
    el.pad = {
      a: document.querySelector('[data-pad="a"]'),
      b: document.querySelector('[data-pad="b"]')
    };
    el.endturn = {
      a: document.querySelector('.player--a .endturn'),
      b: document.querySelector('.player--b .endturn')
    };
    el.dlgMenu = $('dlgMenu');
    el.dlgDraw = $('dlgDraw');
    el.draw = $('draw');
    el.drawDisc = $('drawDisc');
    el.drawStatus = $('drawStatus');
    el.dlgInfo = $('dlgInfo');
    el.info = {
      turnNo: $('infoTurnNo'),
      turnName: $('infoTurnName'),
      mem: $('infoMem')
    };
    el.dlgNew = $('dlgNew');
    el.dlgSettings = $('dlgSettings');
    el.dlgHelp = $('dlgHelp');
    el.inpName = { a: $('inpNameA'), b: $('inpNameB') };
    el.opt = {
      rotate: $('optRotate'),
      circuit: $('optCircuit'),
      vibrate: $('optVibrate'),
      wake: $('optWake')
    };
    el.first = { a: $('firstA'), b: $('firstB') };
  }

  /* ---------------------------------------------------------
     Construção da régua e dos teclados de custo
     --------------------------------------------------------- */

  var cells = [];

  function buildTrack() {
    var frag = document.createDocumentFragment();
    for (var v = -MAX; v <= MAX; v++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell' + (v === 0 ? ' cell--zero' : '');
      b.dataset.v = String(v);

      /* o número vai num span porque o hexágono é o ::before da casa,
         e o texto precisa ficar por cima dele */
      var n = document.createElement('span');
      n.className = 'cell__n';
      n.textContent = String(Math.abs(v));
      b.appendChild(n);
      b.setAttribute('aria-label',
        v === 0 ? 'Colocar o contador no zero'
                : 'Colocar o contador em ' + Math.abs(v) + ' de ' + (v < 0 ? 'A' : 'B'));
      frag.appendChild(b);
      cells.push(b);
    }
    el.track.appendChild(frag);
  }

  function buildPads() {
    ['a', 'b'].forEach(function (p) {
      var frag = document.createDocumentFragment();
      COSTS.forEach(function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = String(n);
        b.dataset.act = 'pay';
        b.dataset.player = p;
        b.dataset.n = String(n);
        frag.appendChild(b);
      });
      el.pad[p].appendChild(frag);
    });
  }

  /* ---------------------------------------------------------
     Ações
     --------------------------------------------------------- */

  function snapshot() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }

  // Pagar empurra o contador em direção ao oponente.
  function pay(p, n) {
    if (!n) return;
    snapshot();
    state.mem = clamp(state.mem - dir(p) * n);
    settle();
  }

  // Ganhar traz o contador de volta para o próprio lado.
  function gain(p, n) {
    if (!n) return;
    snapshot();
    state.mem = clamp(state.mem + dir(p) * n);
    settle();
  }

  // Encerrar a fase principal com o contador em 0 ou do próprio lado
  // entrega 3 de memória ao oponente.
  function endTurn(p) {
    if (p !== state.turn) return;
    snapshot();
    state.mem = dir(other(p)) * PASS;
    settle();
  }

  // Ajuste manual pela régua.
  function setMem(v) {
    v = clamp(v);
    if (v === state.mem) return;
    snapshot();
    state.mem = v;
    var s = sideOf(v);
    if (s) state.turn = s;
    persist();
    render();
  }

  // Move o contador uma casa (usado pelas setas do teclado).
  function nudge(delta) {
    setMem(state.mem + delta);
  }

  /* O turno passa assim que o contador entra no lado do oponente,
     que recebe exatamente a memória empurrada — sem piso nenhum. */
  function settle() {
    var s = sideOf(state.mem);
    var changed = false;

    if (s && s !== state.turn) {
      state.turn = s;
      state.turnNo++;
      changed = true;
    }

    persist();
    render();

    if (changed) {
      announceTurn(s);
    }
  }

  function announceTurn(p) {
    toast('Turno de ' + nameOf(p) + ' &middot; ' + memOf(p) + ' de memória', true);
    if (settings.vibrate && navigator.vibrate) {
      try { navigator.vibrate([18, 45, 18]); } catch (e) { /* sem suporte */ }
    }
  }

  function undo() {
    var snap = undoStack.pop();
    if (!snap) { toast('Nada para desfazer'); return; }
    state = JSON.parse(snap);
    persist();
    render();
  }

  function newGame(first) {
    undoStack = [];
    state = freshState(first);
    persist();
    render();
    toast(nameOf(first) + ' começa a partida com a memória em 0');
  }

  /* ---------------------------------------------------------
     Sorteio de quem começa
     -----------------------------------------------------------
     Cara ou coroa: o lado sai de Math.random() ANTES da animação,
     e o giro só encena o resultado. As duas luzes ficam a 180°
     uma da outra, então parar em N voltas cheias deixa a azul no
     marcador, e N voltas + meia deixa a laranja.
     --------------------------------------------------------- */

  var SPIN_MS = 5000;
  var VOLTAS = 10;
  var drawTimers = [];

  function clearDrawTimers() {
    drawTimers.forEach(clearTimeout);
    drawTimers = [];
  }

  function semMovimento() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function drawFirstPlayer() {
    var winner = Math.random() < 0.5 ? 'a' : 'b';
    var rapido = semMovimento();
    var giro = rapido ? 0 : SPIN_MS;

    clearDrawTimers();
    el.draw.classList.remove('is-spinning', 'is-done', 'side-a', 'side-b');
    el.drawStatus.textContent = 'Sorteando quem começa';

    /* reinicia a animação: sem isso o segundo sorteio não roda de novo */
    void el.drawDisc.offsetWidth;
    el.drawDisc.style.setProperty('--turns', (VOLTAS * 360 + (winner === 'b' ? 180 : 0)) + 'deg');
    if (!rapido) el.draw.classList.add('is-spinning');

    openDialog(el.dlgDraw);

    drawTimers.push(setTimeout(function () {
      el.draw.classList.add('is-done', 'side-' + winner);
      el.drawStatus.textContent = 'Começa ' + nameOf(winner);
      if (settings.vibrate && navigator.vibrate) {
        try { navigator.vibrate([30, 60, 30]); } catch (e) { /* sem suporte */ }
      }
      newGame(winner);
    }, giro));

    /* deixa o resultado na tela um instante antes de sair */
    drawTimers.push(setTimeout(function () {
      if (el.dlgDraw.open) el.dlgDraw.close();
    }, giro + 1900));
  }

  /* ---------------------------------------------------------
     Render
     --------------------------------------------------------- */

  var lastMem = null;

  function render() {
    var side = sideOf(state.mem);
    var turn = state.turn;

    // números dos jogadores
    ['a', 'b'].forEach(function (p) {
      var v = memOf(p);
      var node = el.mem[p];
      if (node.textContent !== String(v)) {
        node.textContent = String(v);
        if (lastMem !== null) {
          node.classList.remove('bump');
          void node.offsetWidth;      // reinicia a animação
          node.classList.add('bump');
        }
      }
      node.classList.toggle('is-zero', v === 0);

      el.name[p].textContent = nameOf(p);
      el.end[p].textContent = nameOf(p);
      el.panel[p].classList.toggle('is-turn', turn === p);
      el.endturn[p].disabled = turn !== p;
    });

    // faixa de turno
    el.turnName.textContent = nameOf(turn);
    el.turnName.className = 'turn__name side-' + turn;
    el.turnMeta.textContent =
      'turno ' + state.turnNo + ' · ' + memOf(turn) + ' de memória disponível';

    /* o diálogo de informação carrega o mesmo conteúdo, para quando a
       faixa de turno estiver escondida (paisagem) */
    el.info.turnNo.textContent = String(state.turnNo);
    el.info.turnName.textContent = nameOf(turn);
    el.info.turnName.className = 'info__value side-' + turn;
    el.info.mem.textContent = String(memOf(turn));
    el.info.mem.className = 'info__value info__value--big side-' + turn;

    // régua
    for (var i = 0; i < cells.length; i++) {
      var v = i - MAX;
      var filled =
        (state.mem < 0 && v >= state.mem && v < 0) ||
        (state.mem > 0 && v <= state.mem && v > 0);
      var c = cells[i];
      c.classList.toggle('is-filled', filled);
      c.classList.toggle('side-a', filled && v < 0);
      c.classList.toggle('side-b', filled && v > 0);
      c.classList.toggle('is-active', v === state.mem);
    }

    /* a tira desliza para pôr a casa atual no centro da janela */
    el.track.style.setProperty('--i', String(state.mem + MAX));
    el.gaugeViewport.classList.toggle('side-a', side === 'a');
    el.gaugeViewport.classList.toggle('side-b', side === 'b');

    el.btnUndo.disabled = undoStack.length === 0;
    lastMem = state.mem;
  }

  function applySettings() {
    el.body.classList.toggle('rotate-opponent', !!settings.rotate);
    el.body.classList.toggle('no-circuit', !settings.circuit);
    el.inpName.a.value = settings.names.a;
    el.inpName.b.value = settings.names.b;
    el.opt.rotate.checked = !!settings.rotate;
    el.opt.circuit.checked = !!settings.circuit;
    el.opt.vibrate.checked = !!settings.vibrate;
    el.opt.wake.checked = !!settings.wake;
    el.first.a.textContent = nameOf('a');
    el.first.b.textContent = nameOf('b');
    if (settings.wake) requestWakeLock(); else releaseWakeLock();
  }

  /* ---------------------------------------------------------
     Toast
     --------------------------------------------------------- */

  var toastTimer = null;
  function toast(msg, isHtml) {
    if (isHtml) el.toast.innerHTML = msg; else el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove('show');
    }, 2200);
  }

  /* ---------------------------------------------------------
     Persistência
     --------------------------------------------------------- */

  function persist() {
    try { localStorage.setItem(K_STATE, JSON.stringify(state)); } catch (e) { /* modo privado */ }
  }

  function persistSettings() {
    try { localStorage.setItem(K_SETTINGS, JSON.stringify(settings)); } catch (e) { /* modo privado */ }
  }

  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(K_SETTINGS) || 'null');
      if (s && typeof s === 'object') {
        settings = Object.assign(clone(defaultSettings), s);
        settings.names = Object.assign(clone(defaultSettings.names), s.names || {});
      }
    } catch (e) { /* ignora dados corrompidos */ }

    try {
      var g = JSON.parse(localStorage.getItem(K_STATE) || 'null');
      if (g && typeof g.mem === 'number' && (g.turn === 'a' || g.turn === 'b')) {
        state = { mem: clamp(g.mem), turn: g.turn, turnNo: g.turnNo || 1 };
      }
    } catch (e) { /* ignora dados corrompidos */ }
  }

  /* ---------------------------------------------------------
     Tela ligada
     --------------------------------------------------------- */

  var wakeLock = null;

  function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () { /* negado ou sem suporte */ });
  }

  function releaseWakeLock() {
    if (wakeLock) { try { wakeLock.release(); } catch (e) { /* já liberado */ } wakeLock = null; }
  }

  /* ---------------------------------------------------------
     Eventos
     --------------------------------------------------------- */

  /* Abre um diálogo fechando antes o menu, para não empilhar dois modais. */
  function openDialog(d) {
    if (d !== el.dlgMenu && el.dlgMenu.open) el.dlgMenu.close();
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }

  function bind() {
    // ações dos painéis (delegação: cobre steppers e teclado de custo)
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      var p = btn.dataset.player;
      var n = parseInt(btn.dataset.n || '1', 10);

      switch (act) {
        case 'pay':  pay(p, n); break;
        case 'gain': gain(p, n); break;
        case 'end':  endTurn(p); break;
        case 'undo': undo(); break;
        case 'menu': openDialog(el.dlgMenu); break;
        case 'info': openDialog(el.dlgInfo); break;
        case 'new':  drawFirstPlayer(); break;
        case 'new-manual':
          el.dlgDraw.close();
          openDialog(el.dlgNew);
          break;
        case 'help': openDialog(el.dlgHelp); break;
        case 'settings': openDialog(el.dlgSettings); break;
        case 'rename':
          openDialog(el.dlgSettings);
          var target = btn.id === 'nameB' ? el.inpName.b : el.inpName.a;
          setTimeout(function () { target.focus(); target.select(); }, 60);
          break;
      }
    });

    // régua
    el.track.addEventListener('click', function (ev) {
      var c = ev.target.closest('.cell');
      if (c) setMem(parseInt(c.dataset.v, 10));
    });

    // fechar diálogos
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });

    /* Fechar o sorteio antes da hora cancela: o jogo novo não começa.
       Vale também para o Esc, que fecha o diálogo por fora do botão. */
    el.dlgDraw.addEventListener('close', clearDrawTimers);

    // escolha do jogador inicial
    ['a', 'b'].forEach(function (p) {
      el.first[p].addEventListener('click', function () {
        el.dlgNew.close();
        newGame(p);
      });
    });

    // ajustes
    ['a', 'b'].forEach(function (p) {
      el.inpName[p].addEventListener('input', function () {
        settings.names[p] = el.inpName[p].value.trim() || defaultSettings.names[p];
        persistSettings();
        el.first[p].textContent = nameOf(p);
        render();
      });
    });

    el.opt.rotate.addEventListener('change', function () {
      settings.rotate = el.opt.rotate.checked;
      persistSettings();
      el.body.classList.toggle('rotate-opponent', settings.rotate);
    });
    el.opt.circuit.addEventListener('change', function () {
      settings.circuit = el.opt.circuit.checked;
      persistSettings();
      el.body.classList.toggle('no-circuit', !settings.circuit);
    });
    el.opt.vibrate.addEventListener('change', function () {
      settings.vibrate = el.opt.vibrate.checked;
      persistSettings();
    });
    el.opt.wake.addEventListener('change', function () {
      settings.wake = el.opt.wake.checked;
      persistSettings();
      if (settings.wake) requestWakeLock(); else releaseWakeLock();
    });

    // teclado
    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.isContentEditable)) return;
      if (document.querySelector('dialog[open]') && ev.key !== 'Escape') return;

      var k = ev.key;

      if (k >= '1' && k <= '9') { pay(state.turn, parseInt(k, 10)); ev.preventDefault(); return; }

      switch (k.toLowerCase()) {
        case 'g': gain(state.turn, 1); ev.preventDefault(); break;
        case 'arrowleft':  nudge(-1); ev.preventDefault(); break;
        case 'arrowright': nudge(1);  ev.preventDefault(); break;
        case ' ':
        case 'enter': endTurn(state.turn); ev.preventDefault(); break;
        case 'z': undo(); ev.preventDefault(); break;
        case 'm': openDialog(el.dlgMenu); ev.preventDefault(); break;
        case 'i': openDialog(el.dlgInfo); ev.preventDefault(); break;
        case 'n': drawFirstPlayer(); ev.preventDefault(); break;
        case '?': openDialog(el.dlgHelp); ev.preventDefault(); break;
      }
    });

    // reaquisição do wake lock ao voltar para a aba
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && settings.wake) requestWakeLock();
    });

    // evita zoom por duplo toque durante a partida
    document.addEventListener('dblclick', function (ev) { ev.preventDefault(); }, { passive: false });
  }

  /* ---------------------------------------------------------
     Service worker
     --------------------------------------------------------- */

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* offline indisponível */ });
    });
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */

  function init() {
    cacheDom();
    buildTrack();
    buildPads();
    restore();
    applySettings();
    bind();
    render();
    registerSW();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
