/**
 * OVERLAY FUTSAL — ESTILO CHAMPIONS LEAGUE
 *
 * Cliente WebSocket com modo compacto e expandido.
 */

const socket = io();

let expandedAutoHideTimer = null;
let previousState = null;

const elements = {
  // Modo compacto
  compact: document.getElementById('scoreboardCompact'),
  competitionLogo: document.getElementById('competitionLogo'),
  timer: document.getElementById('timer'),
  // Trave de cor do Time A (segmento 4)
  teamAColorTop: document.querySelector('.compact-team-a-color-top'),
  teamAColorBottom: document.querySelector('.compact-team-a-color-bottom'),
  // Trave de cor do Time B (segmento 6)
  teamBColorTop: document.querySelector('.compact-team-b-color-top'),
  teamBColorBottom: document.querySelector('.compact-team-b-color-bottom'),
  // Placar compacto (segmento 5)
  abbrA: document.getElementById('abbrA'),
  scoreA: document.getElementById('scoreA'),
  scoreB: document.getElementById('scoreB'),
  abbrB: document.getElementById('abbrB'),
  // Modo expandido
  expanded: document.getElementById('scoreboardExpanded'),
  expandedGoalInfo: document.getElementById('expandedGoalInfo'),
  goalScorerText: document.getElementById('goalScorerText'),
  crestA: document.getElementById('crestA'),
  crestB: document.getElementById('crestB'),
  expandedNameA: document.getElementById('expandedNameA'),
  expandedNameB: document.getElementById('expandedNameB'),
  expandedScoreA: document.getElementById('expandedScoreA'),
  expandedScoreB: document.getElementById('expandedScoreB')
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updatePosition(position) {
  elements.compact.classList.remove('position-top', 'position-bottom');
  elements.compact.classList.add(`position-${position}`);
  elements.expanded.classList.remove('position-top', 'position-bottom');
  elements.expanded.classList.add(`position-${position}`);
}

function updateCompetitionLogo(logoPath) {
  if (logoPath) {
    elements.competitionLogo.src = logoPath;
    elements.competitionLogo.style.display = 'block';
  } else {
    elements.competitionLogo.style.display = 'none';
  }
}

function updateLogoSizes(state) {
  const compSize = state.competitionLogoSize || 80;

  elements.competitionLogo.style.maxWidth = `${compSize}%`;
  elements.competitionLogo.style.maxHeight = `${compSize}%`;
}

function updateScore(team, goals) {
  const scoreEl = team === 'A' ? elements.scoreA : elements.scoreB;
  const expandedScoreEl = team === 'A' ? elements.expandedScoreA : elements.expandedScoreB;

  if (previousState) {
    const prevGoals = team === 'A' ? previousState.teamA.goals : previousState.teamB.goals;
    if (goals > prevGoals) {
      scoreEl.classList.remove('goal-scored');
      expandedScoreEl.classList.remove('goal-scored');
      void scoreEl.offsetWidth;
      void expandedScoreEl.offsetWidth;
      scoreEl.classList.add('goal-scored');
      expandedScoreEl.classList.add('goal-scored');
    }
  }

  scoreEl.textContent = goals;
  expandedScoreEl.textContent = goals;
}

function updateAbbr(team, state) {
  const abbrEl = team === 'A' ? elements.abbrA : elements.abbrB;
  const teamData = team === 'A' ? state.teamA : state.teamB;
  abbrEl.textContent = teamData.abbreviation || teamData.name.substring(0, 3).toUpperCase();
}

function updateTeamNames(state) {
  elements.expandedNameA.textContent = state.teamA.name;
  elements.expandedNameB.textContent = state.teamB.name;
}

function updateCrests(state) {
  if (state.teamA.logo) {
    elements.crestA.src = state.teamA.logo;
    elements.crestA.style.display = 'block';
  } else {
    elements.crestA.style.display = 'none';
  }
  if (state.teamB.logo) {
    elements.crestB.src = state.teamB.logo;
    elements.crestB.style.display = 'block';
  } else {
    elements.crestB.style.display = 'none';
  }
}

function updateFoulsDisplay(team, fouls, directFouls) {
  const countEl = document.getElementById(`foulsCount${team}`);
  const dotsContainer = document.getElementById(`foulsDots${team}`);
  const dlpEl = document.getElementById(`foulsDlp${team}`);

  // Bolinhas: sempre visíveis, preenche até o máximo de 5
  const dots = dotsContainer.querySelectorAll('.foul-dot');
  dots.forEach((dot, i) => dot.classList.toggle('filled', i < fouls));

  // Contador: faltas acumulativas
  countEl.textContent = fouls;

  // DLP: aparece a partir da 5ª falta e persiste após o reset do período
  const dlpCount = (directFouls || 0) + (fouls >= 5 ? fouls - 4 : 0);
  if (dlpCount > 0) {
    dlpEl.textContent = `DLP ${dlpCount}`;
    dlpEl.classList.remove('hidden');
  } else {
    dlpEl.classList.add('hidden');
  }
}

function updateTimer(remaining) {
  elements.timer.textContent = formatTime(remaining);
  elements.timer.classList.toggle('zero', remaining === 0);
}

function updateColorBars(state) {
  // Trave do Time A — cima: primária, baixo: secundária
  elements.teamAColorTop.style.background = state.teamA.colorPrimary || '#888888';
  elements.teamAColorBottom.style.background = state.teamA.colorSecondary || '#888888';

  // Trave do Time B — cima: primária, baixo: secundária
  elements.teamBColorTop.style.background = state.teamB.colorPrimary || '#888888';
  elements.teamBColorBottom.style.background = state.teamB.colorSecondary || '#888888';
}

function updateGoalInfo(lastGoal) {
  if (lastGoal && lastGoal.scorer) {
    let text = lastGoal.scorer.toUpperCase();
    if (lastGoal.minute) text += ` ${lastGoal.minute}'`;
    if (lastGoal.type) text += ` (${lastGoal.type})`;
    elements.goalScorerText.textContent = text;
    elements.expandedGoalInfo.classList.remove('hidden');
  } else {
    elements.expandedGoalInfo.classList.add('hidden');
  }
}

function updateExpandedMode(state) {
  if (state.expandedMode) {
    elements.compact.classList.remove('visible');
    elements.expanded.classList.add('visible');
  } else {
    elements.compact.classList.add('visible');
    elements.expanded.classList.remove('visible');
  }
}

function startExpandedAutoHide(seconds) {
  clearTimeout(expandedAutoHideTimer);
  expandedAutoHideTimer = setTimeout(() => {
    socket.emit('expandedMode:hide');
  }, seconds * 1000);
}

function renderState(state) {
  updateScore('A', state.teamA.goals);
  updateScore('B', state.teamB.goals);
  updateAbbr('A', state);
  updateAbbr('B', state);
  updateTeamNames(state);
  updateCrests(state);
  updateFoulsDisplay('A', state.teamA.fouls, state.teamA.directFouls);
  updateFoulsDisplay('B', state.teamB.fouls, state.teamB.directFouls);
  updateCompetitionLogo(state.competitionLogo);
  updateLogoSizes(state);
  updateTimer(state.timer.remaining);
  updatePosition(state.overlayPosition);
  updateColorBars(state);
  updateGoalInfo(state.lastGoal);
  updateExpandedMode(state);

  previousState = JSON.parse(JSON.stringify(state));
}

// ========================
// EVENTOS WEBSOCKET
// ========================

socket.on('connect', () => {
  console.log('Conectado ao servidor');
});

socket.on('state:sync', (state) => {
  const wasExpanded = previousState ? previousState.expandedMode : false;
  renderState(state);

  // Auto-hide: se modo expandido foi ativado por gol (autoHide=true)
  if (state.expandedMode && state.expandedAutoHide && !wasExpanded) {
    startExpandedAutoHide(state.expandedAutoHideSeconds || 10);
  }

  // Se modo expandido foi desativado manualmente, cancelar timer
  if (!state.expandedMode) {
    clearTimeout(expandedAutoHideTimer);
  }
});

socket.on('timer:tick', (data) => {
  updateTimer(data.remaining);
});

socket.on('reconnect', () => {
  console.log('Reconectado ao servidor');
});

socket.on('connect_error', (err) => {
  console.error('Erro de conexão:', err.message);
});

// ========================
// INICIALIZAÇÃO
// ========================

fetch('/api/state')
  .then(res => res.json())
  .then(state => {
    renderState(state);
  })
  .catch(err => {
    console.error('Erro ao buscar estado inicial:', err);
  });