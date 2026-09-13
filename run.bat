@echo off
echo ========================================================
echo  Home Healthcare Management System - Starting Server
echo ========================================================
python app.py
if errorlevel 1 (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" app.py
)
pause
