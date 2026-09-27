/* doesbradpittdie.com : the game (daily challenge, career run, quick ten) */
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('quiz-data').textContent);
  var BY = {}; DATA.forEach(function (f) { BY[f.s] = f; });
  var KEY = 'dbpd:play:v1';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- storage */
  function blank() { return { daily: {}, best: {}, played: 0, answered: 0, correct: 0, run: null }; }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') { var b = blank(); for (var k in b) if (!(k in s)) s[k] = b[k]; return s; } } catch (e) { /* ignore */ }
    return blank();
  }
  var S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }

  /* ---------- seeded randomness so the daily is the same for everyone */
  function hash(str) { var h = 1779033703 ^ str.length; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var TODAY = dayKey();

  /* ---------- questions */
  var CHAR_POOL = DATA.filter(function (f) { return (f.r === 'lead' || f.r === 'supporting') && f.c && !/himself|sort of/i.test(f.c); });
  function vQ(f) { return { k: 'v', s: f.s }; }
  function cQ(f, r) {
    var others = shuffle(CHAR_POOL.filter(function (x) { return x.s !== f.s && x.c !== f.c; }), r).slice(0, 3).map(function (x) { return x.c; });
    return { k: 'c', s: f.s, o: shuffle([f.c].concat(others), r) };
  }
  function mixed(r, n) {
    var picks = shuffle(DATA, r).slice(0, n);
    return picks.map(function (f, i) { return (i % 3 === 2 && CHAR_POOL.indexOf(f) > -1) ? cQ(f, r) : vQ(f); });
  }
  function buildQs(mode) {
    if (mode === 'daily') return mixed(rng(hash('dbpd-daily-' + TODAY)), 10);
    if (mode === 'quick') return mixed(rng((Math.random() * 4294967296) >>> 0), 10);
    return DATA.map(vQ); /* career: data is already in release order */
  }
  var MODE_NAME = { daily: 'Daily challenge', career: 'Beginning to end', quick: 'Quick ten' };
  var V_OPTS = [['dies', 'He dies'], ['survives', 'He survives'], ['ambiguous', "It's complicated"]];
  var V_WORD = { dies: 'He dies.', survives: 'He survives.', ambiguous: "It's complicated." };

  /* ---------- formatting */
  function fmt(ms) {
    var t = Math.max(0, Math.round(ms / 100)), d = t % 10, s = Math.floor(t / 10) % 60, m = Math.floor(t / 600);
    return m + ':' + String(s).padStart(2, '0') + '.' + d;
  }
  function num(n) { return Number(n || 0).toLocaleString('en-US'); }

  /* ---------- screens */
  var intro = $('#intro'), game = $('#game'), result = $('#result');
  function show(el) {
    [intro, game, result].forEach(function (x) { x.hidden = x !== el; });
    el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in');
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- intro: statuses and record */
  function dailyStreak() {
    var n = 0, d = new Date();
    if (!S.daily[dayKey(d)]) d.setDate(d.getDate() - 1); /* today not played yet: streak can still be alive */
    while (S.daily[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderIntro() {
    $('[data-today]').textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var d = S.daily[TODAY];
    var dBtn = $('[data-start="daily"]');
    if (d) {
      $('[data-daily-status]').textContent = 'Done today: ' + d.correct + ' of ' + d.total + ', ' + num(d.score) + ' points in ' + fmt(d.time) + '. New ten at midnight.';
      dBtn.textContent = 'Replay for practice';
      $('[data-share-daily]').hidden = false;
    } else {
      $('[data-daily-status]').textContent = 'Mixed questions: endings and characters. Your first try is the one that counts.';
      dBtn.textContent = "Play today's ten";
      $('[data-share-daily]').hidden = true;
    }
    var bc = S.best.career, cont = $('[data-continue]');
    if (S.run && S.run.mode === 'career') {
      cont.hidden = false;
      cont.textContent = 'Continue at ' + (S.run.i + 1) + ' of ' + S.run.qs.length;
      $('[data-start="career"]').textContent = 'Start over';
    } else {
      cont.hidden = true;
      $('[data-start="career"]').textContent = 'Start the career run';
    }
    $('[data-career-status]').textContent = bc
      ? 'Best: ' + num(bc.score) + ' points, ' + bc.correct + ' of ' + bc.total + '. Fastest finish ' + fmt(bc.fastest) + '.'
      : 'Leave whenever you like. Your run is saved where you stopped.';
    var bq = S.best.quick;
    $('[data-quick-status]').textContent = bq
      ? 'Best: ' + num(bq.score) + ' points. Fastest ' + fmt(bq.fastest) + '.'
      : 'Good for practice before the daily.';
    var acc = S.answered ? Math.round(S.correct / S.answered * 100) : 0;
    $('[data-stats]').innerHTML =
      stat(S.played, 'games played') + stat(S.answered ? acc + '<small>%</small>' : '0', 'accuracy') +
      stat(dailyStreak(), 'day streak') + stat(bestOf('score'), 'best score');
  }
  function stat(n, l) { return '<div class="bignum"><span class="bn-n">' + n + '</span><span class="bn-l">' + l + '</span></div>'; }
  function bestOf(k) { var m = 0; for (var mode in S.best) m = Math.max(m, S.best[mode][k] || 0); return num(m); }

  /* ---------- game state */
  var G = null, raf = 0;
  function start(mode, resume) {
    if (resume && S.run) {
      G = S.run; G.ranked = true;
    } else {
      if (mode === 'career') S.run = null;
      G = { mode: mode, qs: buildQs(mode), i: 0, score: 0, correct: 0, combo: 0, bestCombo: 0, elapsed: 0, marks: [],
            ranked: mode !== 'daily' || !S.daily[TODAY] };
    }
    $('[data-mode-label]').textContent = MODE_NAME[G.mode] + (G.ranked ? '' : ' (practice)');
    $('[data-quit]').textContent = G.mode === 'career' ? 'Save and quit' : 'Quit';
    show(game);
    ask();
  }
  function persistRun() { if (G && G.mode === 'career') { S.run = G; save(); } }

  function tick() {
    if (!G || G.qStart == null) return;
    $('[data-time]').textContent = fmt(G.elapsed + (performance.now() - G.qStart));
    raf = requestAnimationFrame(tick);
  }
  function ask() {
    var q = G.qs[G.i], f = BY[q.s];
    if (!f) { G.i++; return G.i < G.qs.length ? ask() : finish(); }
    $('[data-q]').textContent = (G.i + 1) + ' / ' + G.qs.length;
    $('[data-score]').textContent = num(G.score);
    $('[data-progress]').style.width = (G.i / G.qs.length * 100) + '%';
    var box = $('[data-poster-box]');
    box.innerHTML = f.p
      ? '<img src="' + f.p + '" alt="' + esc(f.t) + ' poster" width="600" height="900">'
      : '<div class="poster-fallback"><span>' + esc(f.t) + '</span><small>' + f.y + '</small></div>';
    $('[data-meta]').textContent = f.y + ' · ' + (f.ty === 'tv' ? 'Television' : 'Film') + (q.k === 'v' && f.c ? ' · as ' + f.c : '');
    $('[data-title]').textContent = f.t;
    $('[data-prompt]').textContent = q.k === 'v' ? 'Does he make it?' : 'Who does he play?';
    var opts = q.k === 'v' ? V_OPTS : q.o.map(function (c) { return [c, c]; });
    $('[data-opts]').innerHTML = opts.map(function (o, i) {
      return '<button type="button" class="q-opt" data-a="' + esc(o[0]) + '"><kbd>' + (i + 1) + '</kbd>' + esc(o[1]) + '</button>';
    }).join('');
    $('[data-opts]').className = 'q-opts' + (q.k === 'c' ? ' is-four' : '');
    $('[data-feedback]').hidden = true;
    var card = $('.q-card'); card.classList.remove('is-in', 'is-right', 'is-wrong'); void card.offsetWidth; card.classList.add('is-in');
    G.qStart = performance.now();
    G.answered = false;
    cancelAnimationFrame(raf); tick();
    var first = $('.q-opt'); if (first && window.matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
  }
  function answer(val) {
    if (!G || G.answered) return;
    G.answered = true;
    var q = G.qs[G.i], f = BY[q.s];
    var spent = performance.now() - G.qStart;
    G.elapsed += spent; G.qStart = null; cancelAnimationFrame(raf);
    $('[data-time]').textContent = fmt(G.elapsed);
    var truth = q.k === 'v' ? f.v : f.c;
    var right = val === truth;
    var gained = 0;
    if (right) {
      G.correct++; G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
      gained = 100 + Math.round(50 * Math.max(0, 1 - spent / 12000)) + Math.min(G.combo - 1, 5) * 10;
      G.score += gained;
    } else { G.combo = 0; }
    G.marks.push(right ? 1 : 0);
    $$('.q-opt').forEach(function (b) {
      b.disabled = true;
      if (b.dataset.a === truth) b.classList.add('is-truth');
      else if (b.dataset.a === val) b.classList.add('is-miss');
    });
    $('.q-card').classList.add(right ? 'is-right' : 'is-wrong');
    $('[data-fb-call]').textContent = right ? 'Right call  +' + gained : 'Not this time';
    $('[data-fb-call]').className = 'fb-call ' + (right ? 'is-right' : 'is-wrong');
    $('[data-fb-text]').textContent = q.k === 'v'
      ? (f.vs || V_WORD[f.v])
      : 'He plays ' + f.c + '. ' + (V_WORD[f.v] || '');
    $('[data-combo]').textContent = G.combo > 1 ? G.combo + ' in a row' : '';
    $('[data-score]').textContent = num(G.score);
    $('[data-next]').textContent = G.i + 1 < G.qs.length ? 'Next' : 'See your result';
    $('[data-feedback]').hidden = false;
    $('[data-progress]').style.width = ((G.i + 1) / G.qs.length * 100) + '%';
    G.i++;
    persistRun();
    $('[data-next]').focus({ preventScroll: true });
  }
  function next() { if (!G) return; if (G.i < G.qs.length) ask(); else finish(); }

  function finish() {
    cancelAnimationFrame(raf);
    var total = G.qs.length, rec = { score: G.score, correct: G.correct, total: total, time: G.elapsed, combo: G.bestCombo, date: TODAY };
    var notes = [];
    if (G.ranked) {
      S.played++; S.answered += total; S.correct += G.correct;
      if (G.mode === 'daily') S.daily[TODAY] = { score: rec.score, correct: rec.correct, total: total, time: rec.time, marks: G.marks };
      var b = S.best[G.mode] || { score: 0, fastest: 0, correct: 0, total: total };
      if (rec.score > b.score) { b.score = rec.score; b.correct = rec.correct; b.total = total; if (S.best[G.mode]) notes.push('New best score.'); }
      if (!b.fastest || rec.time < b.fastest) { if (b.fastest) notes.push('Fastest finish yet.'); b.fastest = rec.time; }
      S.best[G.mode] = b;
      if (G.mode === 'career') S.run = null;
      save();
    } else { notes.push('Practice round. Your first daily score stands.'); }
    G.last = rec;
    $('[data-r-kicker]').textContent = MODE_NAME[G.mode] + (G.mode === 'daily' ? ' · ' + TODAY : '');
    var pct = rec.correct / total;
    $('[data-r-title]').textContent = pct === 1 ? 'Flawless' : pct >= .8 ? 'Sharp eye' : pct >= .5 ? 'Solid run' : 'Tough crowd';
    $('[data-r-score]').textContent = num(rec.score);
    $('[data-r-correct]').innerHTML = rec.correct + '<small>/' + total + '</small>';
    $('[data-r-time]').textContent = fmt(rec.time);
    $('[data-r-combo]').textContent = rec.combo;
    if (G.mode === 'daily' && G.ranked) notes.push('Day streak: ' + dailyStreak() + '.');
    $('[data-r-best]').textContent = notes.join(' ');
    $('[data-r-grid]').innerHTML = G.marks.map(function (m) { return '<i class="' + (m ? 'm-right' : 'm-wrong') + '"></i>'; }).join('');
    $('[data-share-msg]').textContent = '';
    show(result);
  }

  /* ---------- sharing */
  function shareText(mode, rec, marks) {
    var squares = marks.map(function (m) { return m ? '🟧' : '⬛'; }).join('');
    if (squares.length > 20) squares = squares.slice(0, 40) + '…';
    return 'Does Brad Pitt Die? ' + MODE_NAME[mode] + (mode === 'daily' ? ' ' + TODAY : '') + '\n' +
      rec.correct + '/' + rec.total + ' · ' + num(rec.score) + ' pts · ' + fmt(rec.time) + '\n' + squares + '\ndoesbradpittdie.com/play/';
  }
  function copy(text) {
    var msg = $('[data-share-msg]');
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      navigator.share({ text: text }).catch(function () {});
      return;
    }
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () { msg.textContent = 'Copied. Paste it anywhere.'; })
      .catch(function () { msg.textContent = text; });
  }

  /* ---------- wiring */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var st = t.closest('[data-start]');
    if (st) return start(st.dataset.start, false);
    if (t.closest('[data-continue]')) return start('career', true);
    var o = t.closest('.q-opt'); if (o) return answer(o.dataset.a);
    if (t.closest('[data-next]')) return next();
    if (t.closest('[data-quit]')) {
      cancelAnimationFrame(raf);
      if (G && G.qStart != null) { G.elapsed += performance.now() - G.qStart; G.qStart = null; }
      persistRun(); G = null; renderIntro(); return show(intro);
    }
    if (t.closest('[data-again]')) { var m = G ? G.mode : 'quick'; return start(m, false); }
    if (t.closest('[data-menu]')) { G = null; renderIntro(); return show(intro); }
    if (t.closest('[data-share]') && G && G.last) return copy(shareText(G.mode, G.last, G.marks));
    if (t.closest('[data-share-daily]')) { var d = S.daily[TODAY]; if (d) { show(result); $('[data-share-msg]').textContent = ''; copy(shareText('daily', d, d.marks || [])); renderDailyResult(d); } return; }
    if (t.closest('[data-reset]')) { $('[data-reset-confirm]').hidden = false; $('[data-reset]').hidden = true; return; }
    if (t.closest('[data-reset-no]')) { $('[data-reset-confirm]').hidden = true; $('[data-reset]').hidden = false; return; }
    if (t.closest('[data-reset-yes]')) {
      S = blank(); save(); $('[data-reset-confirm]').hidden = true; $('[data-reset]').hidden = false; renderIntro();
      $('[data-stats]').classList.add('is-cleared'); setTimeout(function () { $('[data-stats]').classList.remove('is-cleared'); }, 900);
    }
  });
  function renderDailyResult(d) {
    G = { mode: 'daily', marks: d.marks || [], last: { score: d.score, correct: d.correct, total: d.total, time: d.time }, ranked: true };
    $('[data-r-kicker]').textContent = 'Daily challenge · ' + TODAY;
    $('[data-r-title]').textContent = 'Today’s result';
    $('[data-r-score]').textContent = num(d.score);
    $('[data-r-correct]').innerHTML = d.correct + '<small>/' + d.total + '</small>';
    $('[data-r-time]').textContent = fmt(d.time);
    $('[data-r-combo]').textContent = '–';
    $('[data-r-best]').textContent = 'Day streak: ' + dailyStreak() + '.';
    $('[data-r-grid]').innerHTML = (d.marks || []).map(function (m) { return '<i class="' + (m ? 'm-right' : 'm-wrong') + '"></i>'; }).join('');
  }
  document.addEventListener('keydown', function (ev) {
    if (game.hidden || !G) return;
    if (/^[1-4]$/.test(ev.key) && !G.answered) {
      var b = $$('.q-opt')[+ev.key - 1]; if (b) { ev.preventDefault(); answer(b.dataset.a); }
    } else if ((ev.key === 'Enter' || ev.key === ' ') && G.answered && document.activeElement && !document.activeElement.closest('[data-next]')) {
      ev.preventDefault(); next();
    }
  });
  /* pause the clock when the tab is hidden */
  document.addEventListener('visibilitychange', function () {
    if (!G || game.hidden) return;
    if (document.hidden && G.qStart != null) { G.elapsed += performance.now() - G.qStart; G.qStart = null; cancelAnimationFrame(raf); persistRun(); }
    else if (!document.hidden && !G.answered && G.qStart == null) { G.qStart = performance.now(); tick(); }
  });
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  renderIntro();
  if (/[?&]mode=(daily|quick|career)/.test(location.search)) start(RegExp.$1, false);
})();
