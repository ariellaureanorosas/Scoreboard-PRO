/**
 * PAINEL DE CONTROLE - JavaScript
 * 
 * Gerencia todas as interações do painel e comunica com o servidor
 * via WebSocket para atualizar o overlay em tempo real.
 */

const socket = io();

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Referências dos elementos DOM
const elements = {
  // Placar
  scoreDisplayA: document.getElementById('scoreDisplayA'),
  scoreDisplayB: document.getElementById('scoreDisplayB'),
  teamNameA: document.getElementById('teamNameA'),
  teamNameB: document.getElementById('teamNameB'),
  
  // Cronômetro
  timerDisplay: document.getElementById('timerDisplay'),
  btnStartPause: document.getElementById('btnStartPause'),
  timerDuration: document.getElementById('timerDuration'),
  
  // Faltas
  foulsDisplayA: document.getElementById('foulsDisplayA'),
  foulsDisplayB: document.getElementById('foulsDisplayB'),
  foulsTeamNameA: document.getElementById('foulsTeamNameA'),
  foulsTeamNameB: document.getElementById('foulsTeamNameB'),
  
  // Times
  teamNameInputA: document.getElementById('teamNameInputA'),
  teamNameInputB: document.getElementById('teamNameInputB'),
  teamAbbrInputA: document.getElementById('teamAbbrInputA'),
  teamAbbrInputB: document.getElementById('teamAbbrInputB'),
  teamColorPrimaryA: document.getElementById('teamColorPrimaryA'),
  teamColorSecondaryA: document.getElementById('teamColorSecondaryA'),
  teamColorPrimaryB: document.getElementById('teamColorPrimaryB'),
  teamColorSecondaryB: document.getElementById('teamColorSecondaryB'),
  logoPreviewA: document.getElementById('logoPreviewA'),
  logoPreviewB: document.getElementById('logoPreviewB'),
  logoInputA: document.getElementById('logoInputA'),
  logoInputB: document.getElementById('logoInputB'),
  
  // Logo da competição
  competitionLogoInput: document.getElementById('competitionLogoInput'),
  competitionLogoPreview: document.getElementById('competitionLogoPreview'),
  
  // Modo Expandido
  btnExpandedMode: document.getElementById('btnExpandedMode'),
  expandedAutoHideSeconds: document.getElementById('expandedAutoHideSeconds'),
  
  // Info do Gol
  goalScorerA: document.getElementById('goalScorerA'),
  goalScorerB: document.getElementById('goalScorerB'),

  // Eventos
  eventsList: document.getElementById('eventsList'),
  eventsEmpty: document.getElementById('eventsEmpty'),

  // Pré-Jogo
  btnPreMatch: document.getElementById('btnPreMatch'),
  preMatchCompetitionName: document.getElementById('preMatchCompetitionName'),
  preMatchCompetitionSubtitle: document.getElementById('preMatchCompetitionSubtitle'),
  preMatchLogoInput: document.getElementById('preMatchLogoInput'),
  preMatchLogoPreview: document.getElementById('preMatchLogoPreview'),

  // Gerenciar Times
  teamsList: document.getElementById('teamsList'),
  teamsEmpty: document.getElementById('teamsEmpty'),
  teamModal: document.getElementById('teamModal'),
  teamModalTitle: document.getElementById('teamModalTitle'),
  teamForm: document.getElementById('teamForm'),
  teamId: document.getElementById('teamId'),
  teamName: document.getElementById('teamName'),
  teamAbbr: document.getElementById('teamAbbr'),
  teamLogoInput: document.getElementById('teamLogoInput'),
  teamLogoPreview: document.getElementById('teamLogoPreview'),
  teamLogoData: document.getElementById('teamLogoData'),
  playersList: document.getElementById('playersList'),
  
  // Status
  connectionStatus: document.getElementById('connectionStatus')
};

// Estado atual do jogo
let currentState = null;

/**
 * Formata segundos para MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Atualiza a interface com o estado do jogo
 */
