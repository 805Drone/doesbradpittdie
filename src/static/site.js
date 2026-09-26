/* doesbradpittdie.com — reveal state, search, hero rotor, guessing */
(function () {
  'use strict';
  var KEY = 'dbpd:v1';
  var state = load();

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { revealed: s.revealed || {}, all: !!s.all, guesses: s.guesses || { right: 0, wrong: 0, streak: 0, best: 0 } };
    } catch (e) {
      return { revealed: {}, all: false, guesses: { right: 0, wrong: 0, streak: 0, best: 0 } };
    }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: fine */ } }
  function isRevealed(slug) { return state.all || !!state.revealed[slug]; }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- global seal toggle */
  function applyAll() {
    document.documentElement.classList.toggle('all-revealed', state.all);
    var btn = document.querySelector('[data-seal-toggle]');
    if (btn) btn.setAttribute('aria-pressed', String(state.all));
    document.querySelectorAll('.card').forEach(function (card) {
      if (!card.classList.contains('is-unreleased')) card.classList.toggle('is-revealed', isRevealed(card.dataset.slug));
    });
    document.querySelectorAll('.tease-n').forEach(function (n) {
      n.textContent = state.all ? n.dataset.count : '?';
    });
    var film = document.querySelector('.film');
    if (film) syncFilm(film, false);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-seal-toggle]');
    if (!t) return;
    state.all = !state.all;
    save();
    applyAll();
    filterGrid();
  });

  /* ---------- grid cards */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('.card .reveal-btn');
    if (!b) return;
    var card = b.closest('.card');
    var slug = card.dataset.slug;
    if (card.classList.contains('is-revealed')) {
      if (state.all) return; // sealing one while "reveal all" is on makes no sense
      delete state.revealed[slug];
      card.classList.remove('is-revealed');
    } else {
      state.revealed[slug] = 1;
      card.classList.add('is-revealed');
    }
    save();
    filterGrid(true);
  });

  /* ---------- search + filters */
  var q = document.getElementById('q');
  var chips = document.querySelectorAll('.chip');
  var filter = 'all';
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function filterGrid(keepCount) {
    var cards = document.querySelectorAll('.card');
    if (!cards.length) return;
    var term = norm(q && q.value.trim());
    var shown = 0;
    cards.forEach(function (c) {
      var ok = true;
      if (filter === 'film' || filter === 'tv') ok = c.dataset.type === filter;
      if (filter === 'revealed') ok = c.classList.contains('is-revealed');
      if (ok && term) ok = norm(c.dataset.title).indexOf(term) > -1 || norm(c.dataset.character).indexOf(term) > -1 || c.dataset.year.indexOf(term) > -1;
      c.classList.toggle('is-hidden', !ok);
      if (ok) shown++;
    });
    document.querySelectorAll('.decade').forEach(function (d) {
      d.hidden = !d.querySelector('.card:not(.is-hidden)');
    });
    var empty = document.getElementById('empty');
    if (empty) empty.hidden = shown > 0;
    var rc = document.getElementById('result-count');
    if (rc && !keepCount) {
      rc.textContent = (term || filter !== 'all') ? shown + (shown === 1 ? ' title' : ' titles') : '';
    }
  }
  if (q) {
    q.addEventListener('input', function () { filterGrid(); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; filterGrid(); } });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== q && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
    });
  }
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      filter = ch.dataset.filter;
      chips.forEach(function (c) { c.classList.toggle('is-on', c === ch); c.setAttribute('aria-pressed', String(c === ch)); });
      filterGrid();
    });
  });

  /* ---------- hero rotor */
  var rotor = document.querySelector('.rotor');
  if (rotor && !reduce) {
    var titles;
    try { titles = JSON.parse(rotor.dataset.titles); } catch (e) { titles = []; }
    var word = rotor.querySelector('.rotor-word');
    var i = Math.floor(Math.random() * titles.length);
    if (titles.length) word.textContent = titles[i];
    setInterval(function () {
      if (document.hidden) return;
      rotor.classList.add('is-out');
      setTimeout(function () {
        i = (i + 1 + Math.floor(Math.random() * 5)) % titles.length;
        word.textContent = titles[i];
        rotor.classList.remove('is-out');
      }, 340);
    }, 2600);
  }

  /* ---------- film page */
  var film = document.querySelector('.film');
  function syncFilm(film, animate) {
    if (film.classList.contains('is-unreleased')) return;
    var slug = film.dataset.slug;
    var seal = film.querySelector('[data-seal]');
    var verdict = film.querySelector('.verdict');
    var open = isRevealed(slug);
    seal.hidden = open;
    verdict.hidden = !open;
    if (open) {
      if (animate && !reduce) {
        verdict.classList.remove('is-open');
        void verdict.offsetWidth; // flush so the curtain starts closed
        setTimeout(function () { verdict.classList.add('is-open'); }, 40);
      } else {
        verdict.classList.add('is-open');
      }
    } else {
      verdict.classList.remove('is-open');
      var gr = film.querySelector('[data-guess-result]');
      if (gr) gr.textContent = '';
    }
    var streak = film.querySelector('[data-streak]');
    if (streak) {
      var g = state.guesses;
      var total = g.right + g.wrong;
      streak.hidden = total === 0;
      if (total) streak.textContent = 'Your guesses: ' + g.right + ' of ' + total + ' right. Current streak ' + g.streak + ', best ' + g.best + '.';
    }
  }
  if (film) {
    syncFilm(film, false);
    film.addEventListener('click', function (ev) {
      var g = ev.target.closest('.guess-btn');
      var r = ev.target.closest('[data-reveal]');
      var rs = ev.target.closest('[data-reseal]');
      var slug = film.dataset.slug;
      if (g) {
        var actual = film.dataset.verdict;
        var guess = g.dataset.guess;
        var right = actual === guess;
        var msg;
        if (actual === 'ambiguous') { msg = 'Trick question. This one is complicated. No points either way.'; }
        else if (right) { state.guesses.right++; state.guesses.streak++; state.guesses.best = Math.max(state.guesses.best, state.guesses.streak); msg = 'You called it.'; }
        else { state.guesses.wrong++; state.guesses.streak = 0; msg = 'Not this time.'; }
        state.revealed[slug] = 1;
        save();
        syncFilm(film, true);
        film.querySelector('[data-guess-result]').textContent = msg;
      } else if (r) {
        state.revealed[slug] = 1;
        save();
        syncFilm(film, true);
      } else if (rs) {
        delete state.revealed[slug];
        if (state.all) { state.all = false; applyAll(); }
        save();
        syncFilm(film, false);
        var s = film.querySelector('[data-seal]');
        if (s) s.querySelector('.reveal-big').focus();
      }
    });
    var clip = film.querySelector('.clip');
    if (clip) {
      clip.querySelector('.clip-btn').addEventListener('click', function () {
        var id = clip.dataset.clip;
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
        f.title = 'The scene';
        f.allow = 'autoplay; encrypted-media; picture-in-picture';
        f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        this.replaceWith(f);
      });
    }
  }

  applyAll();
  filterGrid();
})();
