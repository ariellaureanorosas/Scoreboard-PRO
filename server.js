const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity
});

const PORT = 3000;
const STATE_FILE = path.join(__dirname, 'state.json');
const TEAMS_DB_FILE = path.join(__dirname, 'teams-database.json');
const LOGOS_DIR = path.join(__dirname, 'public', 'assets', 'logos');
const PLAYERS_DIR = path.join(__dirname, 'public', 'assets', 'players');

// Estado padrão do jogo
const DEFAULT_STATE = {
  teamA: { name: 'Time A', abbreviation: 'TIM', logo: null, goals: 0, fouls: 0, directFouls: 0, colorPrimary: '#000000', colorSecondary: '#ffffff', teamId: null, players: [] },
  teamB: { name: 'Time B', abbreviation: 'TIM', logo: null, goals: 0, fouls: 0, directFouls: 0, colorPrimary: '#e51937', colorSecondary: '#000000', teamId: null, players: [] },
  timer: { duration: 1200, remaining: 1200, running: false, startedAt: null },
  showSecondaryInfo: false,
  competitionLogo: null,
  expandedMode: false,
  preMatchMode: false,
  scoreboardVisible: true,
  competitionName: 'COCA-COLA LEAGUE',
  competitionSubtitle: '',
  preMatchLogo: null,
  expandedAutoHide: false,
  expandedAutoHideSeconds: 10,
  scoreboardVisible: true
};

// Carrega ou cria state.json
let gameState = loadState();

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      // Valida se tem todas as propriedades necessárias
      if (parsed.teamA && parsed.teamB && parsed.timer) {
        // Se o timer estava rodando, recalcula o tempo baseado no timestamp
        if (parsed.timer.running && parsed.timer.startedAt) {
          const elapsed = Math.floor((Date.now() - parsed.timer.startedAt) / 1000);
          parsed.timer.remaining = Math.max(0, parsed.timer.remaining - elapsed);
          if (parsed.timer.remaining === 0) {
            parsed.timer.running = false;
          }
        }
        // Compatibilidade com state.json antigo (sem lista de eventos)
        if (!Array.isArray(parsed.goalEvents)) parsed.goalEvents = [];
        // Compatibilidade com state.json antigo (sem jogadores/teamId)
        ['teamA', 'teamB'].forEach(key => {
          if (!parsed[key]) return;
          if (!Array.isArray(parsed[key].players)) parsed[key].players = [];
          if (typeof parsed[key].teamId !== 'string') parsed[key].teamId = null;
        });
        // Remove chaves obsoletas de versões anteriores
        delete parsed.goalScorers;
        delete parsed.period;
        delete parsed.overlayPosition;
        // Compatibilidade com state.json antigo (sem campos de pré-jogo)
        if (typeof parsed.preMatchMode !== 'boolean') parsed.preMatchMode = false;
        if (typeof parsed.competitionName !== 'string') parsed.competitionName = 'COCA-COLA LEAGUE';
        if (typeof parsed.competitionSubtitle !== 'string') parsed.competitionSubtitle = '';
        if (typeof parsed.preMatchLogo !== 'string') parsed.preMatchLogo = null;
        if (typeof parsed.expandedAutoHide !== 'boolean') parsed.expandedAutoHide = false;
        if (typeof parsed.expandedAutoHideSeconds !== 'number') parsed.expandedAutoHideSeconds = 10;
        if (typeof parsed.scoreboardVisible !== 'boolean') parsed.scoreboardVisible = true;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler state.json, criando novo estado:', err.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

// Salva estado no arquivo
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(gameState, null, 2));
  } catch (err) {
    console.error('Erro ao salvar state.json:', err.message);
  }
}

// ========================
// BANCO DE TIMES
// ========================

function loadTeamsDB() {
  try {
    if (fs.existsSync(TEAMS_DB_FILE)) {
      const data = fs.readFileSync(TEAMS_DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.teams)) return parsed;
    }
  } catch (err) {
    console.error('Erro ao ler teams-database.json, criando novo:', err.message);
  }
  return { teams: [] };
}

function saveTeamsDB(db) {
  try {
    fs.writeFileSync(TEAMS_DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Erro ao salvar teams-database.json:', err.message);
  }
}

let teamsDB = loadTeamsDB();

// Garante que a pasta de players existe
if (!fs.existsSync(PLAYERS_DIR)) {
  fs.mkdirSync(PLAYERS_DIR, { recursive: true });
}

// Configuração do Multer para upload de logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PNG, JPG ou SVG.'));
    }
  }
});

const playerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PLAYERS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const playerUpload = multer({
  storage: playerStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PNG, JPG ou SVG.'));
    }
  }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '15mb' }));

// ========================
// ROTAS REST
// ========================

// Retorna estado atual (usado na conexão inicial do overlay/painel)
app.get('/api/state', (req, res) => {
  res.json(gameState);
});

// Upload de logo
app.post('/api/upload-logo/:team', upload.single('logo'), (req, res) => {
  const team = req.params.team; // 'A' ou 'B'
  if (team !== 'A' && team !== 'B') {
    return res.status(400).json({ error: 'Time inválido' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const teamKey = team === 'A' ? 'teamA' : 'teamB';
  const logoPath = `/assets/logos/${req.file.filename}`;

  // Remove logo anterior se existir
  if (gameState[teamKey].logo) {
    const oldPath = path.join(__dirname, 'public', gameState[teamKey].logo);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  gameState[teamKey].logo = logoPath;
  saveState();
  io.emit('state:sync', gameState);

  res.json({ success: true, logo: logoPath });
});

// Upload de logo recortado (base64 PNG do editor de recorte)
app.post('/api/upload-logo-crop/:team', express.json({ limit: '10mb' }), (req, res) => {
  const team = req.params.team;
  if (team !== 'A' && team !== 'B') {
    return res.status(400).json({ error: 'Time inválido' });
  }

  const { image } = req.body;
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/png;base64,')) {
    return res.status(400).json({ error: 'Imagem inválida' });
  }

  const base64Data = image.replace(/^data:image\/png;base64,/, '');
  const filename = `${uuidv4()}.png`;
  const filePath = path.join(LOGOS_DIR, filename);

  fs.writeFileSync(filePath, base64Data, 'base64');

  const teamKey = team === 'A' ? 'teamA' : 'teamB';
  if (gameState[teamKey].logo) {
    const oldPath = path.join(__dirname, 'public', gameState[teamKey].logo);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const logoPath = `/assets/logos/${filename}`;
  gameState[teamKey].logo = logoPath;
  saveState();
  io.emit('state:sync', gameState);

  res.json({ success: true, logo: logoPath });
});

// Upload do logo da competição recortado (base64 PNG)
app.post('/api/upload-competition-logo-crop', express.json({ limit: '10mb' }), (req, res) => {
  const { image } = req.body;
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/png;base64,')) {
    return res.status(400).json({ error: 'Imagem inválida' });
  }

  const base64Data = image.replace(/^data:image\/png;base64,/, '');
  const filename = `${uuidv4()}.png`;
  const filePath = path.join(LOGOS_DIR, filename);

  fs.writeFileSync(filePath, base64Data, 'base64');

  if (gameState.competitionLogo) {
    const oldPath = path.join(__dirname, 'public', gameState.competitionLogo);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const logoPath = `/assets/logos/${filename}`;
  gameState.competitionLogo = logoPath;
  saveState();
  io.emit('state:sync', gameState);

  res.json({ success: true, logo: logoPath });
});

// Remove logo
app.delete('/api/logo/:team', (req, res) => {
  const team = req.params.team;
  if (team !== 'A' && team !== 'B') {
    return res.status(400).json({ error: 'Time inválido' });
  }

  const teamKey = team === 'A' ? 'teamA' : 'teamB';
  if (gameState[teamKey].logo) {
    const logoPath = path.join(__dirname, 'public', gameState[teamKey].logo);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
    gameState[teamKey].logo = null;
    saveState();
    io.emit('state:sync', gameState);
  }

  res.json({ success: true });
});

// Upload logo da competição
app.post('/api/upload-competition-logo', upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const logoPath = `/assets/logos/${req.file.filename}`;

  // Remove logo anterior se existir
  if (gameState.competitionLogo) {
    const oldPath = path.join(__dirname, 'public', gameState.competitionLogo);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  gameState.competitionLogo = logoPath;
  saveState();
  io.emit('state:sync', gameState);

  res.json({ success: true, logo: logoPath });
});

// Upload logo do pré-jogo
app.post('/api/upload-pre-match-logo', upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const logoPath = `/assets/logos/${req.file.filename}`;

  if (gameState.preMatchLogo) {
    const oldPath = path.join(__dirname, 'public', gameState.preMatchLogo);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  gameState.preMatchLogo = logoPath;
  saveState();
  io.emit('state:sync', gameState);

  res.json({ success: true, logo: logoPath });
});

// Remove logo do pré-jogo
app.delete('/api/pre-match-logo', (req, res) => {
  if (gameState.preMatchLogo) {
    const logoPath = path.join(__dirname, 'public', gameState.preMatchLogo);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
    gameState.preMatchLogo = null;
    saveState();
    io.emit('state:sync', gameState);
  }

  res.json({ success: true });
});

// ========================
// API — BANCO DE TIMES
// ========================

// Listar todos os times
app.get('/api/teams', (req, res) => {
  res.json(teamsDB.teams || []);
});

// Obter um time por ID
app.get('/api/teams/:id', (req, res) => {
  const team = teamsDB.teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Time não encontrado' });
  res.json(team);
});

// Criar time
app.post('/api/teams', express.json({ limit: '10mb' }), (req, res) => {
  const { name, abbreviation, players, colorPrimary, colorSecondary } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome do time é obrigatório' });
  }

  const team = {
    id: uuidv4(),
    name: name.trim(),
    abbreviation: (abbreviation || '').trim().slice(0, 4).toUpperCase() || 'TIM',
    logo: null,
    colorPrimary: colorPrimary || '#000000',
    colorSecondary: colorSecondary || '#ffffff',
    players: Array.isArray(players) ? players : []
  };

  teamsDB.teams.push(team);
  saveTeamsDB(teamsDB);
  res.json(team);
});

// Atualizar time
app.put('/api/teams/:id', express.json({ limit: '10mb' }), (req, res) => {
  const idx = teamsDB.teams.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Time não encontrado' });

  const { name, abbreviation, players, colorPrimary, colorSecondary } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome do time é obrigatório' });
  }

  const mergedPlayers = (Array.isArray(players) ? players : []).map(newPlayer => {
    const oldPlayer = teamsDB.teams[idx].players.find(p => p.id === newPlayer.id);
    return {
      ...newPlayer,
      photo: newPlayer.photo ? newPlayer.photo : (oldPlayer ? oldPlayer.photo : null)
    };
  });

  teamsDB.teams[idx] = {
    ...teamsDB.teams[idx],
    name: name.trim(),
    abbreviation: (abbreviation || '').trim().slice(0, 4).toUpperCase() || 'TIM',
    colorPrimary: colorPrimary || teamsDB.teams[idx].colorPrimary || '#000000',
    colorSecondary: colorSecondary || teamsDB.teams[idx].colorSecondary || '#ffffff',
    players: mergedPlayers
  };

  saveTeamsDB(teamsDB);
  res.json(teamsDB.teams[idx]);
});

// Excluir time
app.delete('/api/teams/:id', (req, res) => {
  const idx = teamsDB.teams.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Time não encontrado' });

  // Remove arquivos de logo e fotos dos jogadores
  const team = teamsDB.teams[idx];
  if (team.logo) {
    const logoPath = path.join(__dirname, 'public', team.logo);
    if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
  }
  if (Array.isArray(team.players)) {
    team.players.forEach(p => {
      if (p.photo) {
        const photoPath = path.join(__dirname, 'public', p.photo);
        if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
      }
    });
  }

  teamsDB.teams.splice(idx, 1);
  saveTeamsDB(teamsDB);
  res.json({ success: true });
});

// Upload logo do time
app.post('/api/teams/:id/logo', upload.single('logo'), (req, res) => {
  const team = teamsDB.teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Time não encontrado' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const logoPath = `/assets/logos/${req.file.filename}`;

  // Remove logo anterior se existir
  if (team.logo) {
    const oldPath = path.join(__dirname, 'public', team.logo);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  team.logo = logoPath;
  saveTeamsDB(teamsDB);
  res.json({ success: true, logo: logoPath });
});

// Remove logo do time
app.delete('/api/teams/:id/logo', (req, res) => {
  const team = teamsDB.teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Time não encontrado' });
  if (!team.logo) return res.json({ success: true });

  const logoPath = path.join(__dirname, 'public', team.logo);
  if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
  team.logo = null;
  saveTeamsDB(teamsDB);
  res.json({ success: true });
});

// Upload foto de jogador
app.post('/api/teams/:id/players/:playerId/photo', playerUpload.single('photo'), (req, res) => {
  const team = teamsDB.teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Time não encontrado' });
  const player = team.players.find(p => p.id === req.params.playerId);
  if (!player) return res.status(404).json({ error: 'Jogador não encontrado' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const photoPath = `/assets/players/${req.file.filename}`;

  // Remove foto anterior se existir
  if (player.photo) {
    const oldPath = path.join(__dirname, 'public', player.photo);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  player.photo = photoPath;
  saveTeamsDB(teamsDB);
  res.json({ success: true, photo: photoPath });
});

// Remove foto de jogador
app.delete('/api/teams/:id/players/:playerId/photo', (req, res) => {
  const team = teamsDB.teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Time não encontrado' });
  const player = team.players.find(p => p.id === req.params.playerId);
  if (!player) return res.status(404).json({ error: 'Jogador não encontrado' });
  if (!player.photo) return res.json({ success: true });

  const photoPath = path.join(__dirname, 'public', player.photo);
  if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  player.photo = null;
  saveTeamsDB(teamsDB);
  res.json({ success: true });
});

// ========================
// WEBSOCKET
// ========================

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  // Envia estado atual ao conectar
  socket.emit('state:sync', gameState);

  // ---- SCORE ----
  socket.on('score:update', (data) => {
    const { team, action } = data;
    if (team !== 'A' && team !== 'B') return;
    const teamKey = team === 'A' ? 'teamA' : 'teamB';

    if (action === 'increment') {
      gameState[teamKey].goals++;
    } else if (action === 'decrement' && gameState[teamKey].goals > 0) {
      gameState[teamKey].goals--;
    } else if (action === 'reset') {
      gameState[teamKey].goals = 0;
      gameState.goalEvents = gameState.goalEvents.filter(e => e.team !== team);
      gameState[teamKey].players.forEach(p => p.goalsInMatch = 0);
    }

    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- FOULS ----
  socket.on('fouls:update', (data) => {
    const { team, action } = data;
    const teamKey = team === 'A' ? 'teamA' : 'teamB';

    if (action === 'increment') {
      gameState[teamKey].fouls++;
    } else if (action === 'decrement' && gameState[teamKey].fouls > 0) {
      gameState[teamKey].fouls--;
    } else if (action === 'reset') {
      // Novo período: faltas acumulativas zeram, mas DLPs persistem
      if (gameState[teamKey].fouls >= 5) {
        gameState[teamKey].directFouls = (gameState[teamKey].directFouls || 0)
          + (gameState[teamKey].fouls - 4);
      }
      gameState[teamKey].fouls = 0;
    } else if (action === 'resetAll') {
      gameState[teamKey].fouls = 0;
      gameState[teamKey].directFouls = 0;
    }

    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- TIMER ----
  socket.on('timer:action', (data) => {
    const { action, value } = data;

    switch (action) {
      case 'start':
        if (!gameState.timer.running && gameState.timer.remaining > 0) {
          gameState.timer.running = true;
          gameState.timer.startedAt = Date.now();
        }
        break;

      case 'pause':
        if (gameState.timer.running) {
          // Calcula o tempo restante antes de pausar
          const elapsed = Math.floor((Date.now() - gameState.timer.startedAt) / 1000);
          gameState.timer.remaining = Math.max(0, gameState.timer.remaining - elapsed);
          gameState.timer.running = false;
          gameState.timer.startedAt = null;
        }
        break;

      case 'reset':
        gameState.timer.remaining = gameState.timer.duration;
        gameState.timer.running = false;
        gameState.timer.startedAt = null;
        break;

      case 'setDuration':
        // Define nova duração total (em segundos)
        if (typeof value === 'number' && value > 0) {
          gameState.timer.duration = value;
          if (!gameState.timer.running) {
            gameState.timer.remaining = value;
          }
        }
        break;

      case 'adjust':
        // Ajuste manual (+/- segundos)
        if (typeof value === 'number') {
          gameState.timer.remaining = Math.max(0, gameState.timer.remaining + value);
          if (gameState.timer.running) {
            gameState.timer.startedAt = Date.now();
          }
        }
        break;
    }

    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- TIMER TICK (servidor calcula a cada 1s) ----
  // O tick é gerenciado por um intervalo global, não por socket

  // ---- TEAM INFO ----
  socket.on('team:update', (data) => {
    const { team, name, teamId } = data;
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    if (typeof name === 'string' && name.trim()) {
      gameState[teamKey].name = name.trim();
      gameState[teamKey].teamId = teamId || null;
      saveState();
      io.emit('state:sync', gameState);
    }
  });

  // ---- TEAM ABBREVIATION ----
  socket.on('team:abbreviation', (data) => {
    const { team, abbreviation } = data;
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    if (typeof abbreviation === 'string') {
      gameState[teamKey].abbreviation = abbreviation.trim().substring(0, 4).toUpperCase();
      saveState();
      io.emit('state:sync', gameState);
    }
  });

  // ---- TEAM COLORS ----
  socket.on('team:colors', (data) => {
    const { team, colorPrimary, colorSecondary } = data;
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    if (colorPrimary) gameState[teamKey].colorPrimary = colorPrimary;
    if (colorSecondary) gameState[teamKey].colorSecondary = colorSecondary;
    saveState();
    io.emit('state:sync', gameState);
  });

  socket.on('team:logo', (data) => {
    const { team, logo } = data;
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    gameState[teamKey].logo = logo || null;
    saveState();
    io.emit('state:sync', gameState);
  });

  socket.on('team:players', (data) => {
    const { team, players } = data;
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    console.log('[team:players] team=', team, 'players count=', Array.isArray(players) ? players.length : 'not array');
    if (Array.isArray(players)) {
      gameState[teamKey].players = players.map(p => ({
        ...p,
        goalsInMatch: p.goalsInMatch || 0
      }));
      saveState();
      io.emit('state:sync', gameState);
    }
  });

  // ---- COMPETITION LOGO ----
  socket.on('competitionLogo:update', (data) => {
    const { logo } = data;
    gameState.competitionLogo = logo || null;
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- SECONDARY INFO TOGGLE ----
  socket.on('secondaryInfo:toggle', () => {
    gameState.showSecondaryInfo = !gameState.showSecondaryInfo;
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- SCOREBOARD VISIBILITY TOGGLE ----
  socket.on('scoreboard:toggle', () => {
    gameState.scoreboardVisible = !gameState.scoreboardVisible;
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- EXPANDED MODE TOGGLE ----
  socket.on('expandedMode:toggle', () => {
    gameState.expandedMode = !gameState.expandedMode;
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- EXPANDED MODE HIDE ----
  socket.on('expandedMode:hide', () => {
    gameState.expandedMode = false;
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- EXPANDED AUTO-HIDE ----
  socket.on('expandedAutoHide:set', (data) => {
    const seconds = Number(data && data.seconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      gameState.expandedAutoHideSeconds = Math.min(60, Math.round(seconds));
    }
    saveState();
    io.emit('state:sync', gameState);
  });

  socket.on('expandedAutoHide:toggle', (on) => {
    gameState.expandedAutoHide = !!on;
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- PRE-MATCH MODE ----
  socket.on('preMatch:toggle', () => {
    gameState.preMatchMode = !gameState.preMatchMode;
    saveState();
    io.emit('state:sync', gameState);
  });

  socket.on('preMatch:update', (data) => {
    const { name, subtitle } = data;
    if (typeof name === 'string') gameState.competitionName = name.trim();
    if (typeof subtitle === 'string') gameState.competitionSubtitle = subtitle.trim();
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- EVENTOS DE GOL (cada gol é um evento; placar acompanha) ----
  socket.on('goalEvents:add', (data) => {
    const { team, name } = data;
    if ((team !== 'A' && team !== 'B') || typeof name !== 'string') return;
    const clean = name.trim().slice(0, 30);
    if (!clean) return;
    const id = gameState.goalEvents.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    gameState.goalEvents.push({ id, team, name: clean });
    gameState[team === 'A' ? 'teamA' : 'teamB'].goals++;
    saveState();
    io.emit('state:sync', gameState);
  });

  socket.on('goalEvents:remove', (data) => {
    const id = Number(data && data.id);
    const idx = gameState.goalEvents.findIndex(e => e.id === id);
    if (idx === -1) return;
    const [removed] = gameState.goalEvents.splice(idx, 1);
    const teamKey = removed.team === 'A' ? 'teamA' : 'teamB';
    if (gameState[teamKey].goals > 0) gameState[teamKey].goals--;
    
    if (removed.playerId) {
      const player = gameState[teamKey].players.find(p => p.id === removed.playerId);
      if (player) {
        const remainingGoals = gameState.goalEvents.filter(e => e.team === removed.team && e.playerId === removed.playerId).length;
        player.goalsInMatch = remainingGoals;
      }
    }
    
    saveState();
    io.emit('state:sync', gameState);
  });

  socket.on('goal:scored', (data) => {
    const { team, playerId, playerNickname, playerPhoto, minute, type, scorerName } = data;
    if ((team !== 'A' && team !== 'B')) return;

    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    gameState[teamKey].goals++;

    let goalsInMatchAtThisPoint = 0;
    if (playerId && playerNickname) {
      const player = gameState[teamKey].players.find(p => p.id === playerId);
      if (player) {
        player.goalsInMatch = (player.goalsInMatch || 0) + 1;
        goalsInMatchAtThisPoint = player.goalsInMatch;
      }
    }

    const id = gameState.goalEvents.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    gameState.goalEvents.push({
      id,
      team,
      playerId: playerId || null,
      playerNickname: playerNickname || scorerName || null,
      playerPhoto: playerPhoto || null,
      minute: minute || null,
      type: type || 'normal',
      goalsInMatchAtThisPoint
    });

    const player = playerId ? (gameState[teamKey].players.find(p => p.id === playerId) || null) : null;

    saveState();
    io.emit('state:sync', gameState);
    io.emit('goalCard:show', {
      team,
      playerId: playerId || null,
      playerNickname: playerNickname || scorerName || null,
      playerPhoto: playerPhoto || null,
      playerPosition: player && player.position ? player.position : null,
      teamLogo: gameState[teamKey].logo || null,
      goalsInMatchAtThisPoint
    });
  });

  // ---- FULL RESET ----
  socket.on('state:reset', () => {
    gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
    gameState.goalEvents = [];
    gameState.teamA.players = [];
    gameState.teamB.players = [];
    // Remove logos
    const files = fs.readdirSync(LOGOS_DIR);
    files.forEach(file => {
      fs.unlinkSync(path.join(LOGOS_DIR, file));
    });
    saveState();
    io.emit('state:sync', gameState);
    io.emit('state:resetDone');
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// ========================
// TIMER LOOP GLOBAL
// ========================
setInterval(() => {
  if (gameState.timer.running && gameState.timer.remaining > 0) {
    const elapsed = Math.floor((Date.now() - gameState.timer.startedAt) / 1000);
    const newRemaining = Math.max(0, gameState.timer.remaining - elapsed);

    // Atualiza o startedAt para o cálculo correto no próximo tick
    if (newRemaining > 0) {
      gameState.timer.startedAt = Date.now();
      gameState.timer.remaining = newRemaining;
    } else {
      // Timer chegou a zero
      gameState.timer.remaining = 0;
      gameState.timer.running = false;
      gameState.timer.startedAt = null;
      saveState();
    }

    io.emit('timer:tick', {
      remaining: gameState.timer.remaining,
      running: gameState.timer.running
    });
  } else if (gameState.timer.running && gameState.timer.remaining === 0) {
    gameState.timer.running = false;
    gameState.timer.startedAt = null;
    saveState();
    io.emit('timer:tick', {
      remaining: 0,
      running: false
    });
  }
}, 1000);

// ========================
// START SERVER
// ========================
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('  SISTEMA DE OVERLAY DE FUTSAL');
  console.log('========================================');
  console.log(`\nServidor rodando em: http://localhost:${PORT}`);
  console.log(`\nURL do Overlay (OBS): http://localhost:${PORT}/overlay.html`);
  console.log(`URL do Painel:       http://localhost:${PORT}/control.html`);
  console.log('\nPara acessar de outro dispositivo na rede:');
  console.log(`  Overlay: http://<SEU-IP>:${PORT}/overlay.html`);
  console.log(`  Painel:  http://<SEU-IP>:${PORT}/control.html`);
  console.log('\n========================================\n');
});

// Tratamento de erros
process.on('uncaughtException', (err) => {
  console.error('Exceção não capturada:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Rejeição não tratada:', reason);
});
