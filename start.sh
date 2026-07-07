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
  printf "${SPACES}${CYAN}│${WHITE}           JURANDIR MINI — CENTRAL DE GERENCIAMENTO            ${CYAN}│${NOCOLOR}\n"
  printf "${SPACES}${CYAN}╰───────────────────────────────────────────────────────────────╯${NOCOLOR}\n"
}

detect_env() {
  if ! command -v node >/dev/null 2>&1; then log_err "Node.js ausente!"; exit 1; fi
  if ! command -v curl >/dev/null 2>&1; then log_err "curl ausente!"; exit 1; fi
  if ! command -v zip >/dev/null 2>&1; then log_err "zip/unzip ausentes!"; exit 1; fi
}

create_backup() {
  printf "\n${SPACES}${YELLOW}Deseja criar um backup de segurança? [S/n]: ${NOCOLOR}"
  read DO_BACKUP
  if [[ -z "$DO_BACKUP" ]] || [[ "$DO_BACKUP" =~ ^[sS]$ ]]; then
    log_step "Criando backup do sistema..."
    mkdir -p backups
    BKP_FILE="backups/bkp_$(date +%Y%m%d_%H%M%S).zip"
    zip -q -r "$BKP_FILE" . -x "node_modules/*" -x "backups/*"
    log_succ "Backup salvo: $BKP_FILE"
  fi
}

