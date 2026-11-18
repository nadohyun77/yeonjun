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

  function updateSoundButton() {
    el.soundBtn.textContent = soundOn ? '🔊' : '🔇';
  }

  function init() {
    el = {
      list: $('game-list'),
      soundBtn: $('sound-toggle'),
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
    renderHome();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 기능 없이 계속 */ });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
