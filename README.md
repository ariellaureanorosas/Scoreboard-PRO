# Futsal Overlay — Placar Profissional para OBS

Sistema completo de overlay de placar de futsal para uso com OBS Studio, controlado por um painel web separado. Tudo roda 100% localmente, sem depender de serviços externos.

## Características

- **Dois modos de exibição**
  - **Barra compacta** (estilo Champions League): badge da competição, cronômetro, traves de cor dos times e placar com siglas
  - **Placar expandido**: nomes completos, escudos, placar central em destaque e barra de faltas
- **Animações de entrada e saída** — slide + fade suaves na troca entre modos, com as faltas entrando em sequência
- **Editor de recorte de imagens** — ao enviar um escudo ou logo, recorte no tamanho real usado pelo overlay (com pré-visualização circular para escudos)
- **Controle de faltas com bolinhas** — 5 bolinhas por time + contador de faltas diretas (DLP) que persiste entre períodos
- **Cronômetro preciso** — calculado no servidor; continua contando mesmo se a aba for fechada
- **Sincronização instantânea** — qualquer mudança no painel aparece imediatamente no overlay via WebSocket
- **Persistência automática** — o estado do jogo sobrevive a reinícios do servidor
- **Acesso via celular** — controle o jogo pelo celular na mesma rede Wi-Fi

## Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 14 ou superior)
- [OBS Studio](https://obsproject.com/) (para usar o overlay)

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/SEU-USUARIO/futsal-overlay.git
cd futsal-overlay
```

2. Instale as dependências:
```bash
npm install
```

## Uso

1. Inicie o servidor:
```bash
npm start
```

2. O servidor irá iniciar e mostrar as URLs no console:
```
========================================
  SISTEMA DE OVERLAY DE FUTSAL
========================================

Servidor rodando em: http://localhost:3000

URL do Overlay (OBS): http://localhost:3000/overlay.html
URL do Painel:       http://localhost:3000/control.html
```

## Configuração no OBS Studio

### Adicionando o Overlay

1. No OBS, vá em **Fontes** → **+** → **Browser**
2. Nomeie como "Placar Futsal"
3. Configure:
   - **URL:** `http://localhost:3000/overlay.html`
   - **Largura:** 1920
   - **Altura:** 1080
   - **Marque:** "Refresh browser when scene becomes active"
   - **Desmarque:** "Control audio via OBS"
4. Clique em **OK**

> **Dica:** marque **"Refresh browser when scene becomes active"** para garantir que o overlay sempre mostre o estado atual ao ativar a cena.

## Painel de Controle

Acesse o painel de controle em:
```
http://localhost:3000/control.html
```

O painel permite:

- **Placar:** adicionar/remover gols para cada time
- **Cronômetro:** iniciar, pausar, zerar e ajustar tempo
- **Faltas:** contabilizar faltas por time, com reset por período e acúmulo de faltas diretas (DLP)
- **Times:** editar nomes, siglas, cores e fazer upload de escudos com editor de recorte
- **Logo da competição:** upload com recorte no tamanho real do badge
- **Período:** selecionar 1º Tempo, 2º Tempo, Prorrogação ou Pênaltis
- **Posição:** configurar overlay no topo ou base da tela
- **Modo expandido:** alternar manualmente ou exibir automaticamente após cada gol (com auto-hide)

### Acesso via Celular

Para controlar pelo celular na mesma rede Wi-Fi:

1. Descubra o IP do seu computador (no Windows: `ipconfig`)
2. Acesse pelo celular:
   - Painel: `http://<IP-DO-PC>:3000/control.html`
3. O servidor escuta em `0.0.0.0`, permitindo acesso pela rede local

## Estrutura de Pastas

```
futsal-overlay/
├── server.js           # Servidor Express + Socket.io
├── package.json        # Dependências do projeto
├── state.json          # Estado atual do jogo (auto-gerado, não versionado)
├── public/
│   ├── overlay.html    # Overlay para o OBS
│   ├── overlay.css     # Estilos do overlay
│   ├── overlay.js      # Lógica do overlay
│   ├── control.html    # Painel de controle
│   ├── control.css     # Estilos do painel
│   ├── control.js      # Lógica do painel
│   └── assets/
│       └── logos/      # Escudos enviados (não versionado)
└── README.md           # Este arquivo
```

## Customização

### Cores do Overlay

Edite as variáveis CSS no topo do arquivo `public/overlay.css`:

```css
:root {
  --main-bg-color: #0a1657;      /* Fundo principal do placar */
  --badge-bg: #e8edf5;           /* Fundo do badge da competição */
  --chevron-color: #5dc9f1;      /* Cor dos chevrons › ‹ e bolinhas de falta */
  --white: #FFFFFF;

  --font-main: 'Barlow Condensed', 'Oswald', 'Impact', sans-serif;

  --bar-height: 58px;            /* Altura da barra compacta */
  --badge-width: 48px;
  --clock-width: 108px;
  --color-bar-width: 11px;

  --pos-top: 40px;               /* Posição do overlay na tela */
  --pos-left: 40px;
}
```

### Fonte

O overlay usa as fontes **Barlow Condensed** e **Oswald** do Google Fonts. Para usar offline, baixe as fontes e importe localmente no CSS.

## Solução de Problemas

### Overlay não aparece no OBS
- Verifique se o servidor está rodando
- Teste a URL `http://localhost:3000/overlay.html` no navegador
- Clique em "Refresh" no Browser Source do OBS

### Estado não sincroniza
- Verifique se ambas as páginas estão conectadas (indicador verde no painel)
- Recarregue ambas as páginas

### Upload de logo não funciona
- Verifique o tamanho do arquivo (máximo 2MB)
- Use apenas formatos PNG, JPG ou SVG
- Verifique se a pasta `public/assets/logos/` existe e tem permissão de escrita

### Cronômetro perde precisão
- O cronômetro é calculado no servidor, não no navegador
- Mesmo que a aba seja fechada, o tempo continua sendo contado

## Licença

Este projeto é licenciado sob a [Business Source License 1.1 (BSL 1.1)](LICENSE).

### O que você PODE fazer

- ✅ Usar o sistema para o seu próprio clube, organização ou evento
- ✅ Copiar e modificar o código para uso interno
- ✅ Após **21/08/2030**, cada versão converte automaticamente para MIT (uso livre)

### O que você NÃO pode fazer

- ❌ Vender, alugar ou sublicenciar o sistema para terceiros
- ❌ Redistribuir o código como produto próprio
- ❌ Usar comercialmente para oferecer o sistema como serviço

### Licenciamento comercial

O aluguel e o licenciamento comercial são **exclusivos do autor**.
Para obter uma licença comercial, entre em contato através do GitHub:
[ariellaureanorosas](https://github.com/ariellaureanorosas)
