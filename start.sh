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

trap 'printf "\n\n${SPACES}${GREEN}[ ✓ ]${NOCOLOR} Sistema encerrado, até logo!\n"; exit 0' INT

IS_TERMUX=0
NPM_FLAG=""
if [ -d "/data/data/com.termux" ] || [ -n "$TERMUX_VERSION" ] || ([ -n "$PREFIX" ] && [ "$(echo "$PREFIX" | grep -o 'com.termux')" = "com.termux" ]); then
  IS_TERMUX=1
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

check_dependencies() {
  log_step "Verificando dependências do sistema..."
  MISSING_CMDS=""
  MISSING_PKGS=""
  NEED_TNODE=0

  CHECK_CMDS="node curl tar git ffmpeg"
  if [ "$IS_TERMUX" -eq 1 ]; then
    CHECK_CMDS="node curl tar git ffmpeg tnode"
  fi
  
  for cmd in $CHECK_CMDS; do
    if command -v $cmd >/dev/null 2>&1; then
      printf "${SPACES}${GREEN}[ ✓ ]${NOCOLOR} ${WHITE}${cmd}${NOCOLOR}\n"
    else
      printf "${SPACES}${RED}[ x ]${NOCOLOR} ${GRAY}${cmd} (ausente)${NOCOLOR}\n"
      MISSING_CMDS="$MISSING_CMDS $cmd"
      if [ "$cmd" = "node" ]; then
        MISSING_PKGS="$MISSING_PKGS nodejs"
      elif [ "$cmd" = "tnode" ]; then
        NEED_TNODE=1
      else
        MISSING_PKGS="$MISSING_PKGS $cmd"
      fi
    fi
  done

  if [ "$IS_TERMUX" -eq 1 ]; then
    SQLITE_COMPILER_PKGS="build-essential clang make python pkg-config sqlite"
    for pkg in $SQLITE_COMPILER_PKGS; do
      if dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"; then
        printf "${SPACES}${GREEN}[ ✓ ]${NOCOLOR} ${WHITE}${pkg}${NOCOLOR}\n"
      else
        printf "${SPACES}${RED}[ x ]${NOCOLOR} ${GRAY}${pkg} (ausente)${NOCOLOR}\n"
        MISSING_CMDS="$MISSING_CMDS $pkg"
        MISSING_PKGS="$MISSING_PKGS $pkg"
      fi
    done
  fi

  if [ -n "$MISSING_CMDS" ]; then
    if [ "$IS_TERMUX" -eq 1 ]; then
      if [ "$MODE_SKIP" -eq 1 ] || [ "$MODE_UPDATE" -eq 1 ]; then
        DO_INSTALL="S"
      else
        printf "\n${SPACES}${YELLOW}Deseja instalar as ferramentas ausentes agora? [ S/n ]: ${NOCOLOR}"
        read DO_INSTALL
      fi
      
      case "$DO_INSTALL" in
        [sS]|"")
          if [ -n "$MISSING_PKGS" ]; then
            log_step "Instalando via gerenciador de pacotes do Termux..."
            pkg install -y -o APT::Sandbox::User=root --allow-unauthenticated $MISSING_PKGS
            if [ $? -ne 0 ]; then
              log_err "Falha na instalação dos pacotes. Abortando."
              exit 1
            fi
          fi

          if [ "$NEED_TNODE" -eq 1 ]; then
            log_step "Baixando e instalando tnode..."
            curl -fsSL https://github.com/Irithell/tnode/releases/latest/download/install.sh | bash
            hash -r 2>/dev/null
            if command -v tnode >/dev/null 2>&1; then
              log_succ "tnode instalado com sucesso!"
            else
              log_err "Falha ao instalar tnode."
              exit 1
            fi
          fi
          log_succ "Instalação concluída!"
          ;;
        *)
          log_warn "O bot pode não funcionar corretamente."
          sleep 2
          ;;
      esac
    else
      printf "\n${SPACES}${RED}Ferramentas ausentes detectadas. Instale-as manualmente via apt/pacman/yum.${NOCOLOR}\n"
      sleep 2
    fi
  fi
}

get_pkg_hash() {
  node --input-type=module -e "
    import fs from 'fs';
    import crypto from 'crypto';
    try {
      console.log(crypto.createHash('md5').update(fs.readFileSync('package.json')).digest('hex'));
    } catch(e) {}
  "
}

