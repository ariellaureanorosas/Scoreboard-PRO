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
  teamSelectA: document.getElementById('teamSelectA'),
  teamSelectB: document.getElementById('teamSelectB'),
  teamPreviewA: document.getElementById('teamPreviewA'),
  teamPreviewB: document.getElementById('teamPreviewB'),
  
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

  // Modal de artilheiro
  goalScorerModal: document.getElementById('goalScorerModal'),
  goalScorerList: document.getElementById('goalScorerList'),
  goalMinute: document.getElementById('goalMinute'),
  goalType: document.getElementById('goalType'),

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
  teamColorPrimary: document.getElementById('teamColorPrimary'),
  teamColorSecondary: document.getElementById('teamColorSecondary'),
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
  
  // Nomes dos times
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

  const teamKey = team === 'A' ? 'teamA' : 'teamB';
  const teamData = currentState ? currentState[teamKey] : null;
  const players = teamData && Array.isArray(teamData.players) ? teamData.players : [];

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
    
    let displayName = ev.playerNickname || ev.name || '';
    if (!displayName && ev.playerId) {
      const player = teamState && teamState.players ? teamState.players.find(p => p.id === ev.playerId) : null;
      displayName = player ? (player.nickname || player.name) : 'Gol';
    }
    if (!displayName) displayName = 'Gol';
    
    let suffix = '';
    if (ev.minute) suffix += ` ${ev.minute}'`;
    if (ev.type && ev.type !== 'normal') suffix += ` (${ev.type === 'penalty' ? 'P' : ev.type === 'own' ? 'GC' : ev.type.toUpperCase()})`;
    if (ev.goalsInMatchAtThisPoint > 1) suffix += ` (${ev.goalsInMatchAtThisPoint}º)`;
    
    name.textContent = displayName.toUpperCase() + suffix;

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

// ========================
// MODAL DE ARTILHEIRO
// ========================

let goalScorerTeam = null;
let goalScorerPlayers = [];

function openGoalScorerModal(team, players) {
  goalScorerTeam = team;
  goalScorerPlayers = players;
  
  const currentMinute = currentState ? formatTime(currentState.timer.remaining) : '';
  elements.goalMinute.value = currentMinute;
  elements.goalType.value = 'normal';
  
  renderGoalScorerList();
  elements.goalScorerModal.classList.remove('hidden');
}

function closeGoalScorerModal() {
  elements.goalScorerModal.classList.add('hidden');
  goalScorerTeam = null;
  goalScorerPlayers = [];
}

