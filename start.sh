#!/bin/sh

NOCOLOR='\033[0m'
RED='\033[0;31m'
GREEN='\033[1;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
WHITE='\033[1;37m'
GRAY='\033[1;30m'

REPO="Irithell/Jurandir-Mini"
LATEST_URL="https://github.com/$REPO/releases/latest/download"
API_URL="https://api.github.com/repos/$REPO/releases"
DB_PATH="./database/sessions/jurandir.db"

NPM_FLAG=""
if [ -n "$PREFIX" ] && [ "$(echo "$PREFIX" | grep -o 'com.termux')" = "com.termux" ]; then
  NPM_FLAG="--no-bin-links"
fi

show_banner() {
  clear
  printf "${CYAN}╭─────────────────────────────────────────────────────────────╮${NOCOLOR}\n"
  printf "${CYAN}│${WHITE} 🤖 JURANDIR MINI — CENTRAL DE GERENCIAMENTO AVANÇADO      ${CYAN}│${NOCOLOR}\n"
  printf "${CYAN}╰─────────────────────────────────────────────────────────────╯${NOCOLOR}\n"
}

log_info() { printf "${BLUE}[ ℹ ]${NOCOLOR} $1\n"; }
log_step() { printf "${CYAN}[ ⚙ ]${NOCOLOR} $1\n"; }
log_succ() { printf "${GREEN}[ ✓ ]${NOCOLOR} $1\n"; }
log_warn() { printf "${YELLOW}[ ! ]${NOCOLOR} $1\n"; }
log_err()  { printf "${RED}[ x ]${NOCOLOR} $1\n"; }

detect_env() {
  if ! command -v node >/dev/null 2>&1; then
    log_err "Node.js não encontrado! O sistema requer o Node instalado."
    exit 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    log_err "curl não encontrado! Instale-o para prosseguir (apt install curl)."
    exit 1
  fi
}

