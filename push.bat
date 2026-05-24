@echo off
REM Push the current branch to GitHub
cd /d "c:\Users\Lenovo\Downloads\dash.worktrees\agents-project-polish-and-enhancements"

echo ========================================
echo Checking git status...
echo ========================================
git status --short

echo.
echo ========================================
echo Pushing to GitHub...
echo ========================================
git push -u origin agents/project-polish-and-enhancements

echo.
echo ========================================
echo Push complete!
echo ========================================
git log --oneline -3