function renderGoalScorerList() {
  elements.goalScorerList.innerHTML = '';
  
  const noScorerBtn = document.createElement('button');
  noScorerBtn.className = 'goal-scorer-option';
  noScorerBtn.textContent = 'Sem artilheiro definido';
  noScorerBtn.onclick = () => {
    socket.emit('goal:scored', {
      team: goalScorerTeam,
      scorerName: '',
      minute: elements.goalMinute.value || null,
      type: elements.goalType.value || 'normal'
    });
    socket.emit('expandedMode:show', { autoHide: true, seconds: parseInt(elements.expandedAutoHideSeconds.value) || 10 });
    closeGoalScorerModal();
  };
  elements.goalScorerList.appendChild(noScorerBtn);
  
  const ownGoalBtn = document.createElement('button');
  ownGoalBtn.className = 'goal-scorer-option';
  ownGoalBtn.textContent = 'Gol contra';
  ownGoalBtn.onclick = () => {
    socket.emit('goal:scored', {
      team: goalScorerTeam,
      scorerName: '',
      minute: elements.goalMinute.value || null,
      type: 'own'
    });
    socket.emit('expandedMode:show', { autoHide: true, seconds: parseInt(elements.expandedAutoHideSeconds.value) || 10 });
    closeGoalScorerModal();
  };
  elements.goalScorerList.appendChild(ownGoalBtn);
  
  goalScorerPlayers.forEach(player => {
    const btn = document.createElement('button');
    btn.className = 'goal-scorer-option goal-scorer-player';
    
    const img = document.createElement('img');
    img.src = player.photo || 'https://via.placeholder.com/40?text=?';
    img.alt = player.nickname || player.name;
    img.className = 'goal-scorer-photo';
    img.onerror = () => { img.src = 'https://via.placeholder.com/40?text=?'; };
    
    const info = document.createElement('div');
    info.className = 'goal-scorer-info';
    
    const nickname = document.createElement('div');
    nickname.className = 'goal-scorer-nickname';
    nickname.textContent = player.nickname || player.name || 'Sem nome';
    
    const position = document.createElement('div');
    position.className = 'goal-scorer-position';
    position.textContent = player.position || '';
    
    info.appendChild(nickname);
    info.appendChild(position);
    btn.appendChild(img);
    btn.appendChild(info);
    
    btn.onclick = () => {
      socket.emit('goal:scored', {
        team: goalScorerTeam,
        playerId: player.id,
        playerNickname: player.nickname || player.name,
        playerPhoto: player.photo || null,
        minute: elements.goalMinute.value || null,
        type: elements.goalType.value || 'normal'
      });
      socket.emit('expandedMode:show', { autoHide: true, seconds: parseInt(elements.expandedAutoHideSeconds.value) || 10 });
      closeGoalScorerModal();
    };
    
    elements.goalScorerList.appendChild(btn);
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
  'team:modal':  { w: 128, h: 128, shape: 'circle', label: '128 × 128 px (círculo)' },
  'player:modal':{ w: 128, h: 128, shape: 'circle', label: '128 × 128 px (círculo)' }
};

// Tamanho máximo do frame no modal (o maior lado)
const CROP_PREVIEW_MAX = 320;

const cropState = {
  img: null,
  target: null,      // 'competition' | 'team:modal' | 'player:modal'
  teamId: null,
  playerId: null,
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

function openCropModal(file, target, extra = {}) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      cropState.img = img;
      cropState.target = target;
      cropState.teamId = extra.teamId || null;
      cropState.playerId = extra.playerId || null;

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

  if (cropState.target === 'competition') {
    fetch('/api/upload-competition-logo-crop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataURL })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        updateCompetitionLogoPreview(data.logo);
        closeCropModal();
      } else {
        alert('Erro ao salvar recorte: ' + (data.error || 'Erro desconhecido'));
      }
    })
    .catch(err => {
      alert('Erro ao salvar recorte: ' + err.message);
    });
    return;
  }

  if (cropState.target === 'team:modal') {
    const blob = dataURLtoBlob(dataURL);
    const formData = new FormData();
    formData.append('logo', blob, 'logo.png');

    if (currentTeamId) {
      fetch(`/api/teams/${currentTeamId}/logo`, { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            elements.teamLogoPreview.innerHTML = `<img src="${data.logo}" alt="Escudo">`;
            elements.teamLogoData.value = data.logo;
            pendingLogoFile = null;
          } else {
            alert('Erro ao salvar escudo: ' + (data.error || 'Erro desconhecido'));
          }
        })
        .catch(err => alert('Erro ao salvar escudo: ' + err.message));
    } else {
      pendingLogoFile = blob;
      elements.teamLogoPreview.innerHTML = `<img src="${dataURL}" alt="Escudo">`;
      elements.teamLogoData.value = dataURL;
    }
    closeCropModal();
    return;
  }

  if (cropState.target === 'player:modal') {
    const playerId = cropState.playerId;
    const blob = dataURLtoBlob(dataURL);
    const formData = new FormData();
    formData.append('photo', blob, 'photo.png');

    const row = document.querySelector(`.player-row[data-player-id="${playerId}"]`);
    const img = row ? row.querySelector('.player-photo') : null;

    if (currentTeamId) {
      fetch(`/api/teams/${currentTeamId}/players/${playerId}/photo`, { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
          if (data.success && img) {
            img.src = data.photo;
            pendingPlayerPhotos.delete(playerId);
            playerPhotoUrls.set(playerId, data.photo);
          } else if (data.error === 'Jogador não encontrado') {
            pendingPlayerPhotos.set(playerId, blob);
            if (img) img.src = dataURL;
          } else {
            alert('Erro ao salvar foto: ' + (data.error || 'Erro desconhecido'));
          }
        })
        .catch(err => alert('Erro ao salvar foto: ' + err.message));
    } else {
      pendingPlayerPhotos.set(playerId, blob);
      if (img) img.src = dataURL;
    }
    closeCropModal();
    return;
  }
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

// ========================
// GERENCIAR TIMES
// ========================