function updateUI(state) {
  currentState = state;
  
  // Placar
  elements.scoreDisplayA.textContent = state.teamA.goals;
  elements.scoreDisplayB.textContent = state.teamB.goals;
  elements.teamNameA.textContent = state.teamA.name;
  elements.teamNameB.textContent = state.teamB.name;
  
  // Faltas
  elements.foulsDisplayA.textContent = state.teamA.fouls;
  elements.foulsDisplayB.textContent = state.teamB.fouls;
  elements.foulsTeamNameA.textContent = state.teamA.name;
  elements.foulsTeamNameB.textContent = state.teamB.name;
  
  // Cronômetro
  elements.timerDisplay.textContent = formatTime(state.timer.remaining);
  elements.timerDuration.value = Math.floor(state.timer.duration / 60);
  
  // Botão Iniciar/Pausar
  if (state.timer.running) {
    elements.btnStartPause.textContent = 'Pausar';
    elements.btnStartPause.classList.add('running');
  } else {
    elements.btnStartPause.textContent = 'Iniciar';
    elements.btnStartPause.classList.remove('running');
  }
  
  // Nomes dos times nos inputs
  elements.teamNameInputA.value = state.teamA.name;
  elements.teamNameInputB.value = state.teamB.name;
  
  // Siglas
  elements.teamAbbrInputA.value = state.teamA.abbreviation || '';
  elements.teamAbbrInputB.value = state.teamB.abbreviation || '';
  
  // Cores
  elements.teamColorPrimaryA.value = state.teamA.colorPrimary || '#000000';
  elements.teamColorSecondaryA.value = state.teamA.colorSecondary || '#ffffff';
  elements.teamColorPrimaryB.value = state.teamB.colorPrimary || '#e51937';
  elements.teamColorSecondaryB.value = state.teamB.colorSecondary || '#000000';
  
  // Logos
  updateLogoPreview('A', state.teamA.logo);
  updateLogoPreview('B', state.teamB.logo);
  
  // Logo da competição
  updateCompetitionLogoPreview(state.competitionLogo);
  
  // Modo expandido
  if (state.expandedMode) {
    elements.btnExpandedMode.textContent = 'Ocultar Expandido';
    elements.btnExpandedMode.classList.add('active');
  } else {
    elements.btnExpandedMode.textContent = 'Mostrar Expandido';
    elements.btnExpandedMode.classList.remove('active');
  }
  
  // Pré-Jogo
  updatePreMatch(state);
  
  // Auto-hide seconds
  elements.expandedAutoHideSeconds.value = state.expandedAutoHideSeconds || 10;
}

/**
 * Atualiza o preview do logo
 */
function updateLogoPreview(team, logoPath) {
  const preview = team === 'A' ? elements.logoPreviewA : elements.logoPreviewB;
  
  if (logoPath) {
    preview.innerHTML = `<img src="${logoPath}" alt="Escudo Time ${team}">`;
  } else {
    preview.innerHTML = '';
  }
}

/**
 * Atualiza o preview do logo da competição
 */
function updateCompetitionLogoPreview(logoPath) {
  if (logoPath) {
    elements.competitionLogoPreview.innerHTML = `<img src="${logoPath}" alt="Logo Competição">`;
  } else {
    elements.competitionLogoPreview.innerHTML = '';
  }
}

/**
 * Atualiza o estado do modo pré-jogo na UI
 */
function updatePreMatch(state) {
  if (state.preMatchMode) {
    elements.btnPreMatch.textContent = 'Ocultar Pré-Jogo';
    elements.btnPreMatch.classList.add('active');
  } else {
    elements.btnPreMatch.textContent = 'Mostrar Pré-Jogo';
    elements.btnPreMatch.classList.remove('active');
  }
  elements.preMatchCompetitionName.value = state.competitionName || 'COCA-COLA LEAGUE';
  elements.preMatchCompetitionSubtitle.value = state.competitionSubtitle || '';
  if (state.preMatchLogo) {
    elements.preMatchLogoPreview.innerHTML = `<img src="${state.preMatchLogo}" alt="Logo Pré-Jogo">`;
  } else {
    elements.preMatchLogoPreview.innerHTML = '';
  }
}

// ========================
// FUNÇÕES DE CONTROLE
// ========================

/**
 * Atualiza o placar
 */
function updateScore(team, action) {
  if (action !== 'increment') return;

  const scorerInput = team === 'A' ? elements.goalScorerA : elements.goalScorerB;
  const scorer = scorerInput.value.trim();

  if (!scorer) {
    alert('Digite o nome do artilheiro antes de marcar o gol.');
    return;
  }

  socket.emit('goalEvents:add', { team, name: scorer });
  socket.emit('expandedMode:show', { autoHide: true, seconds: parseInt(elements.expandedAutoHideSeconds.value) || 10 });
  scorerInput.value = '';
}

