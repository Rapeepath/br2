# Booster / EngineAI / Noetix — research notes (2026-10-26)

Result: **1 robot written** — `data/engineai-t800.json`. Booster (K1/T1) and Noetix (Bumi/N2) were **skipped: no freely
licensed Commons image of the on-sale model could be found** (details below). Fallbacks (UBTech Tiangong Walker,
Dobot Atom, Kepler K2) also have no Commons image.

---

## 1. EngineAI T800 (`engineai-t800.json`) — WRITTEN

### Image (verified by viewing)
- File: https://commons.wikimedia.org/wiki/File:%E4%BC%97%E6%93%8ET800%E5%85%A8%E5%B0%BA%E5%AF%B8%E6%9E%81%E8%87%B4%E9%AB%98%E6%95%88%E8%83%BD%E9%80%9A%E7%94%A8%E4%BA%BA%E5%BD%A2%E6%9C%BA%E5%99%A8%E4%BA%BA%E6%AD%A3%E5%BC%8F%E5%8F%91%E5%B8%83.webm
- 中国新闻社 (China News Service), **CC BY 3.0**, 1920×1080, 78.5 s, uploaded from CNS YouTube (description dated 12月2日 [2025]).
- Downloaded the whole video, built 1-second contact sheets, then fetched the real Commons thumbnail
  `…/thumb/b/bc/<file>.webm/1280px-seek%3D19-<file>.webm.jpg` → HTTP 200, image/jpeg, and viewed it:
  gold T800 head + torso, front view, "ENGINEAI" on the helmet and "T800" lettering on the chest, sharp, well lit,
  no caption (only the small 中新视频 logo top-left). **seek = 19**, focus "50% 30%".
- Rejected: seek 0–8 (backlit + caption), 16–17/20–22 (captions), 45–66 (full-body gym shots, robot small or motion-blurred, sparring partner).
- Note: Commons thumbnails must use standard widths (500/960/1280…); 640px returns 400 "Use thumbnail size".
- Alternative CC BY 4.0 CNS video `File:2025-3-17 Engine AI plays Axe Gang Dance.webm` shows the silver SE01 (and an EngineAI showroom
  lineup) — not used: SE01/PM01 have no current published price either.

### Facts and sources
| Fact | Source |
|---|---|
| Height 173 cm; weight 75–85 kg by edition; DOF Basic 25 / Open Source(开发版) 25 / Pro 29+14=43 / Max 32+14=46; 7 DOF per hand (Pro/Max); max joint torque 450 N·m; speed ≥2 m/s (hardware); battery life 3–5 h; quick-release smart battery; Basic: 8-core CPU + Orin NX 16G, Intel wide-FOV binocular camera, no LiDAR, no secondary development; Open Source/Pro/Max: AGX Orin 64G ("Upgradable to Thor upon Request" on EN page), ultra-wide binocular camera, 3D LiDAR (Pro/Max; EN page also ticks it for Open Source, CN page does not), Max adds 5G; aviation aluminium + titanium; super air cooling; hand payload 5 kg with tactile sensing; warranty "see Product Warranty Manual"; safety note "keep safe distance – high-power drive" | https://en.engineai.com.cn/product-t800 (live, fetched 2026-10-26) and https://www.engineai.com.cn/product-t800 (CN live: base compute RK3588S) |
| **USD list prices**: Basic 40,500 / Open Source 54,000 / Pro 63,000 ("Champagne Gold, limited to 50 units at ¥260,000") / Max 80,800; battery: ternary lithium 71.4 V 20 Ah (=1,428 Wh) charge 2.5 h, optional solid-state 74.8 V 40 Ah charge 3 h; joint encoder absolute dual | https://web.archive.org/web/20260915114019/https://en.engineai.com.cn/product-t800 |
| **CNY list prices**: 基础版 18万 / 开发版 24万 / Pro版 28万 / Max版 36万 | https://web.archive.org/web/20260826175656/https://www.engineai.com.cn/product-t800 |
| Prices removed: CN page archived 2026-09-22 and 2026-10-09 has no 价格 row; EN page archived 2026-10-08 and live page have no "Price（USD）" row; "Buy Now" now links to a JD.com search | Wayback CDX + direct fetch (this session); corroborated by https://theresarobotforthat.com/blog/engineai-t800-price/ (EN prices present until 2026-09-21, gone by 2026-09-30) |
| Launch 2 Dec 2025; 1.73 m, 75 kg; 4–5 h solid-state battery; "可适配工业协作、服务、奔跑、格斗等多元场景"; 定价18万元起 | CNS video description (Commons file page above) |
| Official launch article: 18万元起, four editions 基础版/生态版(开源版)/锐化版(Pro)/旗舰版(Max), 450 N·m peak torque, 14,000 W peak power, magnesium-aluminium alloy, 360° LiDAR, sales process started immediately | https://www.engineai.com.cn/about-news-media/41.html |
| EngineAI founded Oct 2023, HQ Shenzhen; T800 from RMB 180,000, 4 models | https://hk.finance.yahoo.com/news/%E7%9C%BE%E6%93%8E%E7%99%BC%E5%B8%83%E4%BA%BA%E5%9E%8B%E6%A9%9F%E5%99%A8%E4%BA%BAt800%E6%A0%BC%E9%AC%A5%E5%AF%A6%E6%8B%8D%E5%BD%B1%E7%89%87-%E5%94%AE18%E8%90%AC%E4%BA%BA%E6%B0%91%E5%B9%A3%E8%B5%B7-043422259.html (Infocast 匯港資訊 via Yahoo財經, 4 Dec 2025) |
| CEO took a kick from T800 to rebut CGI claims (article 7 Dec 2025) | https://www.humanoidsdaily.com/news/engineai-ceo-takes-a-kick-from-t800-robot-to-settle-cgi-debates |
| Shenzhen 紅花嶺 smart manufacturing base, ~12,000 m², one robot every 15 min, 79 quality checks + 46 condition tests, first T800 batch off the line and full deliveries began (PR dated 29 May 2026, published 1 Jun 2026) | https://kyodonewsprwire.jp/release/202605300060 |
| Thai coverage (24 Dec 2025): 1.73 m, 75 kg, 43 DOF, 450 N·m, solid-state battery, mass delivery mid-2026; no Thai availability | https://techsauce.co/news/engineai-t800-humanoid-robot-mass-production-kung-fu |
| A1+ / A2 funding closed (Jan 2026); Pre-A++ + A1 cumulative ¥1 bn (not used in JSON) | https://www.engineai.com.cn/about-news-media/42.html |
| No official Thai distributor for EngineAI | market.md §4 (line 70); no Thai reseller found in Google search this session |

