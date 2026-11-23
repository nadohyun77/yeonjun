registerGame({
  id: 'color',
  title: '색깔 맞추기',
  emoji: '🎨',
  color: '#f59e0b',
  desc: '글자 말고 색깔을 보세요!',
  howTo: '글자의 뜻이 아니라\n글자가 칠해진 "색깔"을 골라요.\n30초 동안 최대한 많이!\n틀리면 2초가 줄어들어요.',
  best: 'high',
  format: (n) => n + '점',
  // 통통 튀는 펑키한 곡
  music: {
    bpm: 128,
    lead: 'square',
    melody: [
      79, null, 79, 81, 83, null, 79, null,
      76, null, 76, 79, 83, null, 79, 76,
      76, 79, 84, null, 83, 81, 79, null,
      81, null, 78, null, 74, null, null, null,
      83, 81, 79, null, 83, 81, 79, null,
      76, 79, 83, 86, 83, 79, 76, null,
      72, 76, 79, 84, 81, 79, 76, 79,
      78, null, 74, 78, 79, null, null, null,
    ],
    roots: [43, 40, 48, 50, 43, 40, 48, 50],
    bass: [0, null, 0, 12, null, 0, 12, null],
    drums: 'k.s..ks.',
    hats: true,
  },

  start(api) {
    const COLORS = [
      { name: '빨강', c: '#ef4444' },
      { name: '파랑', c: '#3b82f6' },
      { name: '초록', c: '#22c55e' },
      { name: '노랑', c: '#facc15' },
    ];
    const DURATION = 30;
    let score = 0;
    let timeLeft = DURATION;
    let answer = -1;
    let lastKey = '';
    let running = false;
    let streak = 0;
    let lastWarn = 0;

    const wrap = document.createElement('div');
    wrap.className = 'color-wrap';
    const prompt = document.createElement('div');
    prompt.className = 'color-prompt';
    prompt.textContent = '글자의 색깔은?';
    const word = document.createElement('div');
    word.className = 'color-word';
    word.textContent = '준비!';
    const btns = document.createElement('div');
    btns.className = 'color-btns';

    COLORS.forEach((col, i) => {
      const b = document.createElement('button');
      b.className = 'color-btn';
      b.style.background = col.c;
      b.textContent = col.name;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(i); });
      btns.appendChild(b);
    });

    wrap.append(prompt, word, btns);
    api.stage.appendChild(wrap);

    const rand = (n) => Math.floor(Math.random() * n);
    const hud = () => api.info('⏱ ' + Math.max(0, Math.ceil(timeLeft)) + '   ⭐ ' + score);

    function next() {
      let w, k, key;
      do {
        k = rand(COLORS.length);
        if (Math.random() < 0.25) {
          w = k;
        } else {
          w = (k + 1 + rand(COLORS.length - 1)) % COLORS.length;
        }
        key = w + '-' + k;
      } while (key === lastKey);
      lastKey = key;
      answer = k;
      word.textContent = COLORS[w].name;
      word.style.color = COLORS[k].c;
      word.classList.remove('bump');
      void word.offsetWidth;
      word.classList.add('bump');
    }

    function choose(i) {
      if (!running) return;
      const r = word.getBoundingClientRect();
      const s = api.stage.getBoundingClientRect();
      const fx = r.left - s.left + r.width / 2;
      const fy = r.top - s.top;
      const correct = i === answer;
      next();
      if (correct) {
        score++;
        streak++;
        api.sound('combo', streak); // 연속으로 맞히면 소리가 점점 높아져요
        api.floatText('+1', fx, fy, '#bbf7d0');
      } else {
        timeLeft -= 2;
        streak = 0;
        api.sound('bad');
        api.vibrate(60);
        api.shake(word);
        api.floatText('-2초', fx, fy, '#fecaca');
      }
      hud();
    }

    hud();
    api.countdown(() => {
      running = true;
      next();
      api.loop((dt) => {
        timeLeft -= dt;
        const left = Math.ceil(timeLeft);
        if (left <= 5 && left > 0 && left !== lastWarn) {
          lastWarn = left;
          api.sound('warn');
          api.musicTempo(1.25);
        }
        hud();
        if (timeLeft <= 0) {
          running = false;
          api.end({
            score,
            title: score >= 30 ? '눈이 정말 좋아요! 👀' : score >= 15 ? '잘했어요!' : '시간 끝!',
            text: '30초 동안 ' + score + '개를 맞혔어요!',
          });
          return false;
        }
      });
    });
  },
});