function renderEvents(state) {
  const events = Array.isArray(state.goalEvents) ? [...state.goalEvents].reverse() : [];
  elements.eventsList.innerHTML = '';
  elements.eventsEmpty.style.display = events.length ? 'none' : 'block';

  events.forEach(ev => {
    const li = document.createElement('li');
    li.className = 'event-item';

    const teamState = ev.team === 'B' ? (currentState && currentState.teamB) : (currentState && currentState.teamA);
    const tag = document.createElement('span');
    tag.className = 'event-team team-' + (ev.team === 'B' ? 'b' : 'a');
    tag.textContent = (teamState && teamState.abbreviation) || (ev.team === 'B' ? 'TIME B' : 'TIME A');
    if (teamState && teamState.colorPrimary) tag.style.background = teamState.colorPrimary;

    const name = document.createElement('span');
    name.className = 'event-name';
    name.textContent = ev.name.toUpperCase();

    const btn = document.createElement('button');
    btn.className = 'event-remove';
    btn.textContent = '\u2715';
    btn.title = 'Remover gol';
    btn.onclick = () => socket.emit('goalEvents:remove', { id: ev.id });

    li.appendChild(tag);
    li.appendChild(name);
    li.appendChild(btn);
    elements.eventsList.appendChild(li);
  });
}

/**
 * Atualiza as faltas
 */
function updateFouls(team, action) {
  socket.emit('fouls:update', { team, action });
}

/**
 * Controla o cronômetro (iniciar/pausar)
 */
function toggleTimer() {
  if (currentState && currentState.timer.running) {
    socket.emit('timer:action', { action: 'pause' });
  } else {
    socket.emit('timer:action', { action: 'start' });
  }
}

/**
 * Zera o cronômetro
 */
function resetTimer() {
  if (confirm('Tem certeza que deseja zerar o cronômetro?')) {
    socket.emit('timer:action', { action: 'reset' });
  }
}

/**
 * Define a duração do período
 */
function setTimerDuration() {
  const minutes = parseInt(elements.timerDuration.value) || 20;
  const seconds = minutes * 60;
  socket.emit('timer:action', { action: 'setDuration', value: seconds });
}

/**
 * Ajusta o tempo manualmente
 */
function adjustTimer(seconds) {
  socket.emit('timer:action', { action: 'adjust', value: seconds });
}

/**
 * Reseta o placar
 */
function resetScore() {
  if (confirm('Tem certeza que deseja resetar o placar? Isso irá zerar os gols dos dois times.')) {
    socket.emit('score:update', { team: 'A', action: 'reset' });
    socket.emit('score:update', { team: 'B', action: 'reset' });
  }
}

/**
 * Alterna modo pré-jogo no overlay
 */
function togglePreMatch() {
  socket.emit('preMatch:toggle');
}

/**
 * Salva dados do pré-jogo (nome da competição e subtítulo)
 */
function savePreMatch() {
  const name = elements.preMatchCompetitionName.value.trim();
  const subtitle = elements.preMatchCompetitionSubtitle.value.trim();
  socket.emit('preMatch:update', { name, subtitle });
}

/**
 * Upload da logo do pré-jogo
 */
function uploadPreMatchLogo() {
  const input = elements.preMatchLogoInput;
  const file = input.files[0];
  if (!file) return;

  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    alert('Tipo de arquivo não permitido. Use PNG, JPG ou SVG.');
    input.value = '';
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('Arquivo muito grande. Tamanho máximo: 2MB.');
    input.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('logo', file);

  fetch('/api/upload-pre-match-logo', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      elements.preMatchLogoPreview.innerHTML = `<img src="${data.logo}" alt="Logo Pré-Jogo">`;
    } else {
      alert('Erro ao enviar logo: ' + (data.error || 'Erro desconhecido'));
    }
  })
  .catch(err => {
    alert('Erro ao enviar logo: ' + err.message);
  });

  input.value = '';
}

/**
 * Remove a logo do pré-jogo
 */
function removePreMatchLogo() {
  fetch('/api/pre-match-logo', { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        elements.preMatchLogoPreview.innerHTML = '';
      }
    })
    .catch(err => {
      alert('Erro ao remover logo: ' + err.message);
    });
}

/**
 * Reseta as faltas
 */
function resetFouls() {
  if (confirm('Tem certeza que deseja resetar as faltas?')) {
    socket.emit('fouls:update', { team: 'A', action: 'resetAll' });
    socket.emit('fouls:update', { team: 'B', action: 'resetAll' });
  }
}

