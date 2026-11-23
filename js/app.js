/* 미니게임 모음 - 공통 프레임워크
 * 각 게임은 registerGame({...}) 으로 등록합니다.
 *
 * 게임 정의:
 *   id, title, emoji, color, desc, howTo
 *   best:   'high' (높을수록 좋음) | 'low' (낮을수록 좋음) | null (기록 없음)
 *   format: (score) => 표시용 문자열
 *   start(api): 게임 시작. api 는 아래 makeApi() 참고.
 */
(function () {
  'use strict';

  const games = [];
  window.registerGame = function (game) { games.push(game); };

  const $ = (id) => document.getElementById(id);

  // ---------- 저장소 ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('minigames:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('minigames:' + key, JSON.stringify(value)); } catch (e) { /* 무시 */ }
    },
  };

  // ---------- 소리 ----------
  let audioCtx = null;
  let soundOn = store.get('sound', true);

  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur, type, vol, delay) {
    const ac = getAudio();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    tap: () => tone(660, 0.07, 'triangle', 0.15),
    pop: () => tone(500 + Math.random() * 400, 0.08, 'square', 0.06),
    good: () => { tone(784, 0.09, 'triangle', 0.15); tone(1047, 0.12, 'triangle', 0.15, 0.08); },
    bad: () => tone(160, 0.2, 'sawtooth', 0.08),
    tick: () => tone(880, 0.08, 'sine', 0.12),
    go: () => tone(1320, 0.18, 'sine', 0.15),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, i * 0.11)),
  };

  function sound(name) {
    if (!soundOn || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) { /* 무시 */ }
  }

  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 무시 */ }
  }

  // ---------- 배경음악 (직접 만든 곡을 브라우저가 연주) ----------
  // 음 높이는 MIDI 번호 (60 = 도), null 은 쉼표. 한 칸 = 8분음표.
  const TRACKS = {
    menu: {
      bpm: 116,
      lead: 'triangle',
      melody: [
        72, null, 76, null, 79, null, 76, null,
        69, null, 72, null, 76, null, 74, 72,
        65, null, 69, null, 72, null, 74, null,
        74, null, 71, null, 67, null, null, null,
        72, null, 76, null, 79, null, 81, 79,
        76, null, 72, null, 69, null, 72, null,
        77, null, 76, null, 74, null, 72, null,
        74, null, 71, 74, 72, null, null, null,
      ],
      roots: [48, 45, 41, 43, 48, 45, 41, 43],
      bass: [0, null, 12, null, 0, null, 12, null],
      drums: 'k.s.k.s.',
      hats: true,
    },
    game: {
      bpm: 150,
      lead: 'square',
      melody: [
        72, 72, 79, 79, 81, 79, 76, null,
        74, 74, 79, 79, 83, 79, 74, null,
        76, null, 72, 76, 81, null, 79, 76,
        77, 76, 74, 72, 74, null, 67, null,
        72, 76, 79, 84, 79, 76, 72, null,
        71, 74, 79, 83, 79, 74, 71, null,
        69, 72, 76, 81, 79, 76, 72, 69,
        65, 69, 72, 77, 74, 71, 67, null,
      ],
      roots: [48, 43, 45, 41, 48, 43, 45, 41],
      bass: [0, 0, 12, 0, 0, 0, 12, 0],
      drums: 'k.s.kks.',
      hats: true,
    },
  };

  const music = {
    on: store.get('music', true),
    want: null, // 'menu' | 'game'
    track: null,
    gain: null,
    noise: null,
    timer: null,
    step: 0,
    nextTime: 0,
  };

  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function musicOut(ac) {
    if (!music.gain) {
      music.gain = ac.createGain();
      music.gain.gain.value = 0.55;
      music.gain.connect(ac.destination);
      const len = Math.floor(ac.sampleRate * 0.3);
      music.noise = ac.createBuffer(1, len, ac.sampleRate);
      const data = music.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return music.gain;
  }

  function synthNote(ac, out, freq, t, dur, type, vol) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function drum(ac, out, kind, t) {
    if (kind === 'k') {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.16);
      return;
    }
    const src = ac.createBufferSource();
    src.buffer = music.noise;
    const filter = ac.createBiquadFilter();
    const g = ac.createGain();
    const isSnare = kind === 's';
    filter.type = isSnare ? 'bandpass' : 'highpass';
    filter.frequency.value = isSnare ? 1800 : 7000;
    const dur = isSnare ? 0.12 : 0.04;
    g.gain.setValueAtTime(isSnare ? 0.16 : 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  function scheduleStep(ac, out, tr, i, t, eighth) {
    const note = tr.melody[i % tr.melody.length];
    if (note !== null) synthNote(ac, out, midiHz(note), t, eighth * 0.9, tr.lead, tr.lead === 'square' ? 0.035 : 0.07);
    const bar = Math.floor(i / 8) % tr.roots.length;
    const b = tr.bass[i % 8];
    if (b !== null) synthNote(ac, out, midiHz(tr.roots[bar] + b), t, eighth * 0.8, 'triangle', 0.12);
    const d = tr.drums[i % 8];
    if (d !== '.') drum(ac, out, d, t);
    if (tr.hats) drum(ac, out, 'h', t + eighth / 2);
  }

  function musicTick() {
    const ac = audioCtx;
    if (!ac || ac.state !== 'running' || !music.track) return;
    const tr = TRACKS[music.track];
    const eighth = 60 / tr.bpm / 2;
    const out = musicOut(ac);
    if (music.nextTime < ac.currentTime) music.nextTime = ac.currentTime + 0.05;
    while (music.nextTime < ac.currentTime + 0.25) {
      scheduleStep(ac, out, tr, music.step, music.nextTime, eighth);
      music.step++;
      music.nextTime += eighth;
    }
  }

  /** 원하는 곡을 정하고, 소리를 낼 수 있으면 바로 재생 */
  function playMusic(name) {
    music.want = name;
    syncMusic();
  }

  function syncMusic() {
    const target = music.on ? music.want : null;
    if (!target) {
      music.track = null;
      if (music.timer) { clearInterval(music.timer); music.timer = null; }
      return;
    }
    if (!audioCtx) return; // 첫 터치 전에는 소리를 낼 수 없음
    if (music.track !== target) {
      music.track = target;
      music.step = 0;
      music.nextTime = 0;
    }
    if (!music.timer) music.timer = setInterval(musicTick, 50);
    musicTick();
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- 화면 요소 ----------
  let el = {};
  let session = null; // 현재 진행 중인 게임 판

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  }

  function showOverlay(opts) {
    el.ovEmoji.textContent = opts.emoji || '';
    el.ovTitle.textContent = opts.title || '';
    el.ovText.textContent = opts.text || '';
    el.ovBest.textContent = opts.best || '';
    el.ovBest.classList.toggle('new-best', !!opts.newBest);
    el.ovPrimary.textContent = opts.primary || '시작!';
    el.ovPrimary.onclick = () => { sound('tap'); opts.onPrimary(); };
    el.ovSecondary.onclick = () => { sound('tap'); goHome(); };
    el.overlay.classList.remove('hidden');
  }

  function hideOverlay() { el.overlay.classList.add('hidden'); }

  // ---------- 게임 판(세션) 관리 ----------
  function endSession() {
    const s = session;
    if (!s) return;
    s.alive = false;
    s.timeouts.forEach(clearTimeout);
    s.intervals.forEach(clearInterval);
    s.stage.classList.add('frozen');
    session = null;
  }

  function makeApi(game, s) {
    const api = {
      stage: s.stage,
      sound,
      vibrate,
      shuffle,
      /** 상단 오른쪽 정보 표시 (시간, 점수 등) */
      info(text) { if (s.alive) el.hudInfo.textContent = text; },
      /** 게임이 끝나면 자동으로 정리되는 setTimeout */
      timeout(fn, ms) {
        const id = setTimeout(() => { s.timeouts.delete(id); if (s.alive) fn(); }, ms);
        s.timeouts.add(id);
        return id;
      },
      clearTimeout(id) { clearTimeout(id); s.timeouts.delete(id); },
      /** 게임이 끝나면 자동으로 정리되는 setInterval */
      interval(fn, ms) {
        const id = setInterval(() => { if (s.alive) fn(); }, ms);
        s.intervals.add(id);
        return id;
      },
      clearInterval(id) { clearInterval(id); s.intervals.delete(id); },
      /** 매 프레임 fn(dt초, now) 호출. false 를 반환하면 멈춤 */
      loop(fn) {
        let last = performance.now();
        const step = (now) => {
          if (!s.alive) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          if (fn(dt, now) === false) return;
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      /** 3, 2, 1, 시작! 후 cb 호출 */
      countdown(cb) {
        const box = document.createElement('div');
        box.className = 'countdown';
        s.stage.appendChild(box);
        let n = 3;
        const show = (text) => {
          box.innerHTML = '';
          const span = document.createElement('span');
          span.textContent = text;
          box.appendChild(span);
        };
        const tick = () => {
          if (n > 0) {
            show(String(n)); sound('tick'); n--;
            api.timeout(tick, 650);
          } else {
            show('시작!'); sound('go');
            api.timeout(() => { box.remove(); cb(); }, 450);
          }
        };
        tick();
      },
      /** (x, y) 위치에 떠오르는 글자 표시 (+1 등) */
      floatText(text, x, y, color) {
        const f = document.createElement('div');
        f.className = 'float-text';
        f.textContent = text;
        f.style.left = x + 'px';
        f.style.top = y + 'px';
        if (color) f.style.color = color;
        s.stage.appendChild(f);
        setTimeout(() => f.remove(), 800);
      },
      /** 요소를 흔드는 효과 */
      shake(node) {
        node.classList.remove('shake');
        void node.offsetWidth;
        node.classList.add('shake');
      },
      /** 게임 종료. result = { score, text, title?, emoji? } */
      end(result) {
        if (!s.alive) return;
        finish(game, result || {});
      },
    };
    return api;
  }

  function startGame(game) {
    endSession();
    hideOverlay();
    el.stageWrap.innerHTML = '';
    el.hudInfo.textContent = '';
    const stage = document.createElement('div');
    stage.className = 'stage stage-' + game.id;
    el.stageWrap.appendChild(stage);
    session = { alive: true, timeouts: new Set(), intervals: new Set(), stage };
    playMusic('game');
    game.start(makeApi(game, session));
  }

  function finish(game, result) {
    endSession();

    let bestLine = '';
    let isNew = false;
    if (game.best && typeof result.score === 'number') {
      const prev = store.get('best:' + game.id, null);
      const better = prev === null ||
        (game.best === 'high' ? result.score > prev : result.score < prev);
      const meaningful = !(game.best === 'high' && result.score <= 0);
      if (better && meaningful) {
        store.set('best:' + game.id, result.score);
        isNew = true;
        bestLine = '🏆 새로운 최고 기록!';
      } else if (prev !== null) {
        bestLine = '최고 기록: ' + game.format(prev);
      }
    }

    sound(isNew ? 'win' : 'good');
    if (isNew) vibrate([40, 60, 40]);

    showOverlay({
      emoji: result.emoji || (isNew ? '🏆' : game.emoji),
      title: result.title || '끝!',
      text: result.text || '',
      best: bestLine,
      newBest: isNew,
      primary: '다시 하기',
      onPrimary: () => startGame(game),
    });
  }

  function openGame(game) {
    endSession();
    el.stageWrap.innerHTML = '';
    el.hudTitle.textContent = game.emoji + ' ' + game.title;
    el.hudInfo.textContent = '';
    showScreen('play');

    const best = game.best ? store.get('best:' + game.id, null) : null;
    showOverlay({
      emoji: game.emoji,
      title: game.title,
      text: game.howTo,
      best: best !== null ? '최고 기록: ' + game.format(best) : '',
      primary: '시작!',
      onPrimary: () => startGame(game),
    });
  }

  function goHome() {
    endSession();
    hideOverlay();
    el.stageWrap.innerHTML = '';
    renderHome();
    showScreen('home');
    playMusic('menu');
  }

  function renderHome() {
    el.list.innerHTML = '';
    games.forEach((g) => {
      const card = document.createElement('button');
      card.className = 'game-card';
      card.style.setProperty('--c', g.color);
      const best = g.best ? store.get('best:' + g.id, null) : null;
      card.innerHTML =
        '<div class="emoji">' + g.emoji + '</div>' +
        '<div class="name">' + g.title + '</div>' +
        '<div class="desc">' + g.desc + '</div>' +
        (best !== null ? '<div class="best">🏆 ' + g.format(best) + '</div>' : '');
      card.addEventListener('click', () => { sound('tap'); openGame(g); });
      el.list.appendChild(card);
    });
  }

  // ---------- 전체 화면 ----------
  const docEl = document.documentElement;
  const fsSupported = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function toggleFullscreen() {
    try {
      if (isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
        const p = req.call(docEl, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => { /* 브라우저가 거부하면 무시 */ });
      }
    } catch (e) { /* 무시 */ }
  }

  function updateFullscreenButtons() {
    const on = isFullscreen();
    document.querySelectorAll('.fs-btn').forEach((b) => {
      b.classList.toggle('on', on);
      b.setAttribute('aria-label', on ? '전체 화면 끝내기' : '전체 화면');
    });
  }

  function setupFullscreen() {
    // 전체 화면을 지원하지 않는 브라우저(예: 아이폰)에서만 버튼 숨김
    document.querySelectorAll('.fs-btn').forEach((b) => {
      if (!fsSupported) { b.hidden = true; return; }
      b.addEventListener('click', () => { sound('tap'); toggleFullscreen(); });
    });
    document.addEventListener('fullscreenchange', updateFullscreenButtons);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButtons);
    updateFullscreenButtons();
  }

  function updateSoundButton() {
    el.soundBtn.textContent = soundOn ? '🔊' : '🔇';
    el.musicBtn.classList.toggle('off', !music.on);
    el.musicBtn.setAttribute('aria-label', music.on ? '배경음악 끄기' : '배경음악 켜기');
  }

  function setupMusic() {
    el.musicBtn.addEventListener('click', () => {
      music.on = !music.on;
      store.set('music', music.on);
      updateSoundButton();
      getAudio();
      syncMusic();
    });

    // 브라우저는 화면을 한 번 터치해야 소리를 낼 수 있게 해 줌
    const unlock = () => { getAudio(); syncMusic(); };
    document.addEventListener('pointerdown', unlock, true);

    // 다른 앱으로 가거나 화면이 꺼지면 음악 멈춤
    document.addEventListener('visibilitychange', () => {
      if (!audioCtx) return;
      if (document.hidden) audioCtx.suspend();
      else audioCtx.resume().then(syncMusic);
    });

    playMusic('menu');
  }

  function init() {
    el = {
      list: $('game-list'),
      soundBtn: $('sound-toggle'),
      musicBtn: $('music-toggle'),
      backBtn: $('back-btn'),
      hudTitle: $('hud-title'),
      hudInfo: $('hud-info'),
      stageWrap: $('stage-wrap'),
      overlay: $('overlay'),
      ovEmoji: $('ov-emoji'),
      ovTitle: $('ov-title'),
      ovText: $('ov-text'),
      ovBest: $('ov-best'),
      ovPrimary: $('ov-primary'),
      ovSecondary: $('ov-secondary'),
    };

    el.soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      store.set('sound', soundOn);
      updateSoundButton();
      sound('tap');
    });
    el.backBtn.addEventListener('click', () => { sound('tap'); goHome(); });

    // 태블릿에서 확대/더블탭 줌 막기
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    updateSoundButton();
    setupMusic();
    setupFullscreen();
    renderHome();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      // 새 버전이 설치되면 게임 중이 아닐 때 한 번 새로고침해서 바로 반영
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        if (!session) location.reload();
      });
      navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 기능 없이 계속 */ });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