run_npm_install() {
  printf "\n"
  log_step "Sincronizando árvore de dependências..."

  if [ -n "$NPM_FLAG" ]; then
    printf "\n${SPACES}${YELLOW}╭───────────────────────────────────────────────────────────────╮${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}│ AVISO IMPORTANTE PARA USUÁRIOS DO TERMUX                      │${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}│ A compilação nativa de módulos pode levar alguns minutos.     │${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}│ Se você notar que a velocidade de download está muito lenta,  │${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}│ o problema é o mirror padrão do seu Termux.                   │${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}│ Dica: cancele com Ctrl+C e execute 'termux-change-repo'.      │${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}╰───────────────────────────────────────────────────────────────╯${NOCOLOR}\n\n"
    if [ "$MODE_SKIP" -eq 0 ] && [ "$MODE_UPDATE" -eq 0 ]; then
      sleep 2
    fi
  fi

  TMP_INSTALL_LOG=$(mktemp 2>/dev/null || echo ".npm_install_$$.log")
  
  INSTALL_CMD="npm install $NPM_FLAG --no-audit --no-fund"
  if [ "$IS_TERMUX" -eq 1 ] && command -v tnode >/dev/null 2>&1; then
    INSTALL_CMD="tnode npm install $NPM_FLAG --no-audit --no-fund"
  fi

  $INSTALL_CMD > "$TMP_INSTALL_LOG" 2>&1 &
  NPM_PID=$!

  trap 'kill -9 $NPM_PID 2>/dev/null; rm -f "$TMP_INSTALL_LOG"; printf "\n\n${SPACES}${RED}[ x ] Instalação cancelada.${NOCOLOR}\n"; exit 1' INT

  FRAMES="⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏"
  FRAME_IDX=1
  START_TS=$(date +%s)

  while kill -0 "$NPM_PID" 2>/dev/null; do
    CURR_TS=$(date +%s)
    ELAPSED=$(( CURR_TS - START_TS ))
    
    FRAME=$(echo "$FRAMES" | cut -d ' ' -f $FRAME_IDX)
    FRAME_IDX=$(( (FRAME_IDX % 10) + 1 ))

    STATUS_LINE=$(tail -n 5 "$TMP_INSTALL_LOG" 2>/dev/null | grep -v '^[[:space:]]*$' | tail -n 1 | tr -d '\r\n' | sed 's/^[ \t]*//' | cut -c 1-40)

    if [ -n "$STATUS_LINE" ]; then
      printf "\r\033[K${SPACES}${CYAN}[ %s ]${NOCOLOR} ${WHITE}Instalando dependências...${NOCOLOR} ${GRAY}(%ds)${NOCOLOR} ${YELLOW}› %s${NOCOLOR}" "$FRAME" "$ELAPSED" "$STATUS_LINE"
    else
      printf "\r\033[K${SPACES}${CYAN}[ %s ]${NOCOLOR} ${WHITE}Instalando dependências...${NOCOLOR} ${GRAY}(%ds)${NOCOLOR}" "$FRAME" "$ELAPSED"
    fi

    sleep 0.1
  done

  wait "$NPM_PID"
  INSTALL_RES=$?
  TOTAL_TIME=$(( $(date +%s) - START_TS ))
  printf "\r\033[K"

  trap 'printf "\n\n${SPACES}${GREEN}[ ✓ ]${NOCOLOR} Sistema encerrado, até logo!\n"; exit 0' INT

  if [ "$INSTALL_RES" -eq 0 ]; then
    log_succ "Dependências instaladas com sucesso! ${GRAY}(concluído em ${TOTAL_TIME}s)${NOCOLOR}"
    rm -f "$TMP_INSTALL_LOG"
    return 0
  else
    log_err "Falha na instalação de dependências (Código $INSTALL_RES)."
    printf "\n${SPACES}${RED}╭───────────────────── LOG DE ERROS ─────────────────────────────╮${NOCOLOR}\n"
    tail -n 15 "$TMP_INSTALL_LOG" 2>/dev/null | while IFS= read -r l; do
      printf "${SPACES}${GRAY}│ %-62.62s │${NOCOLOR}\n" "$l"
    done
    printf "${SPACES}${RED}╰────────────────────────────────────────────────────────────────╯${NOCOLOR}\n\n"
    rm -f "$TMP_INSTALL_LOG"
    return $INSTALL_RES
  fi
}