/**
 * Alterna modo expandido no overlay
 */
function toggleExpandedMode() {
  socket.emit('expandedMode:toggle');
}

/**
 * Reseta cronômetro e faltas para novo período
 */
function resetForNewPeriod() {
  if (confirm('Resetar cronômetro e faltas para o novo período?')) {
    socket.emit('timer:action', { action: 'reset' });
    socket.emit('fouls:update', { team: 'A', action: 'reset' });
    socket.emit('fouls:update', { team: 'B', action: 'reset' });
  }
}

/**
 * Atualiza o nome do time
 */
function updateTeamName(team) {
  const input = team === 'A' ? elements.teamNameInputA : elements.teamNameInputB;
  const name = input.value.trim();
  if (name) {
    socket.emit('team:update', { team, name });
  }
}

/**
 * Faz upload do logo — abre o editor de recorte
 */
function uploadLogo(team) {
  const input = team === 'A' ? elements.logoInputA : elements.logoInputB;
  const file = input.files[0];

  if (!file) return;

  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    alert('Tipo de arquivo não permitido. Use PNG, JPG ou SVG.');
    input.value = '';
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('Arquivo muito grande. Tamanho máximo: 2MB.');
    input.value = '';
    return;
  }

  openCropModal(file, `team:${team}`);
  input.value = '';
}

/**
 * Remove o logo
 */