clean_workspace() {
  log_step "Iniciando protocolo de formatação limpa (Wipe)..."
  mkdir -p .safe_zone
  
  [ -d "database" ] && mv database .safe_zone/
  [ -d "tmp" ] && mv tmp .safe_zone/
  [ -f ".env" ] && mv .env .safe_zone/
  [ -f "start.sh" ] && mv start.sh .safe_zone/

  find . -mindepth 1 -maxdepth 1 ! -name '.safe_zone' -exec rm -rf {} +
  
  mv .safe_zone/* ./
  rm -rf .safe_zone
  log_succ "Área de trabalho limpa e pronta para a nova instalação."
}

bootstrap_updater() {
  if [ ! -f "scripts/updater.js" ]; then
    log_step "Sincronizando mecanismo central de atualização..."
    mkdir -p scripts
    
    log_info "1/3 Baixando manifest.json oficial..."
    curl -sL -# "$LATEST_URL/manifest.json" -o .tmp_manifest.json
    
    if [ ! -s .tmp_manifest.json ]; then
      log_err "Falha ao contactar o servidor do GitHub Releases."
      exit 1
    fi

    log_info "2/3 Baixando script isolado (updater.js)..."
    curl -sL -# "$LATEST_URL/updater.js" -o scripts/updater.js
    
    log_info "3/3 Validando integridade criptográfica (SHA-256)..."
    NODE_VALIDATION=$(node -e "
      const fs = require('fs');
      const crypto = require('crypto');
      try {
        const manifest = JSON.parse(fs.readFileSync('.tmp_manifest.json'));
        const expected = manifest.files['scripts/updater.js'];
        const actual = crypto.createHash('sha256').update(fs.readFileSync('scripts/updater.js')).digest('hex');
        console.log(expected === actual ? 'OK' : 'CORRUPTED');
      } catch(e) { console.log('ERROR'); }
    ")

    if [ "$NODE_VALIDATION" = "OK" ]; then
      mv .tmp_manifest.json manifest.json
      log_succ "Mecanismo de atualização verificado e autêntico."
    else
      rm -f scripts/updater.js .tmp_manifest.json
      log_err "Assinatura do updater.js não confere. Arquivo possivelmente corrompido. Abortando."
      exit 1
    fi
  fi
}

check_updates() {
  detect_env
  bootstrap_updater
  
  curl -sL "$LATEST_URL/manifest.json" -o .remote_manifest.json 2>/dev/null
  if [ -s .remote_manifest.json ]; then
    
    REMOTE_VER=$(node -e "try { console.log(require('./.remote_manifest.json').version) } catch(e) { console.log('') }")
    LOCAL_VER=$(node -e "try { console.log(require('./manifest.json').version) } catch(e) { console.log('0.0.0') }")
    
    rm -f .remote_manifest.json

    if [ "$REMOTE_VER" != "$LOCAL_VER" ] && [ -n "$REMOTE_VER" ]; then
      printf "\n${YELLOW}╭──────────────────────────────────────────────────╮${NOCOLOR}\n"
      printf "${YELLOW}│ 🌟 ATUALIZAÇÃO DISPONÍVEL!                       │${NOCOLOR}\n"
      printf "${YELLOW}├──────────────────────────────────────────────────┤${NOCOLOR}\n"
      printf "${YELLOW}│ Sua versão atual: ${WHITE}v${LOCAL_VER}${NOCOLOR}\n"
      printf "${YELLOW}│ Nova versão:      ${GREEN}v${REMOTE_VER}${NOCOLOR}\n"
      printf "${YELLOW}╰──────────────────────────────────────────────────╯${NOCOLOR}\n"
      
      printf "\n${CYAN}Deseja instalar a atualização agora? [S/n]: ${NOCOLOR}"
      read DO_UPDATE
      if [[ -z "$DO_UPDATE" ]] || [[ "$DO_UPDATE" =~ ^[sS]$ ]]; then
        printf "\n"
        node scripts/updater.js update
        if [ $? -eq 0 ]; then
          log_step "Sincronizando dependências (npm)..."
          npm install $NPM_FLAG >/dev/null 2>&1
          log_succ "Sistema operando na versão v${REMOTE_VER}!"
          sleep 2
        else
          log_err "Falha na aplicação do patch de atualização."
          sleep 2
        fi
      else
        log_info "Atualização adiada. Iniciando versão atual."
      fi
    fi
  else
    log_warn "Sem conexão com o GitHub para verificar atualizações."
  fi
}

explore_versions() {
  show_banner
  detect_env
  log_step "Consultando banco de dados de releases oficiais..."
  
  node -e "
    const https = require('https');
    https.get('$API_URL', { headers: { 'User-Agent': 'Jurandir-Client' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const releases = JSON.parse(data);
          if(!Array.isArray(releases) || releases.length === 0) throw new Error();
          releases.forEach((r, i) => {
            const date = new Date(r.published_at).toLocaleDateString('pt-BR');
            console.log(\`\x1b[36m[\x1b[32m \${i} \x1b[36m]\x1b[0m \x1b[1;37m\${r.tag_name}\x1b[0m \x1b[90m— Lançado em \${date}\x1b[0m\`);
          });
          require('fs').writeFileSync('.releases_tmp.json', JSON.stringify(releases));
        } catch(e) { console.log('ERRO'); }
      });
    }).on('error', () => console.log('ERRO'));
  " > .menu_out
  
  if grep -q "ERRO" .menu_out; then
    log_err "Falha ao processar as versões disponíveis. Verifique sua rede."
    rm -f .menu_out .releases_tmp.json
    printf "\nPressione ENTER para voltar."
    read -r
    return
  fi

  printf "\n${YELLOW}=== HISTÓRICO DE VERSÕES ===${NOCOLOR}\n"
  cat .menu_out
  rm -f .menu_out
  
  printf "\n${CYAN}Digite o NÚMERO da versão desejada (ou deixe vazio para cancelar): ${NOCOLOR}"
  read V_INDEX

  if [[ "$V_INDEX" =~ ^[0-9]+$ ]]; then
    TARGET_TAG=$(node -e "try { console.log(require('./.releases_tmp.json')[$V_INDEX].tag_name) } catch(e) {}")
    
    if [ -n "$TARGET_TAG" ]; then
      printf "\n${RED}ATENÇÃO: Isso formatará o diretório (preservando o database e .env).${NOCOLOR}\n"
      printf "${YELLOW}Confirmar instalação limpa da versão ${TARGET_TAG}? [s/N]: ${NOCOLOR}"
      read CONFIRM_DL
      
      if [[ "$CONFIRM_DL" =~ ^[sS]$ ]]; then
        clean_workspace
        log_step "Baixando pacote criptografado ($TARGET_TAG)..."
        DL_URL="https://github.com/$REPO/releases/download/$TARGET_TAG/jurandir-mini.zip"
        
        curl -L -# "$DL_URL" -o pacote.zip
        
        log_step "Extraindo e posicionando arquivos..."
        unzip -q -o pacote.zip
        rm pacote.zip
        
        log_step "Instalando Módulos do Sistema..."
        npm install $NPM_FLAG >/dev/null 2>&1
        log_succ "Versão $TARGET_TAG instalada e pronta para uso!"
      fi
    else
      log_err "Índice de versão inválido."
    fi
  fi
  
  rm -f .releases_tmp.json
  printf "\nPressione ENTER para voltar ao menu."
  read -r
}

start_bot() {
  clear
  check_updates
  show_banner
  
  if [ ! -f "launcher.js" ]; then
     log_err "launcher.js ausente. Use a opção de instalação/restauração no menu."
     printf "\nPressione ENTER para voltar."
     read -r
     return
  fi
    
  while :
  do
    if [ "$1" = "--code" ]; then
      node launcher.js --code
    else
      node launcher.js
    fi
    
    log_warn "O processo foi encerrado! Reiniciando a aplicação em 2 segundos..."
    sleep 2
  done
}

show_menu() {
  while :
  do
    show_banner
    printf "${CYAN}╭─────────────────────────────────────────────────────────────╮${NOCOLOR}\n"
    printf "${CYAN}│${WHITE} [ 1 ] 🟢 Iniciar: Modo QR Code                              ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${GRAY}       Inicia o bot e exibe o código no terminal.            ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${WHITE} [ 2 ] 🔵 Iniciar: Modo Pairing Code                         ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${GRAY}       Inicia o bot solicitando o código no WhatsApp.        ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}├─────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${CYAN}│${WHITE} [ 3 ] 🔄 Forçar Instalação da Última Versão                 ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${GRAY}       Limpa o diretório e baixa o último release oficial.   ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${WHITE} [ 4 ] 📜 Explorar e Instalar Versões Anteriores             ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${GRAY}       Lista o histórico do GitHub para downgrade/upgrade.   ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}├─────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${CYAN}│${WHITE} [ 5 ] 🧹 Manutenção: Reinstalar Dependências (NPM)          ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${GRAY}       Apaga cache de módulos e realiza nova instalação.     ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${WHITE} [ 6 ] 🗑️  Segurança: Desconectar WhatsApp                     ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}│${GRAY}       Exclui chaves do SQLite exigindo novo login.          ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}├─────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${CYAN}│${WHITE} [ 0 ] ❌ Sair da Interface                                  ${CYAN}│${NOCOLOR}\n"
    printf "${CYAN}╰─────────────────────────────────────────────────────────────╯${NOCOLOR}\n\n"
    
    printf "${YELLOW}  ➭ Qual operação deseja executar? ${NOCOLOR}"
    read OPTION
    
    case $OPTION in
      1) start_bot ;;
      2) start_bot "--code" ;;
      3) 
        detect_env
        printf "\n"
        log_warn "Isso fará uma limpeza completa dos arquivos locais (mantendo o Database)."
        printf "${YELLOW}Confirmar Instalação Limpa? [s/N]: ${NOCOLOR}"
        read CONFIRM_DL
        if [[ "$CONFIRM_DL" =~ ^[sS]$ ]]; then
          clean_workspace
          bootstrap_updater
          log_step "Baixando o sistema base..."
          node scripts/updater.js force
          log_step "Instalando Módulos do Sistema..."
          npm install $NPM_FLAG >/dev/null 2>&1
          log_succ "Instalação Concluída!"
        fi
        printf "\nPressione ENTER para voltar."
        read -r
        ;;
      4) 
        explore_versions 
        ;;
      5)
        printf "\n"
        log_step "Apagando node_modules e arquivos de trava..."
        rm -rf node_modules package-lock.json
        log_step "Instalando dependências ativas..."
        npm install $NPM_FLAG
        log_succ "Ambiente node_modules restaurado."
        printf "\nPressione ENTER para voltar."
        read -r
        ;;
      6)
        printf "\n"
        if [ ! -f "$DB_PATH" ]; then
           log_err "O banco de dados SQLite não foi encontrado."
        else
           log_step "Limpando chaves de segurança..."
           node -e "import('./src/configs/database.js').then(m => m.dbRun('DELETE FROM auth_keys')).catch(() => process.exit(1));"
           log_succ "Desconexão executada! O bot solicitará novo QR/Code."
        fi
        printf "\nPressione ENTER para voltar."
        read -r
        ;;
      0)
        printf "\n${GREEN}Finalizando operações...${NOCOLOR}\n"
        exit 0
        ;;
      *)
        printf "\n"
        log_err "Comando não reconhecido."
        sleep 1
        ;;
    esac
  done
}

if [ "$1" = "qr" ]; then
  start_bot
elif [ "$1" = "code" ]; then
  start_bot "--code"
else
  show_menu
fi