create_backup() {
  if [ "$MODE_SKIP" -eq 1 ] || [ "$MODE_UPDATE" -eq 1 ]; then
    DO_BACKUP="S"
  else
    printf "\n${SPACES}${YELLOW}Deseja criar um backup de segurança? [ S/n ]: ${NOCOLOR}"
    read DO_BACKUP
  fi
  
  case "$DO_BACKUP" in
    [sS]|"")
      log_step "Criando backup do sistema..."
      mkdir -p backups
      BKP_FILE="backups/bkp_$(date +%Y%m%d_%H%M%S).tar.gz"
      tar -czf "$BKP_FILE" --exclude="node_modules" --exclude="backups" .
      log_succ "Backup salvo: $BKP_FILE"
      ;;
  esac
}

clean_workspace() {
  log_step "Iniciando formatação do diretório..."
  mkdir -p .safe_zone
  [ -d "database" ] && mv database .safe_zone/
  [ -d "tmp" ] && mv tmp .safe_zone/
  [ -d "backups" ] && mv backups .safe_zone/
  [ -f ".env" ] && mv .env .safe_zone/
  [ -f "start.sh" ] && mv start.sh .safe_zone/
  
  if [ -f "src/configs/config.json" ] || [ -f "src/configs/settings.json" ]; then
    mkdir -p .safe_zone/src/configs
    [ -f "src/configs/config.json" ] && mv src/configs/config.json .safe_zone/src/configs/
    [ -f "src/configs/settings.json" ] && mv src/configs/settings.json .safe_zone/src/configs/
  fi

  find . -mindepth 1 -maxdepth 1 ! -name '.safe_zone' -exec rm -rf {} +
  
  mv .safe_zone/* ./ 2>/dev/null
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
      log_succ "Assinaturas autorizadas."
    else
      rm -f scripts/updater.mjs .tmp_manifest.json
      log_err "Assinatura rejeitada. Arquivo corrompido."
      exit 1
    fi
  fi
}

check_updates() {
  if [ "$MODE_SKIP" -eq 1 ] && [ "$MODE_UPDATE" -eq 0 ]; then
    return 0
  fi

  check_dependencies
  bootstrap_updater
  
  curl -sL "$LATEST_URL/manifest.json" -o .remote_manifest.json 2>/dev/null
  if [ -s .remote_manifest.json ]; then
    REMOTE_VER=$(node --input-type=module -e "import fs from 'fs'; try { console.log(JSON.parse(fs.readFileSync('.remote_manifest.json')).version) } catch(e) {}")
    LOCAL_VER=$(node --input-type=module -e "import fs from 'fs'; try { console.log(JSON.parse(fs.readFileSync('manifest.json')).version) } catch(e) { console.log('0.0.0') }")
    REMOTE_TIME=$(node --input-type=module -e "import fs from 'fs'; try { console.log(JSON.parse(fs.readFileSync('.remote_manifest.json')).build_time) } catch(e) {}")
    LOCAL_TIME=$(node --input-type=module -e "import fs from 'fs'; try { console.log(JSON.parse(fs.readFileSync('manifest.json')).build_time) } catch(e) { console.log('0') }")
    rm -f .remote_manifest.json

    if [ -n "$REMOTE_VER" ] && [ -n "$REMOTE_TIME" ]; then
      if [ "$REMOTE_VER" != "$LOCAL_VER" ] || [ "$REMOTE_TIME" != "$LOCAL_TIME" ]; then
        
        DISPLAY_VER="$REMOTE_VER"
        if [ "$REMOTE_VER" = "$LOCAL_VER" ]; then
          DISPLAY_VER="${REMOTE_VER} (Hotfix)"
        fi

        printf "\n${SPACES}${YELLOW}╭───────────────────────────────────────────────────────────────╮${NOCOLOR}\n"
        printf "${SPACES}${YELLOW}│ ATUALIZAÇÃO DISPONÍVEL                                        │${NOCOLOR}\n"
        printf "${SPACES}${YELLOW}├───────────────────────────────────────────────────────────────┤${NOCOLOR}\n"
        printf "${SPACES}${YELLOW}│ Versão local: ${WHITE}v${LOCAL_VER}${NOCOLOR}\n"
        printf "${SPACES}${YELLOW}│ Nova versão:  ${GREEN}v${DISPLAY_VER}${NOCOLOR}\n"
        printf "${SPACES}${YELLOW}╰───────────────────────────────────────────────────────────────╯${NOCOLOR}\n"
        
        if [ "$MODE_UPDATE" -eq 1 ]; then
          DO_UPDATE="S"
          printf "\n${SPACES}${CYAN}Atualização automática acionada (--update)...${NOCOLOR}\n"
        else
          printf "\n${SPACES}${CYAN}Deseja instalar a atualização agora? [ S/n ]: ${NOCOLOR}"
          read DO_UPDATE
        fi
        
        case "$DO_UPDATE" in
          [sS]|"")
            printf "\n"
            create_backup
            
            PKG_OLD=$(get_pkg_hash)
            node scripts/updater.mjs update
            
            if [ $? -eq 0 ]; then
              chmod +x *.sh 2>/dev/null
              PKG_NEW=$(get_pkg_hash)
              
              if [ "$PKG_OLD" != "$PKG_NEW" ] || [ ! -d "node_modules" ]; then
                log_step "Alteração estrutural detectada nas dependências."
                log_step "Eliminando cache de pacotes antigos..."
                rm -rf node_modules package-lock.json
                run_npm_install
              fi
              log_succ "Atualizado para v${DISPLAY_VER}!"
            else
              log_err "Falha na atualização."
            fi
            sleep 2
            ;;
        esac
      else
        log_succ "O sistema já está na versão mais recente (v${LOCAL_VER})."
      fi
    else
      log_warn "Falha ao processar os dados da versão."
    fi
  else
    log_err "Falha ao verificar atualizações no servidor."
  fi
}

explore_versions() {
  show_banner
  check_dependencies
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

  case "$V_INDEX" in
    ""|*[!0-9]*)
      log_err "Índice não informado ou inválido."
      ;;
    *)
      TARGET_TAG=$(node --input-type=module -e "import fs from 'fs'; try { console.log(JSON.parse(fs.readFileSync('.rel_tmp.json'))[ $V_INDEX ].tag_name) } catch(e) {}")
      if [ -n "$TARGET_TAG" ]; then
        printf "\n${SPACES}${RED}ATENÇÃO: Os arquivos atuais serão substituídos.${NOCOLOR}\n"
        printf "${SPACES}${YELLOW}Confirmar instalação da versão ${TARGET_TAG}? [ S/n ]: ${NOCOLOR}"
        read CONFIRM_DL
        case "$CONFIRM_DL" in
          [sS]|"")
            create_backup
            clean_workspace
            log_step "Baixando release oficial..."
            curl -L -# "https://github.com/$REPO/releases/download/$TARGET_TAG/jurandir-mini.tar.gz" -o pacote.tar.gz
            tar -xzf pacote.tar.gz
            if [ $? -eq 0 ]; then
              rm pacote.tar.gz
              chmod +x *.sh 2>/dev/null
              run_npm_install
              if [ $? -eq 0 ]; then
                log_succ "Versão $TARGET_TAG instalada."
              else
                log_err "A instalação de dependências falhou."
              fi
            else
              log_err "Falha ao extrair pacote."
            fi
            ;;
        esac
      else
        log_err "Índice inválido."
      fi
      ;;
  esac
  rm -f .rel_tmp.json
  printf "\n${SPACES}Pressione ENTER para voltar."
  read JUNK
}

manage_backups() {
  while :; do
    show_banner
    printf "${SPACES}${YELLOW}=== GERENCIADOR DE BACKUPS ===${NOCOLOR}\n\n"
    
    if [ ! -d "backups" ] || [ -z "$(ls backups/*.tar.gz 2>/dev/null)" ]; then
      log_warn "Nenhum backup localizado."
      printf "\n${SPACES}Pressione ENTER para voltar."
      read JUNK
      return
    fi

    i=1
    for b in backups/*.tar.gz; do
      [ -e "$b" ] || continue
      printf "${SPACES}${CYAN}[ %d ]${NOCOLOR} ${WHITE}%s${NOCOLOR} ${GRAY}(%s)${NOCOLOR}\n" "$i" "$(basename "$b")" "$(du -h "$b" | cut -f1)"
      i=$((i + 1))
    done
    TOTAL=$((i - 1))

    printf "\n${SPACES}${CYAN}[ R ] Restaurar  [ E ] Excluir Único  [ L ] Limpar Tudo  [ 0 ] Voltar${NOCOLOR}\n"
    printf "${SPACES}${YELLOW}➭ Escolha: ${NOCOLOR}"
    read B_OPT

    case "$B_OPT" in
      [rR])
        printf "\n${SPACES}${YELLOW}Número do backup: ${NOCOLOR}"
        read B_NUM
        case "$B_NUM" in
          ""|*[!0-9]*) log_err "Valor incorreto."; sleep 1 ;;
          *)
            if [ "$B_NUM" -gt 0 ] && [ "$B_NUM" -le "$TOTAL" ]; then
              curr=1
              TARGET=""
              for b in backups/*.tar.gz; do
                if [ "$curr" -eq "$B_NUM" ]; then TARGET="$b"; break; fi
                curr=$((curr + 1))
              done
              
              printf "\n${SPACES}${RED}A restauração substituirá os arquivos atuais.${NOCOLOR}\n"
              printf "${SPACES}${YELLOW}Confirmar aplicação de $(basename "$TARGET")? [ S/n ]: ${NOCOLOR}"
              read CONFIRM
              case "$CONFIRM" in
                [sS]|"")
                  clean_workspace
                  log_step "Descompactando arquivos..."
                  tar -xzf "$TARGET"
                  if [ $? -eq 0 ]; then
                    chmod +x *.sh 2>/dev/null
                    run_npm_install
                    if [ $? -eq 0 ]; then
                      log_succ "Backup restaurado com sucesso."
                    else
                      log_err "A instalação de dependências falhou."
                    fi
                  else
                    log_err "Falha ao restaurar."
                  fi
                  sleep 2
                  ;;
              esac
            else
              log_err "Valor incorreto."; sleep 1
            fi
            ;;
        esac
        ;;
      [eE])
        printf "\n${SPACES}${YELLOW}Número do backup: ${NOCOLOR}"
        read B_NUM
        case "$B_NUM" in
          ""|*[!0-9]*) log_err "Valor incorreto."; sleep 1 ;;
          *)
            if [ "$B_NUM" -gt 0 ] && [ "$B_NUM" -le "$TOTAL" ]; then
              curr=1
              for b in backups/*.tar.gz; do
                if [ "$curr" -eq "$B_NUM" ]; then
                  rm -f "$b"
                  log_succ "Backup excluído."
                  sleep 1
                  break
                fi
                curr=$((curr + 1))
              done
            else
              log_err "Valor incorreto."; sleep 1
            fi
            ;;
        esac
        ;;
      [lL])
        printf "\n${SPACES}${RED}Apagar todos os backups? [ S/n ]: ${NOCOLOR}"
        read CONFIRM
        case "$CONFIRM" in
          [sS]|"")
            rm -rf backups/*.tar.gz
            log_succ "Todos os backups foram apagados."
            sleep 1
            ;;
        esac
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
     
     if [ "$MODE_SKIP" -eq 1 ] || [ "$MODE_UPDATE" -eq 1 ]; then
       DO_INSTALL="S"
       printf "\n${SPACES}${YELLOW}Instalação automática acionada pelas flags...${NOCOLOR}\n"
     else
       printf "\n${SPACES}${YELLOW}Deseja instalar o bot agora? [ S/n ]: ${NOCOLOR}"
       read DO_INSTALL
     fi
     
     case "$DO_INSTALL" in
       [sS]|"")
         create_backup
         clean_workspace
         bootstrap_updater
         log_step "Baixando arquivos do sistema..."
         node scripts/updater.mjs reinstall
         if [ $? -eq 0 ]; then
           chmod +x *.sh 2>/dev/null
           run_npm_install
           if [ $? -eq 0 ]; then
             log_succ "Instalação concluída!"
           else
             log_err "A instalação falhou. Abortando inicialização."
             if [ "$MODE_SKIP" -eq 0 ]; then printf "\n${SPACES}Pressione ENTER para voltar."; read JUNK; fi
             return
           fi
         else
           log_err "A instalação falhou. Abortando inicialização."
           if [ "$MODE_SKIP" -eq 0 ]; then printf "\n${SPACES}Pressione ENTER para voltar."; read JUNK; fi
           return
         fi
         ;;
       *)
         return
         ;;
     esac
  fi
  
  MISSING_MODULES=0
  if [ ! -d "node_modules" ]; then
    MISSING_MODULES=1
  elif ! node -e "import('chokidar').catch(() => process.exit(1))" >/dev/null 2>&1; then
    MISSING_MODULES=1
  fi

  if [ "$MISSING_MODULES" -eq 1 ]; then
    log_warn "As dependências do projeto não foram instaladas."
    printf "\n${SPACES}${YELLOW}Deseja instalar as dependências agora? [ S/n ]: ${NOCOLOR}"
    read DO_INSTALL_DEPS
    case "$DO_INSTALL_DEPS" in
      [sS]|"")
        run_npm_install
        if [ $? -ne 0 ]; then
          log_err "A instalação de dependências falhou. Abortando inicialização."
          if [ "$MODE_SKIP" -eq 0 ]; then printf "\n${SPACES}Pressione ENTER para voltar."; read JUNK; fi
          return
        fi
        ;;
      *)
        log_err "Não é possível iniciar o bot sem as dependências instaladas."
        if [ "$MODE_SKIP" -eq 0 ]; then printf "\n${SPACES}Pressione ENTER para voltar."; read JUNK; fi
        return
        ;;
    esac
  fi

  if [ "$IS_TERMUX" -eq 1 ]; then
    if ! command -v tnode >/dev/null 2>&1; then
      log_warn "Ferramenta tnode ausente no ambiente Termux."
      log_step "Baixando e instalando tnode..."
      curl -fsSL https://github.com/Irithell/tnode/releases/latest/download/install.sh | bash
      hash -r 2>/dev/null
    fi

    if [ -d "node_modules/better-sqlite3" ]; then
      SQLITE_BIN="node_modules/better-sqlite3/build/Release/better_sqlite3.node"
      NEED_SQLITE_REBUILD=0
      if [ ! -f "$SQLITE_BIN" ]; then
        NEED_SQLITE_REBUILD=1
      elif command -v tnode >/dev/null 2>&1 && ! tnode node -e "require('better-sqlite3')" >/dev/null 2>&1; then
        NEED_SQLITE_REBUILD=1
      fi

      if [ "$NEED_SQLITE_REBUILD" -eq 1 ]; then
        SQLITE_COMPILER_PKGS="build-essential clang make python pkg-config sqlite"
        MISSING_BUILD_DEPS=""
        for b_pkg in $SQLITE_COMPILER_PKGS; do
          if ! dpkg-query -W -f='${Status}' "$b_pkg" 2>/dev/null | grep -q "install ok installed"; then
            MISSING_BUILD_DEPS="$MISSING_BUILD_DEPS $b_pkg"
          fi
        done
        if [ -n "$MISSING_BUILD_DEPS" ]; then
          log_step "Instalando dependências de compilação do Termux ($MISSING_BUILD_DEPS)..."
          pkg install -y -o APT::Sandbox::User=root --allow-unauthenticated $MISSING_BUILD_DEPS
        fi

        log_warn "Binário compilado do better-sqlite3 ausente ou incompatível."
        log_step "Compilando módulo nativo better-sqlite3 via tnode..."
        printf "\n"
        (cd node_modules/better-sqlite3 && tnode npx node-gyp rebuild --android_ndk_path="")
        if [ $? -eq 0 ] && [ -f "$SQLITE_BIN" ]; then
          printf "\n"
          log_succ "Motor SQLite compilado com sucesso!"
          sleep 2
          show_banner
        else
          printf "\n"
          log_err "Falha na compilação do better-sqlite3 via tnode."
          if [ "$MODE_SKIP" -eq 0 ]; then printf "\n${SPACES}Pressione ENTER para voltar."; read JUNK; fi
          return
        fi
      fi
    fi
  fi

  NODE_CMD="node"
  if [ "$IS_TERMUX" -eq 1 ] && command -v tnode >/dev/null 2>&1; then
    NODE_CMD="tnode node"
  fi
    
  while :; do
    if [ "$MODE_CODE" -eq 1 ]; then 
      $NODE_CMD launcher.js --code 
    else 
      $NODE_CMD launcher.js 
    fi
    
    EXIT_CODE=$?
    if [ "$EXIT_CODE" -eq 0 ]; then
      printf "\n"
      log_succ "Processo encerrado."
      break
    fi

    if [ ! -d "node_modules" ]; then
      log_err "Diretório node_modules não encontrado."
      printf "\n${SPACES}${YELLOW}Deseja instalar as dependências agora? [ S/n ]: ${NOCOLOR}"
      read DO_INSTALL_DEPS
      case "$DO_INSTALL_DEPS" in
        [sS]|"") run_npm_install ;;
        *) break ;;
      esac
    else
      log_warn "O processo foi interrompido (Code $EXIT_CODE). Reiniciando em 2 segundos..."
      sleep 2
    fi
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
    
    case "$OPTION" in
      1) MODE_CODE=0; start_bot ;;
      2) MODE_CODE=1; start_bot ;;
      3) 
        check_dependencies
        printf "\n"
        log_warn "Os arquivos locais serão substituídos."
        printf "${SPACES}${YELLOW}Confirmar Instalação Limpa? [ S/n ]: ${NOCOLOR}"
        read CONFIRM_DL
        case "$CONFIRM_DL" in
          [sS]|"")
            create_backup
            clean_workspace
            bootstrap_updater
            log_step "Baixando arquivos do sistema..."
            node scripts/updater.mjs reinstall
            if [ $? -eq 0 ]; then
              chmod +x *.sh 2>/dev/null
              run_npm_install
              if [ $? -eq 0 ]; then
                log_succ "Instalação concluída!"
              else
                log_err "A instalação falhou."
              fi
            else
              log_err "A instalação falhou."
            fi
            ;;
        esac
        printf "\n${SPACES}Pressione ENTER para voltar."
        read JUNK
        ;;
      4) 
        printf "\n"
        check_updates
        printf "\n${SPACES}Pressione ENTER para voltar."
        read JUNK
        ;;
      5) explore_versions ;;
      6) manage_backups ;;
      7)
        printf "\n"
        run_npm_install
        if [ $? -eq 0 ]; then
          log_succ "Concluído!"
        else
          log_err "Falha na instalação de dependências."
        fi
        printf "\n${SPACES}Pressione ENTER para voltar."
        read JUNK
        ;;
      8)
        printf "\n"
        log_step "Apagando diretório de módulos..."
        rm -rf node_modules package-lock.json
        log_succ "Concluído!"
        printf "\n${SPACES}Pressione ENTER para voltar."
        read JUNK
        ;;
      9)
        printf "\n"
        if [ ! -f "$DB_PATH" ]; then
           log_err "Banco de dados não encontrado."
        else
           log_step "Limpando chaves e histórico de conexão..."
           NODE_EXEC="node"
           if [ "$IS_TERMUX" -eq 1 ] && command -v tnode >/dev/null 2>&1; then
             NODE_EXEC="tnode node"
           fi
           $NODE_EXEC -e "import('./src/configs/database.js').then(m => m.dbRun('DELETE FROM auth_keys')).catch(() => process.exit(1));"
           if [ $? -eq 0 ]; then log_succ "Limpeza concluída! Você continua logado."; else log_err "Falha na limpeza."; fi
        fi
        printf "\n${SPACES}Pressione ENTER para voltar."
        read JUNK
        ;;
      10)
        printf "\n"
        log_step "Apagando banco de dados inteiro..."
        rm -f "$DB_PATH" "${DB_PATH}-wal" "${DB_PATH}-shm"
        log_succ "Sessão apagada com sucesso!"
        printf "\n${SPACES}Pressione ENTER para voltar."
        read JUNK
        ;;
      0) printf "\n${SPACES}${GREEN}Finalizando operações...${NOCOLOR}\n"; exit 0 ;;
      *) log_err "Opção inválida."; sleep 1 ;;
    esac
  done
}

MODE_CODE=0
MODE_SKIP=0
MODE_UPDATE=0
HAS_FLAGS=0

for arg in "$@"; do
  case $arg in
    --code|code) MODE_CODE=1; HAS_FLAGS=1 ;;
    --skip|skip) MODE_SKIP=1; HAS_FLAGS=1 ;;
    --update|update) MODE_UPDATE=1; HAS_FLAGS=1 ;;
    --qr|qr) MODE_CODE=0; HAS_FLAGS=1 ;;
  esac
done

if [ "$HAS_FLAGS" -eq 1 ]; then
  start_bot
else
  show_menu
fi