function removeLogo(team) {
  if (confirm('Remover o escudo deste time?')) {
    fetch(`/api/logo/${team}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          updateLogoPreview(team, null);
        }
      })
      .catch(err => {
        alert('Erro ao remover logo: ' + err.message);
      });
  }
}

/**
 * Faz upload do logo da competição — abre o editor de recorte
 */
function uploadCompetitionLogo() {
  const input = elements.competitionLogoInput;
  const file = input.files[0];

  if (!file) return;

  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    alert('Tipo de arquivo não permitido. Use PNG, JPG ou SVG.');
    input.value = '';
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('Arquivo muito grande. Tamanho máximo: 2MB.');
    input.value = '';
    return;
  }

  openCropModal(file, 'competition');
  input.value = '';
}

// ========================
// EDITOR DE RECORTE DE IMAGEM
// ========================

// ATENÇÃO: 'competition' deve espelhar --badge-width e --bar-height do overlay.css
const CROP_TARGETS = {
  'competition': { w: 48, h: 44, shape: 'rect',   label: '48 × 44 px' },
  'team:A':      { w: 62, h: 62, shape: 'circle', label: '62 × 62 px (círculo)' },
  'team:B':      { w: 62, h: 62, shape: 'circle', label: '62 × 62 px (círculo)' }
};

// Tamanho máximo do frame no modal (o maior lado)
const CROP_PREVIEW_MAX = 320;

const cropState = {
  img: null,
  target: null,      // 'team:A' | 'team:B' | 'competition'
  scale: 1,          // zoom relativo ao ajuste inicial (fit)
  minScale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  canvasW: 320,
  canvasH: 320
};

function openCropModal(file, target) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      cropState.img = img;
      cropState.target = target;

      // Configura o frame com a proporção real do alvo no placar
      const t = CROP_TARGETS[target];
      const scaleFactor = CROP_PREVIEW_MAX / Math.max(t.w, t.h);
      const canvasW = Math.round(t.w * scaleFactor);
      const canvasH = Math.round(t.h * scaleFactor);

      cropState.canvasW = canvasW;
      cropState.canvasH = canvasH;

      const canvas = document.getElementById('cropCanvas');
      canvas.width = canvasW;
      canvas.height = canvasH;

      const frame = document.getElementById('cropFrame');
      frame.style.width = `${canvasW}px`;
      frame.style.height = `${canvasH}px`;
      frame.classList.toggle('shape-circle', t.shape === 'circle');

      document.getElementById('cropSizeLabel').textContent = `Tamanho real no placar: ${t.label}`;

      resetCropView();
      document.getElementById('cropModal').classList.remove('hidden');
      document.getElementById('cropZoom').value = 100;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function closeCropModal() {
  document.getElementById('cropModal').classList.add('hidden');
  cropState.img = null;
  cropState.target = null;
}

function resetCropView() {
  cropState.scale = 1;
  cropState.offsetX = 0;
  cropState.offsetY = 0;
  drawCropCanvas();
}

function drawCropCanvas() {
  const canvas = document.getElementById('cropCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = cropState.canvasW;
  const h = cropState.canvasH;

  ctx.clearRect(0, 0, w, h);

  // Fundo quadriculado para indicar transparência
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, w, h);

  if (!cropState.img) return;

  const target = CROP_TARGETS[cropState.target];

  ctx.save();

  // Moldura circular para escudos (mesma forma do placar)
  if (target && target.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.clip();
  }

  // Ajuste inicial: imagem cabe inteira na área (contain)
  const img = cropState.img;
  const fitScale = Math.min(w / img.width, h / img.height);
  const drawW = img.width * fitScale * cropState.scale;
  const drawH = img.height * fitScale * cropState.scale;
  const centerX = w / 2 + cropState.offsetX;
  const centerY = h / 2 + cropState.offsetY;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);

  ctx.restore();
}

function confirmCrop() {
  if (!cropState.img || !cropState.target) return;

  const target = CROP_TARGETS[cropState.target];

  // Exporta em alta resolução mantendo a proporção real do alvo
  const exportScale = 512 / Math.max(target.w, target.h);
  const exportW = Math.round(target.w * exportScale);
  const exportH = Math.round(target.h * exportScale);
  // Fator entre canvas de export e canvas de preview (mesma proporção)
  const ratio = exportW / cropState.canvasW;

  const out = document.createElement('canvas');
  out.width = exportW;
  out.height = exportH;
  const octx = out.getContext('2d');

  octx.save();

  if (target.shape === 'circle') {
    octx.beginPath();
    octx.arc(exportW / 2, exportH / 2, Math.min(exportW, exportH) / 2, 0, Math.PI * 2);
    octx.clip();
  }

  const img = cropState.img;
  const fitScale = Math.min(cropState.canvasW / img.width, cropState.canvasH / img.height);
  const drawW = img.width * fitScale * cropState.scale * ratio;
  const drawH = img.height * fitScale * cropState.scale * ratio;
  const centerX = exportW / 2 + cropState.offsetX * ratio;
  const centerY = exportH / 2 + cropState.offsetY * ratio;

  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);

  octx.restore();

  const dataURL = out.toDataURL('image/png');

  let url;
  let onSuccess;
  if (cropState.target === 'competition') {
    url = '/api/upload-competition-logo-crop';
    onSuccess = (data) => updateCompetitionLogoPreview(data.logo);
  } else {
    const team = cropState.target.split(':')[1];
    url = `/api/upload-logo-crop/${team}`;
    onSuccess = (data) => updateLogoPreview(team, data.logo);
  }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataURL })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      onSuccess(data);
      closeCropModal();
    } else {
      alert('Erro ao salvar recorte: ' + (data.error || 'Erro desconhecido'));
    }
  })
  .catch(err => {
    alert('Erro ao salvar recorte: ' + err.message);
  });
}

// Interação com o canvas: arrastar para mover
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('cropCanvas');
  const zoomSlider = document.getElementById('cropZoom');
  if (!canvas) return;

  canvas.addEventListener('mousedown', (e) => {
    cropState.dragging = true;
    cropState.lastX = e.clientX;
    cropState.lastY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!cropState.dragging) return;
    cropState.offsetX += e.clientX - cropState.lastX;
    cropState.offsetY += e.clientY - cropState.lastY;
    cropState.lastX = e.clientX;
    cropState.lastY = e.clientY;
    drawCropCanvas();
  });

  window.addEventListener('mouseup', () => {
    cropState.dragging = false;
  });

  // Zoom com a roda do mouse sobre a área de recorte
  document.getElementById('cropFrame').addEventListener('wheel', (e) => {
    e.preventDefault();
    let zoom = parseInt(zoomSlider.value);
    zoom += e.deltaY < 0 ? 10 : -10;
    zoom = Math.max(100, Math.min(400, zoom));
    zoomSlider.value = zoom;
    applyZoom(zoom);
  }, { passive: false });

  zoomSlider.addEventListener('input', () => {
    applyZoom(parseInt(zoomSlider.value));
  });
});

function applyZoom(zoomPercent) {
  if (!cropState.img) return;
  cropState.scale = zoomPercent / 100;
  drawCropCanvas();
}

/**
 * Remove o logo da competição
 */
function removeCompetitionLogo() {
  if (confirm('Remover o logo da competição?')) {
    fetch('/api/competition-logo', { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          updateCompetitionLogoPreview(null);
        }
      })
      .catch(err => {
        alert('Erro ao remover logo: ' + err.message);
      });
  }
}

/**
 * Reseta tudo
 */
function resetAll() {
  if (confirm('ATENÇÃO: Isso irá resetar placar, faltas, cronômetro e remover todos os escudos. Tem certeza?')) {
    if (confirm('Última chance: confirmar reset geral?')) {
      socket.emit('state:reset');
    }
  }
}

// ========================
// EVENTOS WEBSOCKET
// ========================

// Conexao
socket.on('connect', () => {
  console.log('Conectado ao servidor');
  elements.connectionStatus.classList.add('connected');
  elements.connectionStatus.classList.remove('error');
  elements.connectionStatus.querySelector('.status-text').textContent = 'Conectado';
  
  // Solicita estado inicial
  socket.emit('getInitialState');
});

// Desconexao
socket.on('disconnect', () => {
  console.log('Desconectado do servidor');
  elements.connectionStatus.classList.remove('connected');
  elements.connectionStatus.classList.add('error');
  elements.connectionStatus.querySelector('.status-text').textContent = 'Desconectado';
});

// Erro de conexao
socket.on('connect_error', (err) => {
  console.error('Erro de conexão:', err.message);
  elements.connectionStatus.classList.remove('connected');
  elements.connectionStatus.classList.add('error');
  elements.connectionStatus.querySelector('.status-text').textContent = 'Erro de conexão';
});

// Sincronizacao de estado
socket.on('state:sync', (state) => {
  currentState = state;
  updateUI(state);
  renderEvents(state);
  updatePreMatch(state);
});

// Tick do cronômetro
socket.on('timer:tick', (data) => {
  if (currentState) {
    currentState.timer.remaining = data.remaining;
    currentState.timer.running = data.running;
    elements.timerDisplay.textContent = formatTime(data.remaining);
    
    if (data.running) {
      elements.btnStartPause.textContent = 'Pausar';
      elements.btnStartPause.classList.add('running');
    } else {
      elements.btnStartPause.textContent = 'Iniciar';
      elements.btnStartPause.classList.remove('running');
    }
  }
});

// Reset completo
socket.on('state:resetDone', () => {
  alert('Reset completo realizado!');
});

// ========================
// EVENTOS DE INPUT
// ========================

// Atualização do nome do time com debounce
let nameTimeoutA = null;
let nameTimeoutB = null;

elements.teamNameInputA.addEventListener('input', () => {
  clearTimeout(nameTimeoutA);
  nameTimeoutA = setTimeout(() => updateTeamName('A'), 500);
});

elements.teamNameInputB.addEventListener('input', () => {
  clearTimeout(nameTimeoutB);
  nameTimeoutB = setTimeout(() => updateTeamName('B'), 500);
});

// Enter nos inputs de nome
elements.teamNameInputA.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') updateTeamName('A');
});

elements.teamNameInputB.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') updateTeamName('B');
});

// Atualização da sigla/abreviação
let abbrTimeoutA = null;
let abbrTimeoutB = null;

elements.teamAbbrInputA.addEventListener('input', () => {
  clearTimeout(abbrTimeoutA);
  abbrTimeoutA = setTimeout(() => {
    socket.emit('team:abbreviation', { team: 'A', abbreviation: elements.teamAbbrInputA.value });
  }, 500);
});

elements.teamAbbrInputB.addEventListener('input', () => {
  clearTimeout(abbrTimeoutB);
  abbrTimeoutB = setTimeout(() => {
    socket.emit('team:abbreviation', { team: 'B', abbreviation: elements.teamAbbrInputB.value });
  }, 500);
});

// Atualização das cores
elements.teamColorPrimaryA.addEventListener('input', () => {
  socket.emit('team:colors', { team: 'A', colorPrimary: elements.teamColorPrimaryA.value, colorSecondary: elements.teamColorSecondaryA.value });
});

elements.teamColorSecondaryA.addEventListener('input', () => {
  socket.emit('team:colors', { team: 'A', colorPrimary: elements.teamColorPrimaryA.value, colorSecondary: elements.teamColorSecondaryA.value });
});

elements.teamColorPrimaryB.addEventListener('input', () => {
  socket.emit('team:colors', { team: 'B', colorPrimary: elements.teamColorPrimaryB.value, colorSecondary: elements.teamColorSecondaryB.value });
});

elements.teamColorSecondaryB.addEventListener('input', () => {
  socket.emit('team:colors', { team: 'B', colorPrimary: elements.teamColorPrimaryB.value, colorSecondary: elements.teamColorSecondaryB.value });
});

// Pré-jogo: salvar nome e subtítulo com debounce
function savePreMatchDebounced() {
  clearTimeout(preMatchTimeout);
  preMatchTimeout = setTimeout(() => savePreMatch(), 300);
}

// ========================
// GERENCIAR TIMES
// ========================

let currentTeamId = null;

function loadTeams() {
  fetch('/api/teams')
    .then(res => res.json())
    .then(teams => {
      elements.teamsList.innerHTML = '';
      if (!teams.length) {
        elements.teamsEmpty.style.display = 'block';
        return;
      }
      elements.teamsEmpty.style.display = 'none';

      teams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'team-card';

        const img = document.createElement('img');
        img.src = team.logo || 'https://via.placeholder.com/64?text=TIM';
        img.alt = team.name;

        const name = document.createElement('div');
        name.className = 'team-card-name';
        name.textContent = team.name;

        const abbr = document.createElement('div');
        abbr.className = 'team-card-abbr';
        abbr.textContent = team.abbreviation;

        const actions = document.createElement('div');
        actions.className = 'team-card-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = 'Editar';
        editBtn.onclick = (e) => { e.stopPropagation(); openTeamModal(team.id); };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = 'Excluir';
        deleteBtn.onclick = (e) => { e.stopPropagation(); deleteTeam(team.id); };

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(abbr);
        card.appendChild(actions);
        elements.teamsList.appendChild(card);
      });
    });
}

function openTeamModal(teamId = null) {
  currentTeamId = teamId;
  elements.teamForm.reset();
  elements.teamLogoPreview.innerHTML = '';
  elements.teamLogoData.value = '';

  if (teamId) {
    elements.teamModalTitle.textContent = 'Editar Time';
    fetch(`/api/teams/${teamId}`)
      .then(res => res.json())
      .then(team => {
        elements.teamId.value = team.id;
        elements.teamName.value = team.name;
        elements.teamAbbr.value = team.abbreviation;
        if (team.logo) {
          elements.teamLogoPreview.innerHTML = `<img src="${team.logo}" alt="Escudo">`;
          elements.teamLogoData.value = team.logo;
        }
        renderPlayers(team.players || []);
      });
  } else {
    elements.teamModalTitle.textContent = 'Novo Time';
    elements.teamId.value = '';
    renderPlayers([{ id: uuidv4(), name: '', nickname: '', number: '', position: 'Goleiro', photo: null }]);
  }

  elements.teamModal.classList.remove('hidden');
}

function closeTeamModal() {
  elements.teamModal.classList.add('hidden');
  currentTeamId = null;
}

function renderPlayers(players) {
  elements.playersList.innerHTML = '';
  const positions = ['Goleiro', 'Fixo', 'Ala', 'Ala', 'Pivô'];

  players.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'player-row';

    const photo = document.createElement('img');
    photo.className = 'player-photo';
    photo.src = player.photo || 'https://via.placeholder.com/36?text=?';
    photo.alt = 'Foto';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Nome completo';
    nameInput.value = player.name || '';

    const nicknameInput = document.createElement('input');
    nicknameInput.type = 'text';
    nicknameInput.placeholder = 'Apelido';
    nicknameInput.value = player.nickname || '';

    const numberInput = document.createElement('input');
    numberInput.type = 'text';
    numberInput.placeholder = 'Nº';
    numberInput.value = player.number || '';
    numberInput.style.width = '50px';

    const posSelect = document.createElement('select');
    positions.forEach(pos => {
      const opt = document.createElement('option');
      opt.value = pos;
      opt.textContent = pos;
      if (player.position === pos) opt.selected = true;
      posSelect.appendChild(opt);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-player';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => row.remove();

    row.appendChild(photo);
    row.appendChild(nameInput);
    row.appendChild(nicknameInput);
    row.appendChild(numberInput);
    row.appendChild(posSelect);
    row.appendChild(removeBtn);
    elements.playersList.appendChild(row);
  });
}

function addPlayerRow() {
  const row = document.createElement('div');
  row.className = 'player-row';

  const photo = document.createElement('img');
  photo.className = 'player-photo';
  photo.src = 'https://via.placeholder.com/36?text=?';
  photo.alt = 'Foto';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Nome completo';

  const nicknameInput = document.createElement('input');
  nicknameInput.type = 'text';
  nicknameInput.placeholder = 'Apelido';

  const numberInput = document.createElement('input');
  numberInput.type = 'text';
  numberInput.placeholder = 'Nº';
  numberInput.style.width = '50px';

  const posSelect = document.createElement('select');
  ['Goleiro', 'Fixo', 'Ala', 'Ala', 'Pivô'].forEach(pos => {
    const opt = document.createElement('option');
    opt.value = pos;
    opt.textContent = pos;
    posSelect.appendChild(opt);
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove-player';
  removeBtn.textContent = '✕';
  removeBtn.onclick = () => row.remove();

  row.appendChild(photo);
  row.appendChild(nameInput);
  row.appendChild(nicknameInput);
  row.appendChild(numberInput);
  row.appendChild(posSelect);
  row.appendChild(removeBtn);
  elements.playersList.appendChild(row);
}

function uploadTeamLogo() {
  const input = elements.teamLogoInput;
  const file = input.files[0];
  if (!file) return;

  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    alert('Tipo de arquivo não permitido. Use PNG, JPG ou SVG.');
    input.value = '';
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('Arquivo muito grande. Tamanho máximo: 2MB.');
    input.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('logo', file);

  const teamId = elements.teamId.value || 'new';
  fetch(`/api/teams/${teamId}/logo`, {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      elements.teamLogoPreview.innerHTML = `<img src="${data.logo}" alt="Escudo">`;
      elements.teamLogoData.value = data.logo;
    } else {
      alert('Erro ao enviar logo: ' + (data.error || 'Erro desconhecido'));
    }
  })
  .catch(err => {
    alert('Erro ao enviar logo: ' + err.message);
  });

  input.value = '';
}

function saveTeam(event) {
  event.preventDefault();

  const name = elements.teamName.value.trim();
  if (!name) {
    alert('Nome do time é obrigatório.');
    return;
  }

  const abbreviation = elements.teamAbbr.value.trim().toUpperCase();
  const logo = elements.teamLogoData.value;

  const playerRows = elements.playersList.querySelectorAll('.player-row');
  const players = [];
  playerRows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const select = row.querySelector('select');
    const playerName = inputs[0].value.trim();
    if (!playerName) return;

    players.push({
      id: uuidv4(),
      name: playerName,
      nickname: inputs[1].value.trim(),
      number: inputs[2].value.trim(),
      position: select.value,
      photo: null
    });
  });

  const payload = { name, abbreviation, players };

  if (currentTeamId) {
    fetch(`/api/teams/${currentTeamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(() => {
      closeTeamModal();
      loadTeams();
    })
    .catch(err => alert('Erro ao salvar time: ' + err.message));
  } else {
    fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(team => {
      // Upload logo se houver
      const logoInput = elements.teamLogoInput;
      if (logoInput.files[0]) {
        const formData = new FormData();
        formData.append('logo', logoInput.files[0]);
        fetch(`/api/teams/${team.id}/logo`, {
          method: 'POST',
          body: formData
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            elements.teamLogoData.value = data.logo;
            saveTeamLogoReference(team.id, data.logo);
          }
        });
      }
      closeTeamModal();
      loadTeams();
    })
    .catch(err => alert('Erro ao criar time: ' + err.message));
  }
}

function saveTeamLogoReference(teamId, logoPath) {
  fetch(`/api/teams/${teamId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logo: logoPath })
  }).catch(err => console.error('Erro ao salvar logo:', err));
}

function deleteTeam(teamId) {
  if (!confirm('Tem certeza que deseja excluir este time? Esta ação não pode ser desfeita.')) return;

  fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(() => loadTeams())
    .catch(err => alert('Erro ao excluir time: ' + err.message));
}

// Pré-jogo: salvar nome e subtítulo com debounce
function savePreMatchDebounced() {
  clearTimeout(preMatchTimeout);
  preMatchTimeout = setTimeout(() => savePreMatch(), 300);
}

elements.preMatchCompetitionName.addEventListener('input', savePreMatchDebounced);
elements.preMatchCompetitionSubtitle.addEventListener('input', savePreMatchDebounced);

// ========================
// INICIALIZAÇÃO
// ========================

loadTeams();

// Busca estado inicial via HTTP como fallback
fetch('/api/state')
  .then(res => res.json())
  .then(state => {
    updateUI(state);
  })
  .catch(err => {
    console.error('Erro ao buscar estado inicial:', err);
  });