### Judgement calls
- `listPrice` uses the **USD international list** (what an importer in Thailand would be quoted) from the archived official
  EN page, because EngineAI removed all prices from both sites in late Sept 2026; CNY domestic list and the removal are stated in `priceNote`.
- `runtimeH` = 5 (maker: 3–5 h); `speedMs` = 2 (maker: ≥2 m/s; the Sept archive said ≥3 m/s, live page says ≥2).
- `batteryWh` = 1,428 from the archived spec (standard ternary pack); the live page no longer lists capacity.
- `category` = research: no verified industrial deployments; Basic is a show unit, the other three are development platforms.
- `safety.features` left empty: the maker publishes warnings, not safety features or certifications.

---

## 2. Booster Robotics — SKIPPED (no image of an on-sale model)

- Current line-up on https://www.booster.tech/ : **K1** ("Introductory Embodied Development Platform") and **T2** only; T1 no longer listed.
- T1 is discontinued: RobotShop "The T1 model has been discontinued in preparation for the upcoming T2 model launch"
  (https://ca.robotshop.com/products/booster-t1-humanoid-robot-standard); Generation Robots sells only a used demo unit (€31,200 incl. VAT)
  (https://www.generationrobots.com/en/404278-booster-t1-humanoid-robot.html).
- K1 launched 21/24 Oct 2025, first 100 units ¥29,900 (IT之家 / 新京报 / Baidu Baike via Google results); specs from
  https://www.booster.tech/booster-k1?target=en : ~95 cm, ~19.5 kg, 22 DOF, 60 N·m, 2 m/s, Geek 2 Ah/20 min/48 TOPS/3-month warranty,
  Education 5 Ah/70 min/117 TOPS/1 yr, Professional 5 Ah/70 min/200 TOPS/1 yr. Booster store page is a contact form (no prices).
  RoboCup program: K1 RoboCup edition MSRP $14,999, discounted $9,999, 5-pack $47,490, 3-yr warranty, AGX Orin 32GB +$2,000
  (https://robotprogram.robocup.org/). 36Kr Japan (7 Dec 2025): >1,000 pre-orders, >700 shipped (https://36kr.jp/447223/).
- Commons: the only Booster footage is CNS videos from **July–Aug 2025** (before K1 existed) showing the **T1**:
  `直击人形机器人足球赛 中国战队即将征战巴西RoboCup.webm` (T1 with BOOSTER ROBOTICS banner, best frame ≈ seek 138),
  `2025 ChinaJoy上海启幕 AI技术赋能游戏新场景.webm` (T1 in jerseys), `全球首个人形机器人足球赛专业场馆“熊猫眼”赛训基地有何奥秘？.webm` (T1, renders).
  Searched Commons for Booster/K1/加速进化/RoboCup 2026/机器人足球/太空步 etc. and browsed Category:Videos from China News Service
  (2,320 files) — no K1.

## 3. Noetix Robotics (松延动力) — SKIPPED (no image)

- Bumi ¥9,998 (launched Oct 2025, SCMP "family-friendly US$1,400 humanoid"); N2 ~¥39,900.
- Commons searches: Noetix, 松延, 松延动力, 小布米, 布米 机器人, N2 humanoid, 半程马拉松/马拉松 机器人, 机器人运动会 — nothing.
  Checked CNS robot-store videos (Beijing 4S store Aug 2025, Jinan 6S centre Dec 2025, Wuhan 7S store Nov 2025, CISCE Jul 2025): no Bumi/N2 identified.

## 4. Fallbacks — no Commons image
UBTech Tiangong Walker (天工/天工行者/Walker S/UBTECH humanoid), Dobot Atom (越疆 人形/Dobot humanoid), Kepler K2 (开普勒 人形) — searched, nothing usable.

## Tooling notes
- WebSearch budget was exhausted early in the session; Google via the Chrome extension and WebFetch were used instead.
- upload.wikimedia.org rate-limits heavily (429, retry-after up to 600 s); download sequentially with backoff.
