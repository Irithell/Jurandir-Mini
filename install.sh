#!/usr/bin/env bash

set -e

# ==================================================
#           JURANDIR MINI — INSTALADOR
# ==================================================

RESET='\033[0m'
BOLD='\033[1m'
COLOR_ART='\033[38;5;213m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
BLUE='\033[1;34m'
RED='\033[1;31m'

REPO="Irithell/Jurandir-Mini"
LATEST_URL="https://github.com/${REPO}/releases/latest/download/start.sh"

printf '\033[8;35;68t' 2>/dev/null
cols=$(tput cols 2>/dev/null || echo 80)
export COLUMNS="$cols"
pad=$(( (cols - 54) / 2 ))
[ "$pad" -lt 0 ] && pad=0
ART_INDENT=$(printf '%*s' "$pad" "")

box_pad=$(( (cols - 65) / 2 ))
[ "$box_pad" -lt 0 ] && box_pad=0
BOX_INDENT=$(printf '%*s' "$box_pad" "")

clear

if [ -d "/data/data/com.termux" ] || [ -n "$TERMUX_VERSION" ]; then
  if [ "$cols" -lt 65 ]; then
    echo -e "${YELLOW}[ ! ] Tela estreita (${cols} colunas). Afaste o zoom com gesto de pinça para ajustar (mín. 65).${RESET}\n"
  fi
fi

echo ""
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣶⣶⣶⣴⣦⣄⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⠿⣿⣿⣿⣿⣿⣿⣷⣀⠀⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠻⣿⣿⣿⣿⣧⡀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⣿⣏⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⡟⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⣿⣿⣿⣿⠁⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣿⣿⣿⣿⣿⡟⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠈⢻⣿⣿⣶⣦⣤⣀⣴⣶⣶⣤⣄⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⠁⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⣤⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣟⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⡀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄⠀⠀⠀⢠⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣾⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣾⣿⣿⣿⣿⡄⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⢻⣿⣿⣟⣿⡿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⢸⣿⣿⣿⣮⣽⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠉⠛⠿⢿⡿⠿⠟⠉⠀⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡅${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀⢻⣿⣿⣿⡿⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠀⠀⠀⣿⣿⣿⣿⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠋⠁⠀⠀⠀⠀⠀⢠⣿⣿⣿⣿⣷⣆${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠛⠿⠿⠿⠿⠛${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿⠟⣿⣿⣿⣿⣿⣿⣿⠆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠉⠛⠻⠿⠿⠛⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀${RESET}"
echo -e "${ART_INDENT}${COLOR_ART}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠛⠿⠿⠟⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀${RESET}"
echo ""

echo -e "${BOX_INDENT}${CYAN}╭───────────────────────────────────────────────────────────────╮${RESET}"
echo -e "${BOX_INDENT}${CYAN}│${WHITE}${BOLD}                   JURANDIR MINI — INSTALADOR                  ${CYAN}│${RESET}"
echo -e "${BOX_INDENT}${CYAN}╰───────────────────────────────────────────────────────────────╯${RESET}"
echo ""

log_step() { echo -e "${CYAN}[ ⚙ ]${RESET} ${WHITE}$1${RESET}"; }
log_succ() { echo -e "${GREEN}[ ✓ ]${RESET} ${WHITE}$1${RESET}"; }
log_err()  { echo -e "${RED}[ ✗ ]${RESET} ${WHITE}$1${RESET}"; }

log_step "Conectando ao repositório oficial..."
sleep 0.4

log_step "Baixando inicializador central (start.sh)..."
if curl -fsSL "$LATEST_URL" -o start.sh; then
  chmod +x start.sh
  log_succ "Inicializador baixado e configurado com sucesso!"
  echo ""
  log_step "Transferindo controle para a central de inicialização..."
  sleep 0.6
  
  if [ -e /dev/tty ]; then
    exec bash ./start.sh "$@" </dev/tty
  else
    exec bash ./start.sh "$@"
  fi
else
  log_err "Falha ao baixar o arquivo start.sh."
  echo -e "${YELLOW}Verifique sua conexão com a internet e tente novamente.${RESET}"
  exit 1
fi
