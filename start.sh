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
SPACES=""

NPM_FLAG=""
if [ -n "$PREFIX" ] && [ "$(echo "$PREFIX" | grep -o 'com.termux')" = "com.termux" ]; then
  NPM_FLAG="--no-bin-links"
fi

set_layout() {
  local cols=$(tput cols 2>/dev/null || echo 80)
  local width=65
  local pad=$(( (cols - width) / 2 ))
  [ "$pad" -lt 0 ] && pad=0
  SPACES=$(printf '%*s' "$pad" "")
}

log_info() { printf "${SPACES}${BLUE}[ ℹ ]${NOCOLOR} $1\n"; }
log_step() { printf "${SPACES}${CYAN}[ ⚙ ]${NOCOLOR} $1\n"; }
log_succ() { printf "${SPACES}${GREEN}[ ✓ ]${NOCOLOR} $1\n"; }
log_warn() { printf "${SPACES}${YELLOW}[ ! ]${NOCOLOR} $1\n"; }
log_err()  { printf "${SPACES}${RED}[ x ]${NOCOLOR} $1\n"; }

show_banner() {
  clear
  set_layout
  printf "${SPACES}${CYAN}╭───────────────────────────────────────────────────────────────╮${NOCOLOR}\n"
  printf "${SPACES}${CYAN}│${WHITE} 🤖 JURANDIR MINI — CENTRAL DE GERENCIAMENTO AVANÇADO        ${CYAN}│${NOCOLOR}\n"
  printf "${SPACES}${CYAN}╰───────────────────────────────────────────────────────────────╯${NOCOLOR}\n"
}

detect_env() {
  if ! command -v node >/dev/null 2>&1; then log_err "Node.js ausente!"; exit 1; fi
  if ! command -v curl >/dev/null 2>&1; then log_err "curl ausente!"; exit 1; fi
  if ! command -v zip >/dev/null 2>&1; then log_err "zip/unzip ausentes!"; exit 1; fi
}

create_backup() {
  printf "\n${SPACES}${YELLOW}Deseja fazer um backup de segurança antes de alterar? [S/n]: ${NOCOLOR}"
  read DO_BACKUP
  if [[ -z "$DO_BACKUP" ]] || [[ "$DO_BACKUP" =~ ^[sS]$ ]]; then
    log_step "Empacotando projeto (ignorando módulos pesados)..."
    mkdir -p backups
    BKP_FILE="backups/bkp_$(date +%Y%m%d_%H%M%S).zip"
    zip -q -r "$BKP_FILE" . -x "node_modules/*" -x "backups/*"
    log_succ "Backup salvo: $BKP_FILE"
  fi
}

