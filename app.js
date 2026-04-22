// ═══════════════════════════════════════════════════════════════════
//  DIJKSTRA VISUALIZER — app.js
//  Graph editor + animated shortest-path algorithm
// ═══════════════════════════════════════════════════════════════════

// ─── State ──────────────────────────────────────────────────────────
const state = {
  nodes: [],         // { id, x, y, label, status }
  edges: [],         // { id, from, to, weight, status }
  tool: 'node',      // 'node' | 'edge' | 'delete'
  edgePending: null, // first node selected for edge creation
  nodeCounter: 0,
  edgeCounter: 0,
  running: false,
  animTimer: null,
};

// ─── Canvas Setup ───────────────────────────────────────────────────
const canvas  = document.getElementById('graph-canvas');
const ctx     = canvas.getContext('2d');

function resizeCanvas() {
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  draw();
}
window.addEventListener('resize', resizeCanvas);

// ─── DOM Refs ────────────────────────────────────────────────────────
const btnNode     = document.getElementById('btn-add-node');
const btnEdge     = document.getElementById('btn-add-edge');
const btnDelete   = document.getElementById('btn-delete');
const btnRun      = document.getElementById('btn-run');
const btnReset    = document.getElementById('btn-reset');
const btnClearRun = document.getElementById('btn-clear-run');
const selSource   = document.getElementById('select-source');
const selTarget   = document.getElementById('select-target');
const speedInput  = document.getElementById('speed');
const logBox      = document.getElementById('log');
const distOutput  = document.getElementById('distances-output');
const canvasHint  = document.getElementById('canvas-hint');
const edgeModal   = document.getElementById('edge-modal');
const modalWeight = document.getElementById('modal-weight');
const modalOk     = document.getElementById('modal-ok');
const modalCancel = document.getElementById('modal-cancel');

// ─── Tool Buttons ────────────────────────────────────────────────────
function setTool(t) {
  state.tool        = t;
  state.edgePending = null;
  [btnNode, btnEdge, btnDelete].forEach(b => b.classList.remove('active'));
  if (t === 'node')   { btnNode.classList.add('active');   canvasHint.innerHTML = 'Clique para adicionar um <strong>nó</strong>'; }
  if (t === 'edge')   { btnEdge.classList.add('active');   canvasHint.innerHTML = 'Clique em um <strong>nó de origem</strong>'; }
  if (t === 'delete') { btnDelete.classList.add('active'); canvasHint.innerHTML = 'Clique em um <strong>nó ou aresta</strong> para deletar'; }
  draw();
}

btnNode.addEventListener('click',   () => setTool('node'));
btnEdge.addEventListener('click',   () => setTool('edge'));
btnDelete.addEventListener('click', () => setTool('delete'));

// ─── Canvas Interaction ──────────────────────────────────────────────
const NODE_R = 22;

function getNodeAt(x, y) {
  return state.nodes.find(n =>
    Math.hypot(n.x - x, n.y - y) <= NODE_R
  );
}

function getEdgeAt(x, y) {
  const THRESH = 8;
  return state.edges.find(e => {
    const a = state.nodes.find(n => n.id === e.from);
    const b = state.nodes.find(n => n.id === e.to);
    if (!a || !b) return false;
    // distance from point to segment
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx*dx + dy*dy;
    if (len2 === 0) return Math.hypot(a.x-x, a.y-y) < THRESH;
    const t = Math.max(0, Math.min(1, ((x-a.x)*dx + (y-a.y)*dy) / len2));
    return Math.hypot(a.x + t*dx - x, a.y + t*dy - y) < THRESH;
  });
}

canvas.addEventListener('click', e => {
  if (state.running) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (state.tool === 'node') {
    if (!getNodeAt(x, y)) addNode(x, y);
    return;
  }

  if (state.tool === 'edge') {
    const hit = getNodeAt(x, y);
    if (!hit) return;
    if (!state.edgePending) {
      state.edgePending = hit;
      canvasHint.innerHTML = `De <strong>${hit.label}</strong> — clique no nó de <strong>destino</strong>`;
      draw();
    } else {
      if (state.edgePending.id !== hit.id) {
        showEdgeModal(state.edgePending, hit);
      } else {
        state.edgePending = null;
        canvasHint.innerHTML = 'Clique em um <strong>nó de origem</strong>';
        draw();
      }
    }
    return;
  }

  if (state.tool === 'delete') {
    const node = getNodeAt(x, y);
    if (node) { deleteNode(node); return; }
    const edge = getEdgeAt(x, y);
    if (edge) { deleteEdge(edge); }
  }
});

