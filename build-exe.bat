@echo off
chcp 65001 >nul 2>&1
title CloneTracker — Сборка EXE

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js не найден!
    echo Скачай с https://nodejs.org/ и установи.
    pause
    exit /b 1
)

echo.
echo  ◉ CloneTracker — сборка в EXE
echo  ================================
echo.

if not exist node_modules (
    echo [1/3] Установка зависимостей...
    call npm install
) else (
    echo [1/3] Зависимости уже установлены
)

echo [2/3] Сборка приложения...
call npm run build
if errorlevel 1 (
    echo Ошибка сборки Vite!
    pause
    exit /b 1
)

echo [3/3] Упаковка в EXE...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win dir
if errorlevel 1 (
    echo Ошибка сборки Electron!
    pause
    exit /b 1
)

echo.
echo  ✓ Готово! CloneTracker.exe находится в release\win-unpacked\
echo.
explorer release\win-unpacked
pause
