(function () {
  // 한 판이 끝나도 유지되는 상태 (앱을 닫으면 초기화)
  let mode = 'cpu'; // 'cpu' | 'pvp'
  let starter = 'O';
  let tally = { O: 0, X: 0, D: 0 };

  const MARK = { O: '⭕', X: '❌' };
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  function winnerOf(cells) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return { p: cells[a], line };
    }
    if (cells.every(Boolean)) return { p: null, line: [] };
    return null;
  }

  function findWinningMove(cells, p) {
    for (const line of LINES) {
      const marks = line.map((i) => cells[i]);
      if (marks.filter((m) => m === p).length === 2 && marks.includes(null)) {
        return line[marks.indexOf(null)];
      }
    }
    return -1;
  }

  // 아이와 놀기 좋게 가끔 실수하는 컴퓨터
  function aiMove(cells) {
    const win = findWinningMove(cells, 'X');
    if (win >= 0) return win;
    const block = findWinningMove(cells, 'O');
    if (block >= 0 && Math.random() < 0.85) return block;
    if (cells[4] === null && Math.random() < 0.7) return 4;
    const free = cells.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
    const corners = free.filter((i) => [0, 2, 6, 8].includes(i));
    const pool = corners.length && Math.random() < 0.6 ? corners : free;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  registerGame({
    id: 'ttt',
    title: '틱택토',
    emoji: '⭕',
    color: '#14b8a6',
    desc: '친구나 컴퓨터와 한 판!',
    howTo: '가로, 세로, 대각선으로\n같은 모양 3개를 먼저 놓으면 이겨요.\n둘이서 하거나 컴퓨터와 할 수 있어요.',
    best: null,

    start(api) {
      const cells = Array(9).fill(null);
      let turn = starter;
      let over = false;
      let busy = false;
      starter = starter === 'O' ? 'X' : 'O'; // 다음 판은 번갈아 먼저

      const wrap = document.createElement('div');
      wrap.className = 'ttt-wrap';

      const modes = document.createElement('div');
      modes.className = 'ttt-modes';
      [['cpu', '🤖 컴퓨터랑'], ['pvp', '👫 둘이서']].forEach(([m, label]) => {
        const b = document.createElement('button');
        b.className = 'ttt-mode' + (m === mode ? ' active' : '');
        b.textContent = label;
        b.addEventListener('click', () => {
          if (m === mode) return;
          over = true; // 이전 판의 컴퓨터 차례 예약 무효화
          mode = m;
          tally = { O: 0, X: 0, D: 0 };
          starter = 'O';
          api.sound('tap');
          api.stage.innerHTML = '';
          this.start(api);
        });
        modes.appendChild(b);
      });

      const status = document.createElement('div');
      status.className = 'ttt-status';

      const board = document.createElement('div');
      board.className = 'board grid-3 ttt-board';
      const btns = cells.map((_, i) => {
        const b = document.createElement('button');
        b.className = 'ttt-cell';
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (over || busy || cells[i]) return;
          if (mode === 'cpu' && turn === 'X') return;
          play(i);
        });
        board.appendChild(b);
        return b;
      });

      wrap.append(modes, status, board);
      api.stage.appendChild(wrap);

      function name(p) {
        if (mode === 'cpu') return p === 'O' ? '나 ' + MARK.O : '컴퓨터 ' + MARK.X;
        return MARK[p];
      }

      function hud() {
        api.info(MARK.O + ' ' + tally.O + ' : ' + tally.X + ' ' + MARK.X);
      }

      function updateStatus() {
        status.textContent = name(turn) + ' 차례';
      }

      function play(i) {
        cells[i] = turn;
        btns[i].textContent = MARK[turn];
        btns[i].classList.add('placed');
        api.sound('tap');

        const w = winnerOf(cells);
        if (w) return finish(w);

        turn = turn === 'O' ? 'X' : 'O';
        updateStatus();
        maybeCpu();
      }

      function maybeCpu() {
        if (mode === 'cpu' && turn === 'X' && !over) {
          busy = true;
          api.timeout(() => {
            busy = false;
            if (!over) play(aiMove(cells));
          }, 500);
        }
      }

      function finish(w) {
        over = true;
        w.line.forEach((i) => btns[i].classList.add('win'));
        let title, emoji;
        if (!w.p) {
          tally.D++;
          title = '비겼어요!';
          emoji = '🤝';
          status.textContent = '비겼어요!';
        } else {
          tally[w.p]++;
          if (mode === 'cpu') {
            title = w.p === 'O' ? '이겼어요! 🎉' : '컴퓨터가 이겼어요';
            emoji = w.p === 'O' ? '🥳' : '🤖';
          } else {
            title = MARK[w.p] + ' 승리!';
            emoji = '🎉';
          }
          status.textContent = title;
        }
        hud();
        api.timeout(() => api.end({
          title,
          emoji,
          text: MARK.O + ' ' + tally.O + ' : ' + tally.X + ' ' + MARK.X + '\n(무승부 ' + tally.D + '번)',
        }), 1000);
      }

      hud();
      updateStatus();
      maybeCpu();
    },
  });
})();