// ─── Edge Modal ──────────────────────────────────────────────────────
let pendingEdgePair = null;

function showEdgeModal(from, to) {
  pendingEdgePair = { from, to };
  modalWeight.value = document.getElementById('edge-weight').value;
  edgeModal.classList.remove('hidden');
  modalWeight.focus();
  modalWeight.select();
}

modalOk.addEventListener('click', confirmEdge);
modalCancel.addEventListener('click', cancelEdge);
modalWeight.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmEdge();
  if (e.key === 'Escape') cancelEdge();
});

function confirmEdge() {
  if (!pendingEdgePair) return;
  const w = Math.max(1, parseInt(modalWeight.value) || 1);
  addEdge(pendingEdgePair.from, pendingEdgePair.to, w);
  pendingEdgePair = null;
  state.edgePending = null;
  edgeModal.classList.add('hidden');
  canvasHint.innerHTML = 'Clique em um <strong>nó de origem</strong>';
}

function cancelEdge() {
  pendingEdgePair = null;
  state.edgePending = null;
  edgeModal.classList.add('hidden');
  canvasHint.innerHTML = 'Clique em um <strong>nó de origem</strong>';
  draw();
}

// ─── Graph Mutations ─────────────────────────────────────────────────
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let labelIdx = 0;

function nextLabel() {
  const l = LABELS[labelIdx % 26] + (labelIdx >= 26 ? Math.floor(labelIdx/26) : '');
  labelIdx++;
  return l;
}

function addNode(x, y) {
  const node = { id: ++state.nodeCounter, x, y, label: nextLabel(), status: 'default' };
  state.nodes.push(node);
  updateSelects();
  draw();
  logInfo(`Nó <strong>${node.label}</strong> adicionado`);
}

function addEdge(from, to, weight) {
  // Check for duplicate
  const exists = state.edges.find(e =>
    (e.from === from.id && e.to === to.id) ||
    (e.from === to.id && e.to === from.id)
  );
  if (exists) {
    exists.weight = weight;
    draw();
    logInfo(`Aresta ${from.label}↔${to.label} atualizada (peso ${weight})`);
    return;
  }
  const edge = { id: ++state.edgeCounter, from: from.id, to: to.id, weight, status: 'default' };
  state.edges.push(edge);
  draw();
  logInfo(`Aresta ${from.label}↔${to.label} (peso ${weight}) adicionada`);
}

function deleteNode(node) {
  state.nodes = state.nodes.filter(n => n.id !== node.id);
  state.edges = state.edges.filter(e => e.from !== node.id && e.to !== node.id);
  updateSelects();
  draw();
  logInfo(`Nó ${node.label} deletado`);
}

function deleteEdge(edge) {
  const a = state.nodes.find(n => n.id === edge.from);
  const b = state.nodes.find(n => n.id === edge.to);
  state.edges = state.edges.filter(e => e.id !== edge.id);
  draw();
  logInfo(`Aresta ${a?.label}↔${b?.label} deletada`);
}

// ─── Select Menus ────────────────────────────────────────────────────
function updateSelects() {
  const srcVal = selSource.value;
  const tgtVal = selTarget.value;

  [selSource, selTarget].forEach((sel, i) => {
    sel.innerHTML = i === 0
      ? '<option value="">— selecione —</option>'
      : '<option value="">— todos —</option>';
    state.nodes.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = `Nó ${n.label}`;
      sel.appendChild(opt);
    });
  });

  if (state.nodes.find(n => n.id == srcVal)) selSource.value = srcVal;
  if (state.nodes.find(n => n.id == tgtVal)) selTarget.value = tgtVal;
}

