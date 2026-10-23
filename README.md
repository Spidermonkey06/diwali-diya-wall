# 🪔 Virtual Diya Wall

Everyone opens ONE link from their own home/Wi-Fi, types their name and adds a diya.
All names show on everyone's wall, live. Anyone can press "Light all diyas together"
-> 5-4-3-2-1 on every screen -> all diyas ignite at once. "Clear all" resets.

## A) Put it online with Render (free, works from any Wi-Fi, your PC can be off)
1. Upload this folder to GitHub (VS Code terminal inside the folder):
     git init
     git add .
     git commit -m "diya wall"
     git branch -M main
     git remote add origin https://github.com/YOUR-NAME/diwali-diya-wall.git
     git push -u origin main
   (create the empty repo "diwali-diya-wall" on github.com first)
2. Go to render.com -> sign in with GitHub -> New + -> Web Service -> pick the repo.
   Runtime: Node | Build Command: npm install | Start Command: npm start | Instance Type: Free -> Create.
3. After ~2 minutes you get a link like  https://diwali-diya-wall.onrender.com  -> share it with everyone.
Notes:
- Free Render sleeps after ~15 min without visitors and takes ~50 sec to wake. Open the link yourself
  a few minutes before the event. (Optional: uptimerobot.com can ping it every 5 min to keep it awake.)
- Names are kept in memory; if Render restarts, the wall is empty again (just add names again).

## B) Quick way without deploying (your PC must stay on)
1. npm start
2. VS Code -> PORTS tab -> Forward a Port -> 3000 -> right-click -> Port Visibility -> Public
3. Share the https link it gives you.
   (Or: npx cloudflared tunnel --url http://localhost:3000  -> share the trycloudflare.com link)

## Run on your own PC / same Wi-Fi only
npm start  (or double-click start-windows.bat) -> the terminal prints "SHARE WITH ALL : http://192.168.x.x:3000"

## Change text
Edit `public/config.js`, save, refresh.
