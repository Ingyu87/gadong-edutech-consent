@echo off
chcp 65001 >nul
cd /d C:\Users\ingyu

echo [1/4] Staging edutech-consent changes...
git add "Desktop\개인정보\edutech-consent\.gitignore"
git add "Desktop\개인정보\edutech-consent\README.md"
git add "Desktop\개인정보\edutech-consent\app\admin\page.tsx"
git add "Desktop\개인정보\edutech-consent\app\globals.css"
git add "Desktop\개인정보\edutech-consent\app\parent\consent\page.tsx"
git add "Desktop\개인정보\edutech-consent\app\parent\login\ParentLoginInner.tsx"
git add "Desktop\개인정보\edutech-consent\app\teacher\page.tsx"
git add "Desktop\개인정보\edutech-consent\lib\types.ts"
git add "Desktop\개인정보\edutech-consent\package-lock.json"
git add "Desktop\개인정보\edutech-consent\package.json"

echo [2/4] Status (ensure no .env):
git status --short

echo.
echo [3/4] Commit...
git commit -m "feat: 수집이용/제3자제공 동의 반영, CSV 양식 적용, AI요약 제거, API키 푸시 방지"

echo [4/4] Push to origin main...
git push origin main

echo.
echo Done.