clean_workspace() {
  log_step "Iniciando formatação limpa do sistema..."
  mkdir -p .safe_zone
  [ -d "database" ] && mv database .safe_zone/
  [ -d "tmp" ] && mv tmp .safe_zone/
  [ -d "backups" ] && mv backups .safe_zone/
  [ -f ".env" ] && mv .env .safe_zone/
  [ -f "start.sh" ] && mv start.sh .safe_zone/

  find . -mindepth 1 -maxdepth 1 ! -name '.safe_zone' -exec rm -rf {} +
  mv .safe_zone/* ./
  rm -rf .safe_zone
  log_succ "Área de trabalho formatada com sucesso."
}

bootstrap_updater() {
  if [ ! -f "scripts/updater.js" ]; then
    log_step "Sincronizando mecanismo central..."
    mkdir -p scripts
    curl -sL -# "$LATEST_URL/manifest.json" -o .tmp_manifest.json
    [ ! -s .tmp_manifest.json ] && { log_err "Falha na rede."; exit 1; }
    
    curl -sL -# "$LATEST_URL/updater.js" -o scripts/updater.js
    
    NODE_VALIDATION=$(node -e "
      const fs = require('fs'), crypto = require('crypto');
      try {
        const hash = crypto.createHash('sha256').update(fs.readFileSync('scripts/updater.js')).digest('hex');
        const expected = JSON.parse(fs.readFileSync('.tmp_manifest.json')).files['scripts/updater.js'];
        console.log(hash === expected ? 'OK' : 'ERR');
      } catch(e) { console.log('ERR'); }
    ")
    
    if [ "$NODE_VALIDATION" = "OK" ]; then
      mv .tmp_manifest.json manifest.json
      log_succ "Mecanismo autêntico."
    else
      rm -f scripts/updater.js .tmp_manifest.json
      log_err "Assinatura digital rejeitada."
      exit 1
    fi
  fi
}

check_updates() {
  detect_env
  bootstrap_updater
  
  curl -sL "$LATEST_URL/manifest.json" -o .remote_manifest.json 2>/dev/null
  if [ -s .remote_manifest.json ]; then
    REMOTE_VER=$(node -e "try { console.log(require('./.remote_manifest.json').version) } catch(e) {}")
    LOCAL_VER=$(node -e "try { console.log(require('./manifest.json').version) } catch(e) { console.log('0.0.0') }")
    rm -f .remote_manifest.json

    if [ "$REMOTE_VER" != "$LOCAL_VER" ] && [ -n "$REMOTE_VER" ]; then
      printf "\n${SPACES}${YELLOW}╭───────────────────────────────────────────────────────────────╮${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}│ 🌟 ATUALIZAÇÃO DISPONÍVEL!                                  │${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}│ Versão local: ${WHITE}v${LOCAL_VER}${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}│ Nova versão:  ${GREEN}v${REMOTE_VER}${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}╰───────────────────────────────────────────────────────────────╯${NOCOLOR}\n"
      
      printf "\n${SPACES}${CYAN}Deseja instalar a atualização agora? [S/n]: ${NOCOLOR}"
      read DO_UPDATE
      if [[ -z "$DO_UPDATE" ]] || [[ "$DO_UPDATE" =~ ^[sS]$ ]]; then
        printf "\n"
        create_backup
        node scripts/updater.js update
        if [ $? -eq 0 ]; then
          log_step "Sincronizando dependências NPM..."
          npm install $NPM_FLAG >/dev/null 2>&1
          log_succ "Atualizado para v${REMOTE_VER}!"
        else
          log_err "Falha ao aplicar o patch."
        fi
        sleep 2
      fi
    fi
  fi
}

explore_versions() {
  show_banner
  detect_env
  log_step "Consultando banco de dados oficial..."
  
  node -e "
    const https = require('https'), fs = require('fs');
    https.get('$API_URL', { headers: { 'User-Agent': 'Client' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          r.forEach((v, i) => console.log(\`${SPACES}\\x1b[36m[\\x1b[32m \${i} \\x1b[36m]\\x1b[0m \\x1b[1;37m\${v.tag_name}\\x1b[0m \\x1b[90m— \${new Date(v.published_at).toLocaleDateString()}\\x1b[0m\`));
          fs.writeFileSync('.rel_tmp.json', JSON.stringify(r));
        } catch(e) { console.log('ERRO'); }
      });
    }).on('error', () => console.log('ERRO'));
  " > .menu_out
  
  [ $(grep -c "ERRO" .menu_out) -gt 0 ] && { log_err "Erro de rede."; rm -f .menu_out .rel_tmp.json; sleep 2; return; }

  printf "\n${SPACES}${YELLOW}=== HISTÓRICO DE VERSÕES ===${NOCOLOR}\n"
  cat .menu_out
  rm -f .menu_out
  
  printf "\n${SPACES}${CYAN}Digite o NÚMERO da versão (ou deixe vazio): ${NOCOLOR}"
  read V_INDEX

  if [[ "$V_INDEX" =~ ^[0-9]+$ ]]; then
    TARGET_TAG=$(node -e "try { console.log(require('./.rel_tmp.json')[$V_INDEX].tag_name) } catch(e) {}")
    if [ -n "$TARGET_TAG" ]; then
      printf "\n${SPACES}${RED}ATENÇÃO: A versão selecionada substituirá os arquivos atuais.${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}Confirmar Instalação Limpa (${TARGET_TAG})? [s/N]: ${NOCOLOR}"
      read CONFIRM_DL
      if [[ "$CONFIRM_DL" =~ ^[sS]$ ]]; then
        create_backup
        clean_workspace
        log_step "Baixando release isolada..."
        curl -L -# "https://github.com/$REPO/releases/download/$TARGET_TAG/jurandir-mini.zip" -o pacote.zip
        unzip -q -o pacote.zip
        rm pacote.zip
        log_step "Instalando Módulos..."
        npm install $NPM_FLAG >/dev/null 2>&1
        log_succ "Versão $TARGET_TAG operando."
      fi
    else
      log_err "Índice não existe."
    fi
  fi
  rm -f .rel_tmp.json
  printf "\n${SPACES}Pressione ENTER para voltar."
  read -r
}

manage_backups() {
  while :; do
    show_banner
    printf "${SPACES}${YELLOW}=== GERENCIADOR DE BACKUPS ===${NOCOLOR}\n\n"
    
    if [ ! -d "backups" ] || [ -z "$(ls -A backups 2>/dev/null)" ]; then
      log_warn "Nenhum arquivo de segurança foi encontrado."
      printf "\n${SPACES}Pressione ENTER para voltar."
      read -r
      return
    fi

    local i=1
    local bkp_list=()
    for b in backups/*.zip; do
      bkp_list+=("$b")
      printf "${SPACES}${CYAN}[ %d ]${NOCOLOR} ${WHITE}%s${NOCOLOR} ${GRAY}(%s)${NOCOLOR}\n" "$i" "$(basename "$b")" "$(du -h "$b" | cut -f1)"
      i=$((i + 1))
    done

    printf "\n${SPACES}${CYAN}[R] Restaurar  [E] Excluir Único  [L] Limpar Tudo  [0] Voltar${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}➭ Escolha: ${NOCOLOR}"
    read B_OPT

    case $B_OPT in
      [rR])
        printf "\n${SPACES}${YELLOW}Número para restaurar: ${NOCOLOR}"
        read B_NUM
        if [[ "$B_NUM" =~ ^[0-9]+$ ]] && [ "$B_NUM" -gt 0 ] && [ "$B_NUM" -le "${#bkp_list[@]}" ]; then
          TARGET="${bkp_list[$((B_NUM-1))]}"
          printf "\n${SPACES}${RED}A restauração sobrepõe seu código local atual.${NOCOLOR}\n"
          printf "${SPACES}${YELLOW}Confirmar aplicação de $(basename "$TARGET")? [s/N]: ${NOCOLOR}"
          read CONFIRM
          if [[ "$CONFIRM" =~ ^[sS]$ ]]; then
            clean_workspace
            log_step "Descompactando..."
            unzip -q -o "$TARGET"
            log_step "Instalando dependências..."
            npm install $NPM_FLAG >/dev/null 2>&1
            log_succ "Estado de segurança recuperado."
            sleep 2
          fi
        else
          log_err "Valor incorreto."; sleep 1
        fi
        ;;
      [eE])
        printf "\n${SPACES}${YELLOW}Número para excluir: ${NOCOLOR}"
        read B_NUM
        if [[ "$B_NUM" =~ ^[0-9]+$ ]] && [ "$B_NUM" -gt 0 ] && [ "$B_NUM" -le "${#bkp_list[@]}" ]; then
          rm -f "${bkp_list[$((B_NUM-1))]}"
          log_succ "Backup eliminado."; sleep 1
        fi
        ;;
      [lL])
        printf "\n${SPACES}${RED}Apagar TODOS os backups definitivamente? [s/N]: ${NOCOLOR}"
        read CONFIRM
        if [[ "$CONFIRM" =~ ^[sS]$ ]]; then
          rm -rf backups/*.zip
          log_succ "Storage de segurança formatado."; sleep 1
        fi
        ;;
      0) return ;;
      *) log_err "Opção inválida."; sleep 1 ;;
    esac
  done
}

start_bot() {
  clear
  check_updates
  show_banner
  
  if [ ! -f "launcher.js" ]; then
     log_err "launcher.js ausente. Formate ou restaure um backup."
     printf "\n${SPACES}Pressione ENTER."
     read -r
     return
  fi
    
  while :; do
    if [ "$1" = "--code" ]; then node launcher.js --code; else node launcher.js; fi
    log_warn "O processo sofreu interrupção. Relançando em 2 segundos..."
    sleep 2
  done
}

show_menu() {
  while :; do
    show_banner
    printf "${SPACES}${CYAN}╭───────────────────────────────────────────────────────────────╮${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE} [ 1 ] 🟢 Iniciar: Modo QR Code                                ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GRAY}       Inicia o bot e exibe o código no terminal.              ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE} [ 2 ] 🔵 Iniciar: Modo Pairing Code                           ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GRAY}       Inicia o bot solicitando o código no WhatsApp.          ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE} [ 3 ] 🔄 Forçar Instalação da Última Versão                   ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GRAY}       Limpa o diretório e baixa o release oficial mais novo.  ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE} [ 4 ] 📜 Explorar e Instalar Versões Anteriores               ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GRAY}       Lista o histórico do GitHub para downgrade/upgrade.     ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE} [ 5 ] 📦 Gerenciar Backups do Sistema                         ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GRAY}       Listar, restaurar ou excluir snapshots de segurança.    ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE} [ 6 ] 🧹 Manutenção: Reinstalar Dependências (NPM)            ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GRAY}       Apaga cache de módulos e realiza nova instalação.       ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE} [ 7 ] 🗑️  Segurança: Desconectar WhatsApp                       ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GRAY}       Exclui chaves do SQLite exigindo novo login.            ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE} [ 0 ] ❌ Sair da Interface                                    ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}╰───────────────────────────────────────────────────────────────╯${NOCOLOR}\n\n"
    
    printf "${SPACES}${YELLOW}  ➭ Opção: ${NOCOLOR}"
    read OPTION
    
    case $OPTION in
      1) start_bot ;;
      2) start_bot "--code" ;;
      3) 
        detect_env
        printf "\n"
        log_warn "Isso fará uma limpeza completa dos arquivos locais."
        printf "${SPACES}${YELLOW}Confirmar Instalação Limpa? [s/N]: ${NOCOLOR}"
        read CONFIRM_DL
        if [[ "$CONFIRM_DL" =~ ^[sS]$ ]]; then
          create_backup
          clean_workspace
          bootstrap_updater
          log_step "Baixando sistema base..."
          node scripts/updater.js reinstall
          log_step "Instalando Módulos..."
          npm install $NPM_FLAG >/dev/null 2>&1
          log_succ "Instalação Concluída!"
        fi
        printf "\n${SPACES}Pressione ENTER."
        read -r
        ;;
      4) explore_versions ;;
      5) manage_backups ;;
      6)
        printf "\n"
        log_step "Apagando node_modules e travas..."
        rm -rf node_modules package-lock.json
        log_step "Instalando dependências..."
        npm install $NPM_FLAG
        log_succ "Restaurado."
        printf "\n${SPACES}Pressione ENTER."
        read -r
        ;;
      7)
        printf "\n"
        if [ ! -f "$DB_PATH" ]; then
           log_err "Database não encontrada."
        else
           log_step "Limpando chaves de autenticação..."
           node -e "import('./src/configs/database.js').then(m => m.dbRun('DELETE FROM auth_keys')).catch(() => process.exit(1));"
           log_succ "Desconectado!"
        fi
        printf "\n${SPACES}Pressione ENTER."
        read -r
        ;;
      0) printf "\n${SPACES}${GREEN}Finalizando operações...${NOCOLOR}\n"; exit 0 ;;
      *) log_err "Invalido."; sleep 1 ;;
    esac
  done
}

if [ "$1" = "qr" ]; then start_bot; elif [ "$1" = "code" ]; then start_bot "--code"; else show_menu; fi