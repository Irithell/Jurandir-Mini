#!/bin/sh

NOCOLOR='\033[0m'
RED='\033[0;31m'
GREEN='\033[1;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
WHITE='\033[1;37m'

DB_PATH="./database/sessions/jurandir.db"
RAW_URL="https://raw.githubusercontent.com/Irithell/Jurandir-Mini/main"

NPM_FLAG=""
if [ -n "$PREFIX" ] && [ "$(echo $PREFIX | grep -o 'com.termux')" = "com.termux" ]; then
  NPM_FLAG="--no-bin-links"
fi

detect_env() {
  if ! command -v node >/dev/null 2>&1; then
    printf "${RED}[x] Node.js não encontrado! Instale para continuar.${NOCOLOR}\n"
    exit 1
  fi
  
  if [ ! -f "scripts/updater.js" ]; then
    printf "${YELLOW}[⚙] Baixando módulo de atualização...${NOCOLOR}\n"
    mkdir -p scripts
    curl -sL --connect-timeout 25 "$RAW_URL/scripts/updater.js" -o scripts/updater.js
    
    if [ ! -s "scripts/updater.js" ]; then
      printf "${RED}[x] Falha na rede ao obter o módulo de atualização.${NOCOLOR}\n"
      exit 1
    fi
  fi
}

check_updates() {
  detect_env
  printf "${YELLOW}[⚙] Verificando servidor de atualizações...${NOCOLOR}\n"
  
  node scripts/updater.js check
  STATUS=$?

  if [ $STATUS -eq 1 ]; then
    printf "${GREEN}[+] Nova versão detectada! Iniciando sincronização...${NOCOLOR}\n"
    node scripts/updater.js update
    
    if [ $? -eq 0 ]; then
      printf "\n${YELLOW}[+] Instalando módulos (npm)...${NOCOLOR}\n"
      npm install $NPM_FLAG >/dev/null 2>&1
      printf "${GREEN}[✓] Sistema atualizado com sucesso!${NOCOLOR}\n\n"
    else
      printf "${RED}[x] Falha ao aplicar a atualização.${NOCOLOR}\n\n"
    fi
  elif [ $STATUS -eq 2 ]; then
     printf "${RED}[!] Servidor indisponível ou erro de rede.${NOCOLOR}\n"
     if [ ! -f "launcher.js" ]; then
        printf "${RED}[x] Não é possível rodar o bot sem os arquivos básicos.${NOCOLOR}\n\n"
     else
        printf "${YELLOW}[i] Pulando atualização. Iniciando com os arquivos locais.${NOCOLOR}\n\n"
     fi
  else
    printf "${GREEN}[✓] O bot já está na versão mais recente.${NOCOLOR}\n\n"
  fi
}

show_banner() {
  clear
}

start_bot() {
  clear
  show_banner
  
  check_updates
  
  if [ ! -f "launcher.js" ]; then
     printf "${RED}[x] O arquivo launcher.js não foi encontrado. A instalação falhou.${NOCOLOR}\n"
     printf "Pressione ENTER para voltar ao menu."
     read PAUSE
     return
  fi
    
  while :
  do
    if [ "$1" = "--code" ]; then
      node launcher.js --code
    else
      node launcher.js
    fi
    
    sleep 1
    printf "\n${BLUE}[! Jurandir] O processo foi fechado! Reiniciando, aguarde...${NOCOLOR}\n"
  done
}

