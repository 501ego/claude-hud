@echo off
rem Pet the claude-hud pet: refreshes the touch file's mtime so the next
rem statusline render shows the kawaii reaction for a few seconds.
set "petdir=%USERPROFILE%\.claude\plugins\claude-hud"
if defined CLAUDE_CONFIG_DIR set "petdir=%CLAUDE_CONFIG_DIR%\plugins\claude-hud"
if not exist "%petdir%" mkdir "%petdir%"
type nul > "%petdir%\pet-touch"
echo purr~
