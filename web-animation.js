(function() {
  var canvas = document.getElementById('web-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var colorStr = canvas.dataset.color || '124,58,237';
  var W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  var MAX_NODES = 55;
  var CONNECT_DIST = 150;
  var SPAWN_INTERVAL = 90;
  var SIGNAL_DURATION = 2000;
  var FADE_MS = 3000;
  var PAUSE_MS = 1200;

  var nodes = [];
  var phase = 'building';
  var alpha = 1;
  var lastSpawn = 0;
  var phaseStart = performance.now();
  var signalPath = [];
  var signalProgress = 0;

  var r = parseInt(colorStr.split(',')[0]) || 124;
  var g = parseInt(colorStr.split(',')[1]) || 58;
  var b = parseInt(colorStr.split(',')[2]) || 237;

  function spawnNode() {
    nodes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 2 + 1.2
    });
  }

  function buildSignalPath() {
    if (nodes.length < 3) return [];
    var startIdx = Math.floor(Math.random() * nodes.length);
    var path = [startIdx];
    var used = {};
    used[startIdx] = true;

    for (var step = 0; step < 8; step++) {
      var last = nodes[path[path.length - 1]];
      var best = -1;
      var bestDist = CONNECT_DIST;
      for (var i = 0; i < nodes.length; i++) {
        if (used[i]) continue;
        var dx = nodes[i].x - last.x;
        var dy = nodes[i].y - last.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      if (best === -1) break;
      path.push(best);
      used[best] = true;
    }
    return path;
  }

  function drawSignal(now) {
    if (signalPath.length < 2) return;
    var totalSegs = signalPath.length - 1;

    signalProgress += 0.004;
    if (signalProgress > 1) signalProgress = 1;

    var pos = signalProgress * totalSegs;
    var segIdx = Math.floor(pos);
    var t = pos - segIdx;

    if (segIdx >= totalSegs) {
      segIdx = totalSegs - 1;
      t = 1;
    }

    var from = nodes[signalPath[segIdx]];
    var to = nodes[signalPath[segIdx + 1]];
    if (!from || !to) return;

    var px = from.x + (to.x - from.x) * t;
    var py = from.y + (to.y - from.y) * t;
    var intensity = Math.sin(signalProgress * Math.PI);
    var glowSize = 8 + intensity * 12;

    ctx.beginPath();
    ctx.arc(px, py, glowSize, 0, Math.PI * 2);
    var grad = ctx.createRadialGradient(px, py, 0, px, py, glowSize);
    grad.addColorStop(0, 'rgba(' + colorStr + ',' + (0.7 * alpha) + ')');
    grad.addColorStop(0.4, 'rgba(' + colorStr + ',' + (0.25 * alpha) + ')');
    grad.addColorStop(1, 'rgba(' + colorStr + ',0)');
    ctx.fillStyle = grad;
    ctx.fill();

    for (var s = 0; s < segIdx; s++) {
      var a = nodes[signalPath[s]];
      var bNode = nodes[signalPath[s + 1]];
      if (!a || !bNode) continue;
      var segIntensity = (s / totalSegs) * 0.6 + 0.1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bNode.x, bNode.y);
      ctx.strokeStyle = 'rgba(' + colorStr + ',' + (segIntensity * alpha) + ')';
      ctx.lineWidth = 1.2 + segIntensity * 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r + 1.5 + segIntensity * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + colorStr + ',' + (0.3 + segIntensity * 0.4) * alpha + ')';
      ctx.fill();
    }

    if (segIdx < totalSegs) {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      var trailIntensity = intensity * 0.5 + 0.3;
      ctx.strokeStyle = 'rgba(' + colorStr + ',' + (trailIntensity * alpha) + ')';
      ctx.lineWidth = 1.5 + intensity * 2;
      ctx.stroke();
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);

    switch (phase) {
      case 'building':
        if (nodes.length < MAX_NODES && now - lastSpawn > SPAWN_INTERVAL) {
          spawnNode();
          lastSpawn = now;
        }
        if (nodes.length >= MAX_NODES) {
          signalPath = buildSignalPath();
          signalProgress = 0;
          phase = 'signaling';
          phaseStart = now;
        }
        break;
      case 'signaling':
        if (signalProgress >= 1) {
          phase = 'fading';
          phaseStart = now;
        }
        break;
      case 'fading':
        alpha = Math.max(0, 1 - (now - phaseStart) / FADE_MS);
        if (alpha <= 0) {
          alpha = 0;
          phase = 'paused';
          phaseStart = now;
        }
        break;
      case 'paused':
        if (now - phaseStart > PAUSE_MS) {
          nodes = [];
          alpha = 1;
          signalPath = [];
          signalProgress = 0;
          phase = 'building';
          lastSpawn = now;
        }
        break;
    }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0) n.x = W;
      if (n.x > W) n.x = 0;
      if (n.y < 0) n.y = H;
      if (n.y > H) n.y = 0;
    }

    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < CONNECT_DIST) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = 'rgba(' + colorStr + ',' + ((1 - d / CONNECT_DIST) * 0.15 * alpha) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    if (phase === 'signaling' || (phase === 'fading' && signalPath.length > 0 && signalProgress > 0)) {
      drawSignal(now);
    }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + colorStr + ',' + (0.35 * alpha) + ')';
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
