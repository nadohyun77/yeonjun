registerGame({
  id: 'memory',
  title: '짝 맞추기',
  emoji: '🃏',
  color: '#8b5cf6',
  desc: '같은 그림 카드를 찾아요',
  howTo: '카드를 두 장씩 뒤집어서\n같은 그림 짝을 모두 찾아요.\n적은 횟수로 찾을수록 좋아요!',
  best: 'low',
  format: (n) => n + '번',
  // 차분하게 생각하는 곡
  music: {
    bpm: 96,
    lead: 'sine',
    vol: 1.3,
    melody: [
      77, null, 72, null, 69, null, 72, null,
      74, null, 69, null, 65, null, 69, null,
      70, null, 74, null, 77, null, 74, 72,
      72, null, null, null, 67, null, null, null,
      77, null, 79, null, 81, null, 77, null,
      74, null, 77, null, 81, null, 79, 77,
      74, null, 72, null, 70, null, 74, null,
      72, null, 67, null, 72, null, null, null,
    ],
    roots: [41, 38, 46, 48, 41, 38, 46, 48],
    bass: [0, null, null, null, 7, null, null, null],
    drums: 'k...k...',
    hats: false,
  },

  start(api) {
    const POOL = ['🐶', '🐱', '🐰', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐨', '🐷', '🐙', '🦄', '🐢', '🐳', '🦋'];
    const PAIRS = 8;
    const picks = api.shuffle(POOL.slice()).slice(0, PAIRS);
    const deck = api.shuffle(picks.concat(picks));

    const board = document.createElement('div');
    board.className = 'board grid-4';

    let first = null;
    let lock = false;
    let moves = 0;
    let found = 0;
    let t0 = 0;
    let doneSecs = null;

    const secs = () => (doneSecs !== null ? doneSecs : t0 ? Math.floor((performance.now() - t0) / 1000) : 0);
    const hud = () => api.info('🔁 ' + moves + '번   ⏱ ' + secs() + '초');

    deck.forEach((sym) => {
      const card = document.createElement('button');
      card.className = 'mem-card';
      card.innerHTML =
        '<div class="mem-inner">' +
        '<div class="mem-face mem-back">?</div>' +
        '<div class="mem-face mem-front">' + sym + '</div>' +
        '</div>';
      card.addEventListener('pointerdown', (e) => { e.preventDefault(); flip(card, sym); });
      board.appendChild(card);
    });

    function flip(card, sym) {
      if (lock || card.classList.contains('flipped')) return;
      if (!t0) t0 = performance.now();
      card.classList.add('flipped');
      api.sound('flip');

      if (!first) { first = { card, sym }; return; }

      moves++;
      const other = first.card;
      if (first.sym === sym) {
        other.classList.add('matched');
        card.classList.add('matched');
        first = null;
        found++;
        api.sound('good');
        api.vibrate(20);
        if (found === PAIRS) {
          doneSecs = secs();
          const m = moves;
          api.timeout(() => api.end({
            score: m,
            title: m <= 12 ? '기억력 천재! 🧠' : '다 찾았어요!',
            text: m + '번 만에 모두 찾았어요!\n걸린 시간: ' + doneSecs + '초',
          }), 600);
        }
      } else {
        lock = true;
        first = null;
        api.timeout(() => api.sound('miss'), 350);
        api.timeout(() => {
          other.classList.remove('flipped');
          card.classList.remove('flipped');
          lock = false;
        }, 800);
      }
      hud();
    }

    api.stage.appendChild(board);
    hud();
    api.interval(hud, 500);
  },
});
