registerGame({
  id: 'numbers',
  title: '숫자 순서 터치',
  emoji: '🔢',
  color: '#0ea5e9',
  desc: '1부터 25까지 빠르게!',
  howTo: '1부터 25까지 순서대로\n최대한 빠르게 터치해요.\n틀리면 1초가 더해져요!',
  best: 'low',
  format: (n) => n.toFixed(2) + '초',

  start(api) {
    const N = 25;
    const nums = api.shuffle(Array.from({ length: N }, (_, i) => i + 1));
    const board = document.createElement('div');
    board.className = 'board grid-5';

    let next = 1;
    let t0 = 0;
    let penalty = 0;
    let done = false;

    const time = () => (t0 ? (performance.now() - t0) / 1000 + penalty : 0);
    const hud = () => { if (!done) api.info('다음: ' + next + '   ⏱ ' + time().toFixed(1)); };

    nums.forEach((n) => {
      const cell = document.createElement('button');
      cell.className = 'num-cell';
      cell.textContent = n;
      cell.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (done || cell.classList.contains('done')) return;
        if (n === next) {
          if (!t0) t0 = performance.now();
          cell.classList.add('done');
          api.sound('tap');
          next++;
          if (next > N) {
            const t = Math.round(time() * 100) / 100;
            done = true;
            api.info('⏱ ' + t.toFixed(2) + '초');
            api.timeout(() => api.end({
              score: t,
              title: t < 20 ? '번개손! ⚡' : '완성!',
              text: '25개를 ' + t.toFixed(2) + '초 만에 눌렀어요!',
            }), 300);
          }
        } else {
          if (t0) {
            penalty += 1;
            const r = cell.getBoundingClientRect();
            const s = api.stage.getBoundingClientRect();
            api.floatText('+1초', r.left - s.left + r.width / 2, r.top - s.top, '#fecaca');
          }
          api.sound('bad');
          api.vibrate(60);
          api.shake(cell);
        }
        hud();
      });
      board.appendChild(cell);
    });

    api.stage.appendChild(board);
    hud();
    api.interval(hud, 100);
  },
});
