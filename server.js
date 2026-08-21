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
const LOGOS_DIR = path.join(__dirname, 'public', 'assets', 'logos');

// Estado padrão do jogo
const DEFAULT_STATE = {
  teamA: { name: 'Time A', abbreviation: 'TIM', logo: null, goals: 0, fouls: 0, directFouls: 0, colorPrimary: '#000000', colorSecondary: '#ffffff' },
  teamB: { name: 'Time B', abbreviation: 'TIM', logo: null, goals: 0, fouls: 0, directFouls: 0, colorPrimary: '#e51937', colorSecondary: '#000000' },
  timer: { duration: 1200, remaining: 1200, running: false, startedAt: null },
  showSecondaryInfo: false,
  competitionLogo: null,
  expandedMode: false,
  expandedAutoHide: true,
  expandedAutoHideSeconds: 10,
  goalEvents: []
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
        // Remove chaves obsoletas de versões anteriores
        delete parsed.goalScorers;
        delete parsed.period;
        delete parsed.overlayPosition;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler state.json, criando novo estado:', err.message);
  }
  return { ...DEFAULT_STATE };
}

// Salva estado no arquivo
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(gameState, null, 2));
  } catch (err) {
    console.error('Erro ao salvar state.json:', err.message);
  }
}

// Garante que a pasta de logos existe
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
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

// Remove logo da competição
app.delete('/api/competition-logo', (req, res) => {
  if (gameState.competitionLogo) {
    const logoPath = path.join(__dirname, 'public', gameState.competitionLogo);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
    gameState.competitionLogo = null;
    saveState();
    io.emit('state:sync', gameState);
  }

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
    }

    saveState();
    io.emit('state:sync', gameState);
    io.emit('score:updated', { team, goals: gameState[teamKey].goals });
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
    const { team, name } = data;
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    if (typeof name === 'string' && name.trim()) {
      gameState[teamKey].name = name.trim();
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

  // ---- EXPANDED MODE TOGGLE ----
  socket.on('expandedMode:toggle', () => {
    gameState.expandedMode = !gameState.expandedMode;
    gameState.expandedAutoHide = false; // Toggle manual desativa auto-hide
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- EXPANDED MODE SHOW (para auto-hide após gol) ----
  socket.on('expandedMode:show', (data) => {
    const { autoHide, seconds } = data;
    gameState.expandedMode = true;
    gameState.expandedAutoHide = autoHide !== false;
    gameState.expandedAutoHideSeconds = seconds || 10;
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- EXPANDED MODE HIDE ----
  socket.on('expandedMode:hide', () => {
    gameState.expandedMode = false;
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
    saveState();
    io.emit('state:sync', gameState);
  });

  // ---- FULL RESET ----
  socket.on('state:reset', () => {
    gameState = { ...DEFAULT_STATE, goalEvents: [] };
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
