// 真实时间冒烟测试：跑 10 秒，读取游戏状态
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-gl=angle", "--use-angle=swiftshader",
      "--no-first-run", "--disable-gpu"
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", e => console.log("PAGE-ERROR:", e.message));
  page.on("console", m => { if (m.type() === "error") console.log("CONSOLE-ERROR:", m.text()); });

  await page.goto("file:///C:/Users/admin/WorkBuddy/%E5%90%83%E9%87%91%E5%B8%81%E6%B8%B8%E6%88%8F/index.html?auto=1");

  const snap = () => page.evaluate(() => ({
    score: S.score, coins: S.coins, dist: +S.dist.toFixed(1),
    hp: S.hp + "/" + S.hpMax, speed: +S.speed.toFixed(1),
    running: S.running, energy: Math.round(S.energy),
    obstaclesOnRoad: obstacles.filter(o => o.userData.alive).length,
    coinsOnRoad: coinList.filter(c => c.userData.alive).length,
    frames: window.__frames || 0
  }));

  await page.waitForTimeout(2000);
  console.log("T+2s  :", JSON.stringify(await snap()));

  // 记录帧计数，确认渲染循环在跑
  await page.evaluate(() => {
    window.__frames = 0;
    const orig = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => orig(t => { window.__frames++; cb(t); });
  });
  await page.waitForTimeout(10000);
  console.log("T+12s :", JSON.stringify(await snap()));

  // 阶段2：自动贴到最近金币的车道上，验证吃金币
  await page.evaluate(() => {
    setInterval(() => {
      let best = null;
      for (const c of coinList) {
        if (c.userData.alive && c.position.z < 0 && c.position.z > -40) {
          if (!best || c.position.z > best.position.z) best = c;
        }
      }
      if (best) S.x = best.position.x;
    }, 100);
  });
  await page.waitForTimeout(5000);
  console.log("吃金币后:", JSON.stringify(await snap()));

  // 阶段3：按住 Shift 冲刺，贴到最近路障上，验证撞碎不扣血
  await page.keyboard.down("ShiftLeft");
  await page.evaluate(() => {
    setInterval(() => {
      let best = null;
      for (const o of obstacles) {
        if (o.userData.alive && o.position.z < 0 && o.position.z > -30) {
          if (!best || o.position.z > best.position.z) best = o;
        }
      }
      if (best) S.x = best.position.x;
    }, 50);
  });
  await page.waitForTimeout(6000);
  await page.keyboard.up("ShiftLeft");
  console.log("撞路障后:", JSON.stringify(await snap()));

  await browser.close();
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
