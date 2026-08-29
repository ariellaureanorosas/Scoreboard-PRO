/**
 * OVERLAY FUTSAL — ESTILO CHAMPIONS LEAGUE
 *
 * Cliente WebSocket com modo compacto e expandido.
 */

const socket = io();

let previousState = null;
let goalCardHideTimer = null;
let goalCardLoadTimer = null;
let expandedHideTimer = null;

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
  scorersTextA: document.getElementById('scorersTextA'),
  scorersTextB: document.getElementById('scorersTextB'),
  crestA: document.getElementById('crestA'),
  crestB: document.getElementById('crestB'),
  expandedNameA: document.getElementById('expandedNameA'),
  expandedNameB: document.getElementById('expandedNameB'),
  expandedScoreA: document.getElementById('expandedScoreA'),
  expandedScoreB: document.getElementById('expandedScoreB'),
  // Modo pré-jogo
  preMatch: document.getElementById('preMatchOverlay'),
  preMatchCrestA: document.getElementById('preMatchCrestA'),
  preMatchCrestB: document.getElementById('preMatchCrestB'),
  preMatchCompetitionLogo: document.getElementById('preMatchCompetitionLogo'),
  preMatchCompetitionName: document.getElementById('preMatchCompetitionName'),
  preMatchCompetitionSubtitle: document.getElementById('preMatchCompetitionSubtitle'),
  preMatchTeamNameA: document.getElementById('preMatchTeamNameA'),
  preMatchTeamNameB: document.getElementById('preMatchTeamNameB'),
  // Goal card
  goalCard: document.getElementById('goalCard'),
  goalCardBg: document.getElementById('goalCardBg'),
  goalCardPhoto: document.getElementById('goalCardPhoto'),
  goalCardCrest: document.getElementById('goalCardCrest'),
  goalCardNameValue: document.getElementById('goalCardNameValue'),
  goalCardPositionValue: document.getElementById('goalCardPositionValue'),
  goalCardGoalCountValue: document.getElementById('goalCardGoalCountValue'),
  goalCardText: document.getElementById('goalCardText'),
  goalCardTeamStripe: document.getElementById('goalCardTeamStripe')
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateCompetitionLogo(logoPath) {
  if (logoPath) {
    elements.competitionLogo.src = logoPath;
    elements.competitionLogo.style.display = 'block';
  } else {
    elements.competitionLogo.style.display = 'none';
  }
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
  const dotsContainer = document.getElementById(`foulsDots${team}`);
  const dlpEl = document.getElementById(`foulsDlp${team}`);

  const dots = dotsContainer.querySelectorAll('.foul-dot');
  dots.forEach((dot, i) => dot.classList.toggle('filled', i < fouls));

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

function updatePreMatch(state) {
  if (state.preMatchMode) {
    elements.preMatchCrestA.src = state.teamA.logo || '';
    elements.preMatchCrestA.style.display = state.teamA.logo ? 'block' : 'none';
    elements.preMatchCrestB.src = state.teamB.logo || '';
    elements.preMatchCrestB.style.display = state.teamB.logo ? 'block' : 'none';
    elements.preMatchCompetitionLogo.src = state.preMatchLogo || '';
    elements.preMatchCompetitionLogo.style.display = state.preMatchLogo ? 'block' : 'none';
    elements.preMatchCompetitionName.textContent = state.competitionName || 'COCA-COLA LEAGUE';
    elements.preMatchCompetitionSubtitle.textContent = state.competitionSubtitle || '';
    elements.preMatchTeamNameA.textContent = state.teamA.name || 'TIME A';
    elements.preMatchTeamNameB.textContent = state.teamB.name || 'TIME B';
    elements.preMatch.classList.add('visible');
  } else {
    elements.preMatch.classList.remove('visible');
  }
}

function updateGoalScorers(state) {
  const events = Array.isArray(state.goalEvents) ? state.goalEvents : [];
  const lastA = events.filter(e => e.team === 'A').pop();
  const lastB = events.filter(e => e.team === 'B').pop();
  
  const fmt = (ev) => {
    if (!ev) return '';
    let text = (ev.playerNickname || ev.name || 'GOL').toUpperCase();
    if (ev.minute) text += ` ${ev.minute}'`;
    if (ev.type && ev.type !== 'normal') text += ` (${ev.type === 'penalty' ? 'P' : ev.type === 'own' ? 'GC' : ev.type.toUpperCase()})`;
    if (ev.goalsInMatchAtThisPoint > 1) text += ` (${ev.goalsInMatchAtThisPoint})`;
    return text;
  };
  
  const textA = fmt(lastA);
  const textB = fmt(lastB);
  
  elements.scorersTextA.textContent = textA;
  elements.scorersTextB.textContent = textB;
  elements.expandedGoalInfo.classList.toggle('hidden', events.length === 0);
}

function showGoalCard(event) {
  
  if (!event.playerNickname) return;

  const photoUrl = event.playerPhoto || 'https://via.placeholder.com/120?text=?';

  // Limpa a foto antiga antes de carregar a nova para evitar "flash" do jogador anterior
  elements.goalCardPhoto.removeAttribute('src');

  const teamLogo = event.teamLogo || (previousState && event.team === 'A' ? previousState.teamA.logo : previousState && previousState.teamB.logo) || 'https://via.placeholder.com/80?text=?';
  elements.goalCardCrest.src = teamLogo;
  
  elements.goalCardText.textContent = 'GOOOOOL!!!';
  
  elements.goalCardNameValue.textContent = (event.playerNickname || 'GOL').toUpperCase();
  elements.goalCardPositionValue.textContent = event.playerPosition || '';
  
  let goalCountText = '';
  if (event.goalsInMatchAtThisPoint > 1) {
    goalCountText = event.goalsInMatchAtThisPoint;
  } else {
    goalCountText = '1';
  }
  elements.goalCardGoalCountValue.textContent = goalCountText;

  // Pré-carrega a foto antes de exibir o card, evitando mostrar a foto do jogador antigo
  const img = new Image();
  clearTimeout(goalCardLoadTimer);
  img.onload = () => {
    elements.goalCardPhoto.src = photoUrl;
    revealGoalCard();
  };
  img.onerror = () => {
    elements.goalCardPhoto.src = photoUrl;
    revealGoalCard();
  };
  img.src = photoUrl;

  // Timeout de segurança: mostra o card mesmo se a foto demorar/falhar
  goalCardLoadTimer = setTimeout(revealGoalCard, 2000);
}

function revealGoalCard() {
  const wasHidden = elements.goalCard.classList.contains('hidden') || !elements.goalCard.classList.contains('visible');
  if (!wasHidden) return; // já exibido (ex.: preload e timeout de segurança)
  elements.goalCard.classList.remove('hidden');
  void elements.goalCard.offsetWidth;
  elements.goalCard.classList.add('visible');

  clearTimeout(goalCardHideTimer);
  goalCardHideTimer = setTimeout(hideGoalCard, 10000);
}

function hideGoalCard() {
  elements.goalCard.classList.remove('visible');
  setTimeout(() => {
    elements.goalCard.classList.add('hidden');
  }, 450);
}

function updateExpandedMode(state) {
  let visible = state.scoreboardVisible !== false;
  if (state.preMatchMode) visible = false;
  if (state.expandedMode) {
    elements.compact.classList.remove('visible');
    elements.expanded.classList.toggle('visible', visible);
    scheduleExpandedAutoHide(state);
  } else {
    elements.compact.classList.toggle('visible', visible);
    elements.expanded.classList.remove('visible');
    clearTimeout(expandedHideTimer);
  }
}

function scheduleExpandedAutoHide(state) {
  clearTimeout(expandedHideTimer);
  if (state.expandedAutoHide !== true) return;
  const seconds = Number(state.expandedAutoHideSeconds) || 10;
  expandedHideTimer = setTimeout(() => {
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
  updateTimer(state.timer.remaining);
  updateColorBars(state);
  updateGoalScorers(state);
  updatePreMatch(state);
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
  renderState(state);
});

socket.on('goalCard:show', (data) => {
  showGoalCard(data);
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