clean_workspace() {
  log_step "Iniciando formatação do diretório..."
  mkdir -p .safe_zone
  [ -d "database" ] && mv database .safe_zone/
  [ -d "tmp" ] && mv tmp .safe_zone/
  [ -d "backups" ] && mv backups .safe_zone/
  [ -f ".env" ] && mv .env .safe_zone/
  [ -f "start.sh" ] && mv start.sh .safe_zone/

  find . -mindepth 1 -maxdepth 1 ! -name '.safe_zone' -exec rm -rf {} +
  mv .safe_zone/* ./
  rm -rf .safe_zone
  log_succ "Limpeza de diretório concluída."
}

bootstrap_updater() {
  if [ ! -f "scripts/updater.mjs" ]; then
    log_step "Sincronizando mecanismo central..."
    mkdir -p scripts
    curl -sL -# "$LATEST_URL/manifest.json" -o .tmp_manifest.json
    [ ! -s .tmp_manifest.json ] && { log_err "Falha na comunicação de rede."; exit 1; }
    
    curl -sL -# "$LATEST_URL/updater.mjs" -o scripts/updater.mjs
    
    NODE_VALIDATION=$(node --input-type=module -e "
      import fs from 'fs';
      import crypto from 'crypto';
      try {
        const hash = crypto.createHash('sha256').update(fs.readFileSync('scripts/updater.mjs')).digest('hex');
        const expected = JSON.parse(fs.readFileSync('.tmp_manifest.json')).files['scripts/updater.mjs'];
        console.log(hash === expected ? 'OK' : 'ERR');
      } catch(e) { console.log('ERR'); }
    ")
    
    if [ "$NODE_VALIDATION" = "OK" ]; then
      mv .tmp_manifest.json manifest.json
      log_succ "Validação autêntica."
    else
      rm -f scripts/updater.mjs .tmp_manifest.json
      log_err "Assinatura rejeitada. Arquivo corrompido."
      exit 1
    fi
  fi
}

check_updates() {
  detect_env
  bootstrap_updater
  
  curl -sL "$LATEST_URL/manifest.json" -o .remote_manifest.json 2>/dev/null
  if [ -s .remote_manifest.json ]; then
    REMOTE_VER=$(node --input-type=module -e "import fs from 'fs'; try { console.log(JSON.parse(fs.readFileSync('.remote_manifest.json')).version) } catch(e) {}")
    LOCAL_VER=$(node --input-type=module -e "import fs from 'fs'; try { console.log(JSON.parse(fs.readFileSync('manifest.json')).version) } catch(e) { console.log('0.0.0') }")
    rm -f .remote_manifest.json

    if [ "$REMOTE_VER" != "$LOCAL_VER" ] && [ -n "$REMOTE_VER" ]; then
      printf "\n${SPACES}${YELLOW}╭───────────────────────────────────────────────────────────────╮${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}│ ATUALIZAÇÃO DISPONÍVEL                                        │${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}│ Versão local: ${WHITE}v${LOCAL_VER}${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}│ Nova versão:  ${GREEN}v${REMOTE_VER}${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}╰───────────────────────────────────────────────────────────────╯${NOCOLOR}\n"
      
      printf "\n${SPACES}${CYAN}Deseja instalar a atualização agora? [S/n]: ${NOCOLOR}"
      read DO_UPDATE
      if [[ -z "$DO_UPDATE" ]] || [[ "$DO_UPDATE" =~ ^[sS]$ ]]; then
        printf "\n"
        create_backup
        node scripts/updater.mjs update
        if [ $? -eq 0 ]; then
          log_step "Instalando dependências..."
          npm install $NPM_FLAG >/dev/null 2>&1
          log_succ "Atualizado para v${REMOTE_VER}!"
        else
          log_err "Falha na atualização."
        fi
        sleep 2
      fi
    elif [ -n "$REMOTE_VER" ]; then
      log_succ "O sistema já está na versão mais recente (v${LOCAL_VER})."
    else
      log_warn "Falha ao processar os dados da versão."
    fi
  else
    log_err "Falha ao verificar atualizações no servidor."
  fi
}

explore_versions() {
  show_banner
  detect_env
  log_step "Consultando repositório remoto..."
  
  node --input-type=module -e "
    import https from 'https';
    import fs from 'fs';
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
  
  [ $(grep -c "ERRO" .menu_out) -gt 0 ] && { log_err "Falha de conexão."; rm -f .menu_out .rel_tmp.json; sleep 2; return; }

  printf "\n${SPACES}${YELLOW}=== HISTÓRICO DE VERSÕES ===${NOCOLOR}\n"
  cat .menu_out
  rm -f .menu_out
  
  printf "\n${SPACES}${CYAN}Digite o NÚMERO da versão (ou deixe vazio para cancelar): ${NOCOLOR}"
  read V_INDEX

  if [[ "$V_INDEX" =~ ^[0-9]+$ ]]; then
    TARGET_TAG=$(node --input-type=module -e "import fs from 'fs'; try { console.log(JSON.parse(fs.readFileSync('.rel_tmp.json'))[$V_INDEX].tag_name) } catch(e) {}")
    if [ -n "$TARGET_TAG" ]; then
      printf "\n${SPACES}${RED}ATENÇÃO: Os arquivos atuais serão substituídos.${NOCOLOR}\n"
      printf "${SPACES}${YELLOW}Confirmar instalação da versão ${TARGET_TAG}? [s/N]: ${NOCOLOR}"
      read CONFIRM_DL
      if [[ "$CONFIRM_DL" =~ ^[sS]$ ]]; then
        create_backup
        clean_workspace
        log_step "Baixando release oficial..."
        curl -L -# "https://github.com/$REPO/releases/download/$TARGET_TAG/jurandir-mini.zip" -o pacote.zip
        unzip -q -o pacote.zip
        if [ $? -eq 0 ]; then
          rm pacote.zip
          log_step "Instalando dependências..."
          npm install $NPM_FLAG >/dev/null 2>&1
          log_succ "Versão $TARGET_TAG instalada."
        else
          log_err "Falha ao extrair pacote."
        fi
      fi
    else
      log_err "Índice inválido."
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
      log_warn "Nenhum backup localizado."
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
        printf "\n${SPACES}${YELLOW}Número do backup: ${NOCOLOR}"
        read B_NUM
        if [[ "$B_NUM" =~ ^[0-9]+$ ]] && [ "$B_NUM" -gt 0 ] && [ "$B_NUM" -le "${#bkp_list[@]}" ]; then
          TARGET="${bkp_list[$((B_NUM-1))]}"
          printf "\n${SPACES}${RED}A restauração substituirá os arquivos atuais.${NOCOLOR}\n"
          printf "${SPACES}${YELLOW}Confirmar aplicação de $(basename "$TARGET")? [s/N]: ${NOCOLOR}"
          read CONFIRM
          if [[ "$CONFIRM" =~ ^[sS]$ ]]; then
            clean_workspace
            log_step "Descompactando arquivos..."
            unzip -q -o "$TARGET"
            if [ $? -eq 0 ]; then
              log_step "Instalando dependências..."
              npm install $NPM_FLAG >/dev/null 2>&1
              log_succ "Backup restaurado com sucesso."
            else
              log_err "Falha ao restaurar."
            fi
            sleep 2
          fi
        else
          log_err "Valor incorreto."; sleep 1
        fi
        ;;
      [eE])
        printf "\n${SPACES}${YELLOW}Número do backup: ${NOCOLOR}"
        read B_NUM
        if [[ "$B_NUM" =~ ^[0-9]+$ ]] && [ "$B_NUM" -gt 0 ] && [ "$B_NUM" -le "${#bkp_list[@]}" ]; then
          rm -f "${bkp_list[$((B_NUM-1))]}"
          log_succ "Backup excluído."; sleep 1
        fi
        ;;
      [lL])
        printf "\n${SPACES}${RED}Apagar todos os backups? [s/N]: ${NOCOLOR}"
        read CONFIRM
        if [[ "$CONFIRM" =~ ^[sS]$ ]]; then
          rm -rf backups/*.zip
          log_succ "Todos os backups foram apagados."; sleep 1
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
     log_err "O arquivo launcher.js não foi encontrado."
     printf "\n${SPACES}${YELLOW}Deseja instalar o bot agora? [S/n]: ${NOCOLOR}"
     read DO_INSTALL
     if [[ -z "$DO_INSTALL" ]] || [[ "$DO_INSTALL" =~ ^[sS]$ ]]; then
       create_backup
       clean_workspace
       bootstrap_updater
       log_step "Baixando arquivos do sistema..."
       node scripts/updater.mjs reinstall
       if [ $? -eq 0 ]; then
         log_step "Instalando módulos..."
         npm install $NPM_FLAG >/dev/null 2>&1
         log_succ "Instalação concluída!"
       else
         log_err "A instalação falhou. Abortando inicialização."
         printf "\n${SPACES}Pressione ENTER para voltar."
         read -r
         return
       fi
     else
       return
     fi
  fi
    
  while :; do
    if [ "$1" = "--code" ]; then node launcher.js --code; else node launcher.js; fi
    log_warn "O processo foi interrompido. Reiniciando em 2 segundos..."
    sleep 2
  done
}

show_menu() {
  while :; do
    show_banner
    printf "${SPACES}${CYAN}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GREEN} [ 1 ]${WHITE} Iniciar Bot por QR Code                                 ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GREEN} [ 2 ]${WHITE} Iniciar Bot por Código (Pairing)                        ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${YELLOW} [ 3 ]${WHITE} Instalar Bot (Baixar Arquivos)                          ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${YELLOW} [ 4 ]${WHITE} Verificar Atualizações Manualmente                      ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${YELLOW} [ 5 ]${WHITE} Explorar e Instalar Versões Anteriores                  ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${YELLOW} [ 6 ]${WHITE} Gerenciar Backups do Sistema                            ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${BLUE} [ 7 ]${WHITE} Instalar Apenas Módulos (npm install)                   ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${BLUE} [ 8 ]${WHITE} Apagar Apenas node_modules e package-lock               ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${RED} [ 9 ]${WHITE} Limpar Sessões SQLite (Preserva Credenciais)            ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${RED} [ 10]${WHITE} Apagar Sessão Completa (Requer novo Login)              ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${RED} [ 0 ]${WHITE} Sair do Script                                          ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}╰───────────────────────────────────────────────────────────────╯${NOCOLOR}\n\n"
    
    printf "${SPACES}${YELLOW}  ➭ Opção: ${NOCOLOR}"
    read OPTION
    
    case $OPTION in
      1) start_bot ;;
      2) start_bot "--code" ;;
      3) 
        detect_env
        printf "\n"
        log_warn "Os arquivos locais serão substituídos."
        printf "${SPACES}${YELLOW}Confirmar Instalação Limpa? [s/N]: ${NOCOLOR}"
        read CONFIRM_DL
        if [[ "$CONFIRM_DL" =~ ^[sS]$ ]]; then
          create_backup
          clean_workspace
          bootstrap_updater
          log_step "Baixando arquivos do sistema..."
          node scripts/updater.mjs reinstall
          if [ $? -eq 0 ]; then
            log_step "Instalando módulos..."
            npm install $NPM_FLAG >/dev/null 2>&1
            log_succ "Instalação concluída!"
          else
            log_err "A instalação falhou."
          fi
        fi
        printf "\n${SPACES}Pressione ENTER para voltar."
        read -r
        ;;
      4) 
        printf "\n"
        check_updates
        printf "\n${SPACES}Pressione ENTER para voltar."
        read -r
        ;;
      5) explore_versions ;;
      6) manage_backups ;;
      7)
        printf "\n"
        log_step "Instalando dependências..."
        npm install $NPM_FLAG
        log_succ "Concluído!"
        printf "\n${SPACES}Pressione ENTER para voltar."
        read -r
        ;;
      8)
        printf "\n"
        log_step "Apagando diretório de módulos..."
        rm -rf node_modules package-lock.json
        log_succ "Concluído!"
        printf "\n${SPACES}Pressione ENTER para voltar."
        read -r
        ;;
      9)
        printf "\n"
        if [ ! -f "$DB_PATH" ]; then
           log_err "Banco de dados não encontrado."
        else
           log_step "Limpando chaves e histórico de conexão..."
           node -e "import('./src/configs/database.js').then(m => m.dbRun('DELETE FROM auth_keys')).catch(() => process.exit(1));"
           if [ $? -eq 0 ]; then log_succ "Limpeza concluída! Você continua logado."; else log_err "Falha na limpeza."; fi
        fi
        printf "\n${SPACES}Pressione ENTER para voltar."
        read -r
        ;;
      10)
        printf "\n"
        log_step "Apagando banco de dados inteiro..."
        rm -f "$DB_PATH" "${DB_PATH}-wal" "${DB_PATH}-shm"
        log_succ "Sessão apagada com sucesso!"
        printf "\n${SPACES}Pressione ENTER para voltar."
        read -r
        ;;
      0) printf "\n${SPACES}${GREEN}Finalizando operações...${NOCOLOR}\n"; exit 0 ;;
      *) log_err "Opção inválida."; sleep 1 ;;
    esac
  done
}

if [ "$1" = "qr" ]; then start_bot; elif [ "$1" = "code" ]; then start_bot "--code"; else show_menu; fi