// ─── Drawing ─────────────────────────────────────────────────────────
const COLORS = {
  default:   { fill: '#1e2436', stroke: '#00e5ff',  glow: 'rgba(0,229,255,.4)' },
  visiting:  { fill: '#ff6d00', stroke: '#ff9d40',  glow: 'rgba(255,109,0,.5)' },
  visited:   { fill: '#7a5c00', stroke: '#ffb300',  glow: 'rgba(255,179,0,.3)' },
  path:      { fill: '#003d1a', stroke: '#00e676',  glow: 'rgba(0,230,118,.5)' },
  source:    { fill: '#003a55', stroke: '#00e5ff',  glow: 'rgba(0,229,255,.7)' },
  target:    { fill: '#4a0020', stroke: '#ff3d71',  glow: 'rgba(255,61,113,.5)' },
  pending:   { fill: '#1e2436', stroke: '#ff9800',  glow: 'rgba(255,152,0,.6)' },
};

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw edges first
  state.edges.forEach(e => drawEdge(e));

  // Draw edge-in-progress indicator
  if (state.edgePending && state.tool === 'edge') {
    const n = state.edgePending;
    ctx.beginPath();
    ctx.arc(n.x, n.y, NODE_R + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw nodes on top
  state.nodes.forEach(n => drawNode(n));
}

function drawEdge(e) {
  const a = state.nodes.find(n => n.id === e.from);
  const b = state.nodes.find(n => n.id === e.to);
  if (!a || !b) return;

  const isPath    = e.status === 'path';
  const isVisited = e.status === 'visited';

  const color = isPath    ? '#00e676'
               : isVisited ? '#ffb300'
               : '#2e3448';
  const lw    = isPath ? 3.5 : isVisited ? 2.5 : 1.5;

  // Glow for path edges
  if (isPath || isVisited) {
    ctx.save();
    ctx.shadowColor = isPath ? '#00e676' : '#ffb300';
    ctx.shadowBlur = isPath ? 16 : 8;
  }

  // Arrow line
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const startX = a.x + Math.cos(ang) * NODE_R;
  const startY = a.y + Math.sin(ang) * NODE_R;
  const endX   = b.x - Math.cos(ang) * NODE_R;
  const endY   = b.y - Math.sin(ang) * NODE_R;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.stroke();

  // Arrowhead
  const arrLen = 10, arrW = 5;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrLen * Math.cos(ang - .4),
    endY - arrLen * Math.sin(ang - .4)
  );
  ctx.lineTo(
    endX - arrLen * Math.cos(ang + .4),
    endY - arrLen * Math.sin(ang + .4)
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  if (isPath || isVisited) ctx.restore();

  // Weight label
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const perp = { x: -Math.sin(ang) * 14, y: Math.cos(ang) * 14 };

  ctx.save();
  ctx.font = '600 12px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0d0f14';
  ctx.beginPath();
  ctx.roundRect(mx + perp.x - 12, my + perp.y - 9, 24, 18, 4);
  ctx.fill();
  ctx.fillStyle = isPath ? '#00e676' : isVisited ? '#ffb300' : '#5c647e';
  ctx.fillText(e.weight, mx + perp.x, my + perp.y);
  ctx.restore();
}

function drawNode(n) {
  const c = COLORS[n.status] || COLORS.default;

  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur  = n.status !== 'default' ? 20 : 10;

  // Fill
  ctx.beginPath();
  ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
  ctx.fillStyle = c.fill;
  ctx.fill();

  // Stroke
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = c.stroke;
  ctx.stroke();

  ctx.restore();

  // Label
  ctx.save();
  ctx.font = `700 ${NODE_R < 18 ? 11 : 14}px 'Syne', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(n.label, n.x, n.y);
  ctx.restore();

  // Distance badge (shown during/after algorithm)
  if (n.dist !== undefined && n.dist !== Infinity) {
    ctx.save();
    ctx.font = '600 10px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const txt = n.dist;
    ctx.fillStyle = 'rgba(13,15,20,.85)';
    ctx.beginPath();
    ctx.roundRect(n.x - 14, n.y + NODE_R + 3, 28, 14, 3);
    ctx.fill();
    ctx.fillStyle = n.status === 'path' ? '#00e676' : n.status === 'visited' ? '#ffb300' : '#5c647e';
    ctx.fillText(txt, n.x, n.y + NODE_R + 10);
    ctx.restore();
  }
}

// ─── Dijkstra Algorithm ──────────────────────────────────────────────

function buildAdjacency() {
  const adj = {};
  state.nodes.forEach(n => { adj[n.id] = []; });
  state.edges.forEach(e => {
    adj[e.from].push({ to: e.to,   weight: e.weight, edgeId: e.id });
    adj[e.to].push(  { to: e.from, weight: e.weight, edgeId: e.id });
  });
  return adj;
}

// Simple min-heap priority queue
class MinHeap {
  constructor() { this.data = []; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].dist <= this.data[i].dist) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let min = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.data[l].dist < this.data[min].dist) min = l;
      if (r < n && this.data[r].dist < this.data[min].dist) min = r;
      if (min === i) break;
      [this.data[min], this.data[i]] = [this.data[i], this.data[min]];
      i = min;
    }
  }
}

function dijkstra(sourceId) {
  const adj  = buildAdjacency();
  const dist = {}, prev = {}, prevEdge = {};
  const steps = []; // animation steps

  state.nodes.forEach(n => {
    dist[n.id] = n.id === sourceId ? 0 : Infinity;
    prev[n.id]     = null;
    prevEdge[n.id] = null;
  });

  const pq = new MinHeap();
  pq.push({ dist: 0, id: sourceId });

  const visited = new Set();

  while (pq.size > 0) {
    const { dist: d, id: u } = pq.pop();
    if (visited.has(u)) continue;
    visited.add(u);

    steps.push({ type: 'visit', nodeId: u, dist: d });

    for (const { to: v, weight: w, edgeId } of adj[u]) {
      if (visited.has(v)) continue;
      const nd = dist[u] + w;
      if (nd < dist[v]) {
        dist[v]     = nd;
        prev[v]     = u;
        prevEdge[v] = edgeId;
        pq.push({ dist: nd, id: v });
        steps.push({ type: 'relax', nodeId: v, fromId: u, edgeId, dist: nd });
      }
    }
  }

  return { dist, prev, prevEdge, steps };
}

function getPath(prev, sourceId, targetId) {
  const path = [];
  let cur = targetId;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur];
  }
  if (path[0] !== sourceId) return null; // not reachable
  return path;
}

// ─── Animation ───────────────────────────────────────────────────────
function clearRunColors() {
  state.nodes.forEach(n => { delete n.dist; n.status = 'default'; });
  state.edges.forEach(e => { e.status = 'default'; });
  draw();
}

btnRun.addEventListener('click', async () => {
  if (state.running) return;

  const srcId = parseInt(selSource.value);
  if (!srcId) { logInfo('⚠ Selecione um nó de origem.'); return; }
  if (state.nodes.length < 2) { logInfo('⚠ Adicione pelo menos 2 nós.'); return; }

  clearRunColors();
  state.running = true;
  btnRun.disabled = true;
  btnClearRun.disabled = false;

  logBox.innerHTML = '';
  logInfo('Iniciando Dijkstra...');

  const srcNode = state.nodes.find(n => n.id === srcId);
  srcNode.status = 'source';
  draw();

  const { dist, prev, prevEdge, steps } = dijkstra(srcId);
  const tgtId = parseInt(selTarget.value) || null;
  const delay = () => 1600 - parseInt(speedInput.value);

  // Animate steps
  for (const step of steps) {
    if (!state.running) break;

    if (step.type === 'visit') {
      const n = state.nodes.find(x => x.id === step.nodeId);
      if (n && n.status !== 'source') n.status = 'visiting';
      if (n) n.dist = step.dist;
      logVisit(`Visitando <strong>${n?.label}</strong> — dist: ${step.dist}`);
      draw();
      await sleep(delay());
      if (n && n.status === 'visiting') n.status = 'visited';
      if (n) n.dist = step.dist;
      draw();
    }

    if (step.type === 'relax') {
      const n = state.nodes.find(x => x.id === step.nodeId);
      const e = state.edges.find(x => x.id === step.edgeId);
      if (n) { n.dist = step.dist; }
      if (e) e.status = 'visited';
      const src = state.nodes.find(x => x.id === step.fromId);
      logInfo(`  Relaxando ${src?.label} → ${n?.label} = ${step.dist}`);
      draw();
      await sleep(delay() * .4);
    }
  }

  if (!state.running) return;

  // Highlight shortest path(s)
  if (tgtId) {
    const path = getPath(prev, srcId, tgtId);
    if (path) {
      highlightPath(path, prevEdge, dist, tgtId);
    } else {
      const tgtNode = state.nodes.find(n => n.id === tgtId);
      logInfo(`⚠ Nó ${tgtNode?.label} não alcançável a partir de ${srcNode.label}`);
    }
  } else {
    // Highlight all reachable paths from source
    state.nodes.forEach(n => {
      if (n.id !== srcId && dist[n.id] !== Infinity) {
        const path = getPath(prev, srcId, n.id);
        if (path) highlightPath(path, prevEdge, dist, n.id, false);
      }
    });
    // Re-mark source
    const s = state.nodes.find(n => n.id === srcId);
    if (s) s.status = 'path';
    logDone(`✓ Dijkstra completo a partir de ${srcNode.label}`);
  }

  showDistances(dist, srcId, tgtId, prev, prevEdge);
  draw();
  state.running = false;
  btnRun.disabled = false;
});

function highlightPath(path, prevEdge, dist, tgtId, log = true) {
  path.forEach(nid => {
    const n = state.nodes.find(x => x.id === nid);
    if (n) { n.status = 'path'; n.dist = dist[nid]; }
  });
  // Mark path edges
  for (let i = 1; i < path.length; i++) {
    const eid = prevEdge[path[i]];
    const e = state.edges.find(x => x.id === eid);
    if (e) e.status = 'path';
  }
  if (log) {
    const labels = path.map(id => state.nodes.find(n => n.id === id)?.label).join(' → ');
    const tgt = state.nodes.find(n => n.id === tgtId);
    logPath(`Caminho → ${labels} (total: ${dist[tgtId]})`);
  }
}

function showDistances(dist, srcId, tgtId, prev, prevEdge) {
  distOutput.innerHTML = '';
  const srcNode = state.nodes.find(n => n.id === srcId);
  state.nodes.forEach(n => {
    const d = dist[n.id];
    const isPath = tgtId
      ? (getPath(prev, srcId, tgtId) || []).includes(n.id)
      : d !== Infinity;
    const row = document.createElement('div');
    row.className = 'dist-row' + (isPath ? ' path' : '') + (d === Infinity ? ' unreachable' : '');
    row.innerHTML = `
      <span class="dist-node">${srcNode.label} → ${n.label}</span>
      <span class="dist-val ${d === Infinity ? 'inf' : ''}">${d === Infinity ? '∞' : d}</span>
    `;
    distOutput.appendChild(row);
  });
}

// ─── Controls ────────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  if (state.running) { state.running = false; }
  state.nodes = [];
  state.edges = [];
  state.edgePending = null;
  state.nodeCounter = 0;
  state.edgeCounter = 0;
  labelIdx = 0;
  updateSelects();
  clearRunColors();
  distOutput.innerHTML = '<p class="hint">Execute o algoritmo para ver os resultados.</p>';
  logBox.innerHTML = '<p class="hint">Adicione nós e arestas, depois execute.</p>';
  btnRun.disabled = false;
  btnClearRun.disabled = true;
  draw();
});

btnClearRun.addEventListener('click', () => {
  if (state.running) { state.running = false; }
  clearRunColors();
  distOutput.innerHTML = '<p class="hint">Execute o algoritmo para ver os resultados.</p>';
  btnRun.disabled = false;
  btnClearRun.disabled = true;
  logInfo('Execução limpa.');
});

// ─── Log Helpers ─────────────────────────────────────────────────────
function addLog(msg, cls) {
  const p = document.createElement('p');
  p.className = `log-entry ${cls}`;
  p.innerHTML = msg;
  logBox.appendChild(p);
  logBox.scrollTop = logBox.scrollHeight;
}
const logInfo  = m => addLog(m, 'info');
const logVisit = m => addLog(m, 'visit');
const logPath  = m => addLog(m, 'path');
const logDone  = m => addLog(m, 'done');

// ─── Utility ─────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Demo Graph ──────────────────────────────────────────────────────
function loadDemo() {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const R  = Math.min(canvas.width, canvas.height) * .30;

  const positions = [
    { x: cx,           y: cy - R      },   // A - top
    { x: cx + R*.85,   y: cy - R*.4  },    // B
    { x: cx + R*.9,    y: cy + R*.55 },    // C
    { x: cx,           y: cy + R      },   // D - bottom
    { x: cx - R*.9,    y: cy + R*.55 },    // E
    { x: cx - R*.85,   y: cy - R*.4  },    // F
    { x: cx,           y: cy          },   // G - center
  ];

  positions.forEach(p => addNode(p.x, p.y));

  const [A, B, C, D, E, F, G] = state.nodes;

  const edgeList = [
    [A, B, 4], [A, F, 2],
    [B, G, 5], [B, C, 3],
    [F, G, 6], [F, E, 8],
    [G, C, 7], [G, D, 9], [G, E, 1],
    [C, D, 2],
    [E, D, 4],
  ];

  edgeList.forEach(([from, to, w]) => addEdge(from, to, w));

  selSource.value = A.id;
  logInfo('Grafo de exemplo carregado. Clique em ▶ Executar!');
}

// ─── Init ────────────────────────────────────────────────────────────
resizeCanvas();
setTimeout(loadDemo, 120);