show_menu() {
  while :
  do
    show_banner
    
    COLS=$(tput cols 2>/dev/null || echo 80)
    MENU_WIDTH=56
    PAD=$(( (COLS - MENU_WIDTH) / 2 ))
    if [ "$PAD" -lt 0 ]; then PAD=0; fi
    SPACES=$(printf '%*s' "$PAD" "")

    printf "\n"
    printf "${SPACES}${CYAN}╭──────────────────────────────────────────────────────╮${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${WHITE}               PAINEL DE GERENCIAMENTO                ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├──────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GREEN}  [ 1 ]${WHITE} Iniciar Bot por QR Code                       ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${GREEN}  [ 2 ]${WHITE} Iniciar Bot por Código (Pairing)              ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├──────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${YELLOW}  [ 3 ]${WHITE} Instalar Bot do Zero (Download Total)         ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${YELLOW}  [ 4 ]${WHITE} Forçar Verificação de Atualizações            ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${YELLOW}  [ 5 ]${WHITE} Restaurar Sistema (Limpeza e Download)        ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├──────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${BLUE}  [ 6 ]${WHITE} Instalar Módulos (npm install)                ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${BLUE}  [ 7 ]${WHITE} Apagar node_modules e package-lock            ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├──────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${RED}  [ 8 ]${WHITE} Limpar Sessões SQLite (Preserva Credenciais)  ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${RED}  [ 9 ]${WHITE} Apagar Sessão Completa (Requer novo Login)    ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}├──────────────────────────────────────────────────────┤${NOCOLOR}\n"
    printf "${SPACES}${CYAN}│${RED}  [ 0 ]${WHITE} Sair do Script                                ${CYAN}│${NOCOLOR}\n"
    printf "${SPACES}${CYAN}╰──────────────────────────────────────────────────────╯${NOCOLOR}\n\n"
    
    printf "${SPACES}${YELLOW}  ➭ Opção: ${NOCOLOR}"
    read OPTION
    
    case $OPTION in
      1) start_bot ;;
      2) start_bot "--code" ;;
      3) 
        detect_env
        printf "\n${YELLOW}[⚙] Iniciando download do sistema...${NOCOLOR}\n"
        node scripts/updater.js force
        printf "\n${YELLOW}[+] Baixando dependências (npm)...${NOCOLOR}\n"
        npm install $NPM_FLAG
        printf "\n${GREEN}[✓] Instalação Concluída!${NOCOLOR} Pressione ENTER para voltar."
        read PAUSE
        ;;
      4) 
        check_updates
        printf "\n${GREEN}[✓] Operação finalizada!${NOCOLOR} Pressione ENTER para voltar."
        read PAUSE
        ;;
      5) 
        detect_env
        printf "\n${YELLOW}[-] Removendo cache local...${NOCOLOR}\n"
        rm -rf node_modules package-lock.json src/
        printf "\n${YELLOW}[⚙] Refazendo download dos arquivos...${NOCOLOR}\n"
        node scripts/updater.js force
        printf "\n${YELLOW}[+] Reinstalando módulos...${NOCOLOR}\n"
        npm install $NPM_FLAG
        printf "\n${GREEN}[✓] Sistema restaurado!${NOCOLOR} Pressione ENTER para voltar."
        read PAUSE
        ;;
      6)
        printf "\n${SPACES}${YELLOW}[+ Jurandir] Instalando dependências...${NOCOLOR}\n"
        npm install $NPM_FLAG
        printf "\n${SPACES}${GREEN}[✓ Jurandir] Concluído!${NOCOLOR} Pressione ENTER para voltar."
        read PAUSE
        ;;
      7)
        printf "\n${SPACES}${YELLOW}[- Jurandir] Apagando node_modules...${NOCOLOR}\n"
        rm -rf node_modules package-lock.json
        printf "\n${SPACES}${GREEN}[✓ Jurandir] Concluído!${NOCOLOR} Pressione ENTER para voltar."
        read PAUSE
        ;;
      8)
        if [ ! -f "$DB_PATH" ]; then
           printf "\n${SPACES}${RED}[x Jurandir] O banco de dados SQLite não foi encontrado.${NOCOLOR}\n"
        else
           printf "\n${SPACES}${YELLOW}[- Jurandir] Limpando chaves e histórico de conexão...${NOCOLOR}\n"
           node -e "import('./src/configs/database.js').then(m => m.dbRun('DELETE FROM auth_keys')).catch(() => process.exit(1));"
           printf "${SPACES}${GREEN}[✓ Jurandir] Limpeza concluída! Você continua logado.${NOCOLOR}\n"
        fi
        printf "\n${SPACES}Pressione ENTER para voltar."
        read PAUSE
        ;;
      9)
        printf "\n${SPACES}${RED}[! Jurandir] Apagando banco de dados inteiro...${NOCOLOR}\n"
        rm -f "$DB_PATH" "${DB_PATH}-wal" "${DB_PATH}-shm"
        printf "${SPACES}${GREEN}[✓ Jurandir] Sessão apagada com sucesso!${NOCOLOR}\n"
        printf "\n${SPACES}Pressione ENTER para voltar."
        read PAUSE
        ;;
      0)
        printf "\n${SPACES}${GREEN}Saindo...${NOCOLOR}\n"
        exit 0
        ;;
      *)
        printf "\n${SPACES}${RED}[x] Opção inválida!${NOCOLOR} Pressione ENTER para tentar novamente."
        read PAUSE
        ;;
    esac
  done
}

if [ "$1" = "não" ] || [ "$1" = "qr" ]; then
  start_bot
elif [ "$1" = "sim" ] || [ "$1" = "--code" ] || [ "$1" = "code" ]; then
  start_bot "--code"
else
  show_menu
fi