let currentTeamId = null;
let pendingLogoFile = null;
let pendingPlayerPhotos = new Map();
let playerPhotoUrls = new Map();

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
  pendingLogoFile = null;
  pendingPlayerPhotos.clear();
  playerPhotoUrls.clear();
  elements.teamForm.reset();
  elements.teamLogoPreview.innerHTML = '';
  elements.teamLogoData.value = '';
  elements.teamColorPrimary.value = '#000000';
  elements.teamColorSecondary.value = '#ffffff';

  if (teamId) {
    elements.teamModalTitle.textContent = 'Editar Time';
    fetch(`/api/teams/${teamId}`)
      .then(res => res.json())
      .then(team => {
        elements.teamId.value = team.id;
        elements.teamName.value = team.name;
        elements.teamAbbr.value = team.abbreviation;
        elements.teamColorPrimary.value = team.colorPrimary || '#000000';
        elements.teamColorSecondary.value = team.colorSecondary || '#ffffff';
        if (team.logo) {
          elements.teamLogoPreview.innerHTML = `<img src="${team.logo}" alt="Escudo">`;
          elements.teamLogoData.value = team.logo;
        }
        const players = (team.players || []).map(p => ({ ...p }));
        players.forEach(p => {
          if (p.photo) playerPhotoUrls.set(p.id, p.photo);
        });
        renderPlayers(players);
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
  pendingLogoFile = null;
  pendingPlayerPhotos.clear();
  playerPhotoUrls.clear();
}

function renderPlayers(players) {
  elements.playersList.innerHTML = '';
  const positions = ['Goleiro', 'Fixo', 'Ala', 'Ala', 'Pivô'];

  players.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    const pid = player.id || uuidv4();
    row.dataset.playerId = pid;

    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = '.png,.jpg,.jpeg,.svg';
    photoInput.style.display = 'none';
    photoInput.onchange = () => triggerPlayerPhotoUpload(pid, photoInput);

    const photo = document.createElement('img');
    photo.className = 'player-photo';
    photo.src = player.photo || 'https://via.placeholder.com/36?text=?';
    photo.alt = 'Foto';
    photo.style.cursor = 'pointer';
    photo.title = 'Clique para alterar a foto';
    photo.onclick = () => photoInput.click();
    photo.onerror = () => {
      photo.src = 'https://via.placeholder.com/36?text=?';
    };

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

    row.appendChild(photoInput);
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

  const playerId = uuidv4();
  row.dataset.playerId = playerId;

  const photoInput = document.createElement('input');
  photoInput.type = 'file';
  photoInput.accept = '.png,.jpg,.jpeg,.svg';
  photoInput.style.display = 'none';
  photoInput.onchange = () => triggerPlayerPhotoUpload(playerId, photoInput);

  const photo = document.createElement('img');
  photo.className = 'player-photo';
  photo.src = 'https://via.placeholder.com/36?text=?';
  photo.alt = 'Foto';
  photo.style.cursor = 'pointer';
  photo.title = 'Clique para alterar a foto';
  photo.onclick = () => photoInput.click();

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

  row.appendChild(photoInput);
  row.appendChild(photo);
  row.appendChild(nameInput);
  row.appendChild(nicknameInput);
  row.appendChild(numberInput);
  row.appendChild(posSelect);
  row.appendChild(removeBtn);
  elements.playersList.appendChild(row);
}

function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const b64 = atob(parts[1]);
  const arr = new Uint8Array(b64.length);
  for (let i = 0; i < b64.length; i++) {
    arr[i] = b64.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
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

  pendingLogoFile = file;
  openCropModal(file, 'team:modal', { teamId: currentTeamId });
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
    // inputs[0..2] = nome, apelido, número (o input de arquivo da foto fica de fora)
    const inputs = row.querySelectorAll('input[type="text"]');
    const select = row.querySelector('select');
    const playerName = inputs[0].value.trim();
    if (!playerName) return;

    const existingId = row.dataset.playerId;
    const photoUrl = playerPhotoUrls.get(existingId) || null;
    players.push({
      id: existingId || uuidv4(),
      name: playerName,
      nickname: inputs[1].value.trim(),
      number: inputs[2].value.trim(),
      position: select.value,
      photo: photoUrl
    });
  });

  const payload = { name, abbreviation, players, colorPrimary: elements.teamColorPrimary.value, colorSecondary: elements.teamColorSecondary.value };

  function doUploads(teamId) {
    const promises = [];

    if (pendingLogoFile) {
      const formData = new FormData();
      const logoName = pendingLogoFile.name || 'logo.png';
      formData.append('logo', pendingLogoFile, logoName);
      promises.push(
        fetch(`/api/teams/${teamId}/logo`, { method: 'POST', body: formData })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              elements.teamLogoData.value = data.logo;
              return fetch(`/api/teams/${teamId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logo: data.logo })
              });
            }
          })
      );
    }

    pendingPlayerPhotos.forEach((file, playerId) => {
      const formData = new FormData();
      const photoName = file.name || 'photo.png';
      formData.append('photo', file, photoName);
      promises.push(
        fetch(`/api/teams/${teamId}/players/${playerId}/photo`, { method: 'POST', body: formData })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              playerPhotoUrls.set(playerId, data.photo);
            }
          })
      );
    });

    return Promise.all(promises);
  }

  if (currentTeamId) {
    fetch(`/api/teams/${currentTeamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(() => doUploads(currentTeamId))
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
      currentTeamId = team.id;
      return doUploads(team.id);
    })
    .then(() => {
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

function populateTeamSelects() {
  fetch('/api/teams')
    .then(res => res.json())
    .then(teams => {
      ['A', 'B'].forEach(side => {
        const select = document.getElementById(`teamSelect${side}`);
        if (!select) return;
        select.innerHTML = '<option value="">-- Selecionar time --</option>';
        teams.forEach(team => {
          const opt = document.createElement('option');
          opt.value = team.id;
          opt.textContent = `${team.name} (${team.abbreviation})`;
          select.appendChild(opt);
        });
      });

      // Restaura seleção a partir do estado e re-emite dados do time
      // (sincroniza nome, sigla, cores e escudo com o banco de dados)
      fetch('/api/state')
        .then(res => res.json())
        .then(state => {
          ['A', 'B'].forEach(side => {
            const teamState = side === 'A' ? state.teamA : state.teamB;
            const teamId = teamState && teamState.teamId;
            if (!teamId) return;
            const select = document.getElementById(`teamSelect${side}`);
            if (select && [...select.options].some(o => o.value === teamId)) {
              select.value = teamId;
              loadTeamFromDB(side, teamId);
            }
          });
        })
        .catch(() => {});
    });
}

function loadTeamFromDB(side, teamId) {
  const preview = document.getElementById(`teamPreview${side}`);
  if (!teamId) {
    preview.innerHTML = '<div class="team-preview-placeholder">Selecione um time para visualizar os dados</div>';
    socket.emit('team:players', { team: side, players: [] });
    return;
  }

  fetch(`/api/teams/${teamId}`)
    .then(res => {
      if (!res.ok) throw new Error('Time não encontrado');
      return res.json();
    })
    .then(team => {
      preview.innerHTML = `
        <div class="team-preview-content">
          <img src="${team.logo || 'https://via.placeholder.com/48?text=TIM'}" alt="Escudo" class="team-preview-logo">
          <div class="team-preview-info">
            <strong>${team.name}</strong>
            <span class="team-preview-abbr">${team.abbreviation}</span>
            <div class="team-preview-colors">
              <span class="color-swatch" style="background: ${team.colorPrimary || '#000000'}"></span>
              <span class="color-swatch" style="background: ${team.colorSecondary || '#ffffff'}"></span>
            </div>
          </div>
        </div>
      `;

      socket.emit('team:update', { team: side, name: team.name, teamId: team.id });
      socket.emit('team:abbreviation', { team: side, abbreviation: team.abbreviation });
      socket.emit('team:colors', { team: side, colorPrimary: team.colorPrimary || '#000000', colorSecondary: team.colorSecondary || '#ffffff' });
      socket.emit('team:logo', { team: side, logo: team.logo || null });
      
      const players = (team.players || []).map(p => ({ ...p, goalsInMatch: 0 }));
      console.log('[loadTeamFromDB] side=', side, 'teamId=', teamId, 'players count=', players.length);
      socket.emit('team:players', { team: side, players });
    })
    .catch(err => {
      console.error('Erro ao carregar time:', err);
      alert('Erro ao carregar time: ' + err.message);
      preview.innerHTML = '<div class="team-preview-placeholder">Selecione um time para visualizar os dados</div>';
      socket.emit('team:players', { team: side, players: [] });
    });
}

function triggerPlayerPhotoUpload(playerId, input) {
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

  pendingPlayerPhotos.set(playerId, file);
  openCropModal(file, 'player:modal', { teamId: currentTeamId, playerId });
  input.value = '';
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
populateTeamSelects();

// Busca estado inicial via HTTP como fallback
fetch('/api/state')
  .then(res => res.json())
  .then(state => {
    updateUI(state);
  })
  .catch(err => {
    console.error('Erro ao buscar estado inicial:', err);
  });
