registerGame({
  id: 'balloon',
  title: '풍선 터뜨리기',
  emoji: '🎈',
  color: '#f43f5e',
  desc: '올라오는 풍선을 콕콕!',
  howTo: '30초 동안 올라오는 풍선을\n터치해서 터뜨려요.\n⭐ 황금 풍선은 3점!',
  best: 'high',
  format: (n) => n + '점',

  start(api) {
    const stage = api.stage;
    const DURATION = 30;
    const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
    const balloons = [];
    let score = 0;
    let elapsed = 0;
    let spawnTimer = 0;
    let running = false;

    const W = () => stage.clientWidth;
    const H = () => stage.clientHeight;

    function hud() {
      api.info('⏱ ' + Math.max(0, Math.ceil(DURATION - elapsed)) + '   ⭐ ' + score);
    }

    function place(b, sway) {
      b.el.style.transform = 'translate(' + (b.x + sway) + 'px,' + b.y + 'px)';
    }

    function spawn(progress) {
      const gold = Math.random() < 0.07;
      const base = Math.max(64, Math.min(W(), H()) * 0.13);
      const size = gold ? base * 0.8 : base * (0.85 + Math.random() * 0.35);
      const node = document.createElement('div');
      node.className = 'balloon' + (gold ? ' gold' : '');
      node.style.width = size + 'px';
      node.style.height = size * 1.2 + 'px';
      node.style.setProperty('--c', gold ? '#fbbf24' : COLORS[Math.floor(Math.random() * COLORS.length)]);
      node.innerHTML = '<div class="b-body">' + (gold ? '⭐' : '') + '</div>';

      const b = {
        el: node,
        size,
        gold,
        x: Math.random() * Math.max(0, W() - size),
        y: H() + 10,
        speed: H() * (0.18 + progress * 0.3 + Math.random() * 0.1) * (gold ? 1.4 : 1),
        phase: Math.random() * Math.PI * 2,
        dead: false,
      };
      node.addEventListener('pointerdown', (e) => { e.preventDefault(); pop(b); });
      place(b, 0);
      stage.appendChild(node);
      balloons.push(b);
    }

    function pop(b) {
      if (b.dead || !running) return;
      b.dead = true;
      const pts = b.gold ? 3 : 1;
      score += pts;
      api.sound(b.gold ? 'good' : 'pop');
      api.vibrate(15);
      b.el.classList.add('popped');
      api.floatText('+' + pts, b.x + b.size / 2, b.y + b.size * 0.4, b.gold ? '#fde047' : '#ffffff');
      api.timeout(() => b.el.remove(), 250);
      hud();
    }

    hud();
    api.countdown(() => {
      running = true;
      api.loop((dt, now) => {
        elapsed += dt;
        if (elapsed >= DURATION) {
          running = false;
          hud();
          api.end({
            score,
            title: score >= 40 ? '풍선 마스터! 🎉' : score >= 20 ? '잘했어요!' : '시간 끝!',
            text: '풍선으로 ' + score + '점을 얻었어요!',
          });
          return false;
        }
        const progress = Math.min(1, elapsed / DURATION);
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawn(progress);
          spawnTimer = 0.8 - progress * 0.5;
        }
        for (let i = balloons.length - 1; i >= 0; i--) {
          const b = balloons[i];
          if (b.dead) { balloons.splice(i, 1); continue; }
          b.y -= b.speed * dt;
          place(b, Math.sin(now / 500 + b.phase) * 12);
          if (b.y < -b.size * 1.6) {
            b.el.remove();
            balloons.splice(i, 1);
          }
        }
        hud();
      });
    });
  },
});
