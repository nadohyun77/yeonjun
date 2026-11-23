registerGame({
  id: 'reaction',
  title: '반응속도 테스트',
  emoji: '⚡',
  color: '#22c55e',
  desc: '초록색이 되면 바로 터치!',
  howTo: '화면이 초록색으로 바뀌면\n최대한 빨리 터치해요.\n5번 재서 평균을 내요.\n빨간색일 때 누르면 다시 해요!',
  best: 'low',
  format: (n) => n + 'ms',
  // 두근두근 긴장되는 곡 (조용하게)
  music: {
    bpm: 92,
    lead: 'sine',
    vol: 0.8,
    melody: [
      74, null, null, null, null, null, null, null,
      70, null, null, null, null, null, 69, null,
      67, null, null, null, 70, null, null, null,
      69, null, null, null, 73, null, null, null,
    ],
    roots: [50, 46, 43, 45],
    bass: [0, null, null, null, 0, null, null, null],
    drums: 'k.k.....',
    hats: false,
  },

  start(api) {
    const ROUNDS = 5;
    const results = [];
    const area = document.createElement('div');
    const big = document.createElement('div');
    const small = document.createElement('div');
    big.className = 'react-big';
    small.className = 'react-small';
    area.append(big, small);
    api.stage.appendChild(area);

    let state = 'idle';
    let goAt = 0;
    let timer = null;

    function set(cls, bigText, smallText) {
      area.className = 'react-area ' + cls;
      big.textContent = bigText;
      small.textContent = smallText;
    }

    const hud = () => api.info('🎯 ' + Math.min(results.length + 1, ROUNDS) + ' / ' + ROUNDS);

    function rating(ms) {
      if (ms < 250) return '번개 같아요! ⚡';
      if (ms < 330) return '아주 빨라요! 🚀';
      if (ms < 420) return '좋아요! 👍';
      return '조금 더 연습해 봐요! 💪';
    }

    function waitPhase() {
      state = 'wait';
      hud();
      set('wait', '기다려요…', '초록색이 되면 터치!');
      timer = api.timeout(() => {
        state = 'go';
        goAt = performance.now();
        set('go', '지금!', '');
        api.sound('go');
      }, 1200 + Math.random() * 2800);
    }

    area.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const now = performance.now();
      if (state === 'wait') {
        api.clearTimeout(timer);
        state = 'early';
        api.sound('bad');
        api.vibrate(80);
        set('early', '너무 빨라요! 😅', '잠시 후 다시 해요');
        api.timeout(waitPhase, 1300);
      } else if (state === 'go') {
        const ms = Math.round(now - goAt);
        results.push(ms);
        state = 'result';
        api.sound('ding', ms);
        if (results.length >= ROUNDS) {
          set('result', ms + 'ms', '');
          const avg = Math.round(results.reduce((a, b) => a + b, 0) / ROUNDS);
          api.timeout(() => api.end({
            score: avg,
            title: rating(avg),
            text: '평균 ' + avg + 'ms\n(' + results.join(' · ') + ')',
          }), 900);
        } else {
          set('result', ms + 'ms', '잠시 후 다음 라운드');
          api.timeout(waitPhase, 1200);
        }
      }
    });

    waitPhase();
  },
});
