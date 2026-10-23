@echo off
chcp 65001 >nul
title Salles Prospector — Protocolo V.L.A.E.G.
echo ========================================================
echo   🚀 Iniciando Salles Prospector (Apify + Meta Ads + DataCrazy)
echo ========================================================
cd /d "%~dp0"
start "" "http://localhost:3099"
node "tools\server.mjs"
pause
