# Unitree research notes (G1 / R1 / H2) — 2026-10-26

Output: `data/unitree-g1.json`, `data/unitree-r1.json`, `data/unitree-h2.json` (all parse with node).
Prices checked 2026-10-26 via the shop's Shopify JSON (`shop.unitree.com/products.json`) and page HTML.

## Key finding on Unitree shop prices
- On shop.unitree.com, **$100,000 is a placeholder** for "contact sales" items. B2, B2-W, A2, B1, three of the four R1-D variants and **H2 Plus** all show $100,000, and the H2 Plus page says "Please contact our sales team (sales_global@unitree.cc) to purchase". The H1 listing is titled "Contact us for the real price" ($90,000). droneth.or.th's H2 PLUS page also says "ผู้ผลิตไม่ได้ประกาศราคาสาธารณะ".
  → H2 Plus **not** used as a list price.
- The shop footer for G1 and R1 says: shipping $300–1,200, and the customer pays all customs duties, taxes and clearance. Prices on unitree.com are labelled "Tax and Shipping cost excluded".

## Unitree G1 (`unitree-g1`)
| Fact | Value | Source |
|---|---|---|
| G1 price | $13,500 (variant created 2024-06-12; product published 2024-06-05) | https://shop.unitree.com/products/unitree-g1 (and its `.json`) |
| G1 Pro price | $21,500 (variant created 2026-09-16, available) | same |
| G1 page spec | 1320×450×200 mm, folded 690×450×300, ~35 kg, DOF 23 / EDU 23–43, knee 90 / 120 N·m, arm ~2 / ~3 kg, 9000 mAh, 54V 5A, ~2 h, warranty 8 / 18 months, depth camera + 3D LiDAR, 4 mics, 5 W speaker, 8-core CPU, EDU Orin module, Dex3-1 optional, EDU "Contact sales" | https://www.unitree.com/g1/ |
| G1+ (new 2026 model) | $15K; 1340 mm; ~35 kg; DOF 25 / EDU 25–45; +2 neck DOF; shoulder/waist torque +110 %, arm +43 %; binocular + chest wide-angle camera + 3D LiDAR; 6 mics; 2×10 W speakers; 9000 mAh 13S; ~2 h; arm ~3 / ~4 kg; external power; warranty 8 / 18 months | https://www.unitree.com/G1pl/ |
| G1+ launch date and CNY price | 14 Sep 2026; ¥95,000 incl. tax (G1 ¥85,000) | https://www.humanoidsdaily.com/news/unitree-launches-g1-plus-humanoid-with-stronger-motors-and-moving-neck (also finance.sina.cn 2026-09-14) |
| G1 Pro spec (no official table) | 29 DOF, knee 120 Nm, payload up to 3 kg | RBTX (igus) https://rbtx.com/en-US/components/humanoid/unitree-g1-base |
| Speed 2 m/s | RBTX lists G1 Basic at 2 m/s; SIAMBC says 2 m/s; Neotech says ~1.5 m/s walking and ~2 m/s running | RBTX; https://siambc.com/products/unitree-g1 ; https://www.print3dd.com/product/unitree-g1-u2/ |
| Battery 421 Wh | SIAMBC: "9,000 mAh, 421 Wh" (= 46.8 V × 9 Ah) | SIAMBC |
| Sensor models | Livox MID-360 + Intel RealSense | SIAMBC |
| Thai sellers | SIAMBC: quote only. The page shows "สอบถามราคา"; the hidden Shopify variant price of 590,000 is NOT displayed, so it is not used. It says "ตัวแทนจำหน่ายอย่างเป็นทางการในประเทศไทย" and its showroom is in Thawi Watthana, Bangkok | https://siambc.com/products/unitree-g1 |
| | Systronics Co., Ltd. (MD อัศวรรณ์ เรืองชู) is named as Unitree's Thai distributor (16 Dec 2024). Its website no longer shows Unitree | https://www.bangkokbiznews.com/tech/innovation/1157976 |
| | MetaXR: ฿454,000, labelled wholesale/bulk, not a retail price, excluding shipping and tax. It also rents robots | https://mtxr.co/shop/unitree-g1/ |
| | Neotech (3DD): G1 EDU Plus U2 (29 DOF, Jetson Orin 100 TOPS), "โปรดสอบถามราคา" | https://www.print3dd.com/product/unitree-g1-u2/ |
| | droneth.or.th: ~฿473,000 (estimate). Its product pages use LINE @metaxr, so it is linked to MetaXR | droneth guide |
| EDU dealer prices (prose only, not used) | US dealers: Edu Standard $43,900 … Ultimate up to $73,900; RobotShop EU G1 EDU Plus (U2) €43,560 (VAT basis unclear) | globaldronehq.com guide; eu.robotshop.com |
| Security | UniPwn BLE root exploit (Sep 2025, Makris/Finisterre); CVE-2026-76639/76640 (Aug 2026); Alias Robotics data-exfiltration claims, disputed by Unitree | https://humanoid.guide/unitree-exhibits-g1-at-ifa-amid-unresolved-security-questions/ |
| Open source | unitree_sdk2(+python), unitree_ros2, unitree_rl_gym (Go2/G1/H1/H1-2, Isaac Gym + MuJoCo), unitree_rl_lab (Isaac Lab, G1-29dof), xr_teleoperate | https://github.com/unitreerobotics |
| Context (not in JSON) | Counterpoint: G1 series >7,000 units in H1 2026, 31 % share, #2 worldwide | https://tech.ifeng.com/c/8vjxldjhiBe |

Trims chosen: **G1 ($13,500), G1+ ($15,000, official page), G1 Pro ($21,500, shop)**. G1 EDU has no maker price, so it is described in prose only (per brief).
Doubts: G1 Pro has no official spec table. Its specs come from RBTX (a reseller), and its hand, runtime, battery and compute are left null. G1+ is marketed as a separate model page but folded in as a trim of the G1 family. `launched` = 2024-06 (shop listing). The G1 was announced in May 2024 at ¥99,000.

## Unitree R1 (`unitree-r1`)
| Fact | Value | Source |
|---|---|---|
| Prices | R1 Air $4,900, R1 $5,900, R1 EDU $10,500 (shop variants; EDU variant created 2026-04-27; unitree.com says EDU "Contact Sales") | https://shop.unitree.com/products/unitree-r1 ; https://www.unitree.com/R1/ |
| Spec | 1230×357×190 mm; ~27 / 29 / 29 kg; DOF 20 / 26 / 26–40; arm 4 / 5 / 5; waist 2; head 2; mono / bino / bino camera; 4 mics; 8-core CPU; EDU Orin 40–100 TOPS; arm ~2 kg; ~1 h; warranty 6 / 8 / 12 months; multimodal LLM; stickers | https://www.unitree.com/R1/ |
| Battery | 33.12 V, 6000 mAh, 199 Wh, $500 | https://shop.unitree.com/products/r1-battery |
| Speakers 3 W×2 | SIAMBC (also Unitree's parameter graphic on TechShare) | SIAMBC |
| Launch | 25 Jul 2025 at ¥39,900 | zh.wikipedia 宇树科技 |
| JD flagship listing of R1 | before 29 Dec 2025; shop listing 2025-12-05 → `launched` 2025-12 | jiemian 13825705; shop JSON |
| Price cut | ¥39,900 → ¥29,900, immediate delivery (Jun 2026) | https://www.ehangzhou.gov.cn/2026-06/26/c_298239.htm |
| R1-D | Dual-arm upper-body series R1-A5/A7/A5-D/A7-D, from ¥26,900 (30 Apr 2026); shop R1-A5 $4,290, other variants $100,000 placeholder. Not a biped → excluded as a trim, described in prose | https://shop.unitree.com/products/unitree-r1-d ; zh.wikipedia |
| Thai | SIAMBC quote-only for all 3 variants (hidden variant price of 390,000 not displayed); Neotech R1 EDU "โปรดสอบถามราคา"; droneth estimate ~฿207,000 | siambc.com/products/unitree-r1 ; print3dd.com/product/unitree-r1-edu/ ; droneth guide |

### R1 image — NOT confirmed → `"image": null`
- File:Japan-Mobility-Show-2025-RuinDig_0538.jpg (CC BY 4.0, RuinDig/Yuki Uchida). I downloaded the original and cropped it. The front robot hanging in the gantry has a G1-style torso and limbs with a black helmet head, a visor and a neck. It matches the **G1+ head design** (unitree.com/G1pl images) and does **not** match the R1. The R1 launch design (TechShare/Unitree graphics, July 2025) is white/navy with red accents, a helmet and "sunglasses" visor. The robot behind it is a regular G1. Conclusion: not an R1, probably a G1+ prototype shown in Oct 2025.
- RuinDig 0530–0572 checked: only stage shots of the G1, the VISIONOID FOX and a Go2.
- Commons full-text search "Unitree R1", "宇树 R1": nothing. Category:Unitree, Category:Unitree G1, the WAIC 2025 set (49 photos by Xuthoria) and the Kyiv Car Fest photo (a red/silver humanoid, unidentified) were also checked.
- CNS video "2025-12-05 探访济南机器人6S中心" at 98–104 s shows a silver/red helmeted robot dancing. It might be an R1 variant, but it is unconfirmed, small in frame and covered by large subtitles → rejected.

## Unitree H2 (`unitree-h2`)
| Fact | Value | Source |
|---|---|---|
| Price | H2 $29,900 (shop product created/published 2026-01-30, variant currently not available to cart); H2 EDU "Contact Sales" | https://shop.unitree.com/products/unitree-h2 ; https://www.unitree.com/H2/ |
| Spec | 1820×456×218 mm; ~70 kg; 31 DOF (leg 6, arm 7, waist 3, head 2); bionic face; arm peak torque 120 N·m, leg 360 N·m; arm payload peak ~15 kg / rated ~7 kg; 15 Ah 0.972 kWh, max 75.6 V; PC1 i5 (EDU adds PC2 i7); Thor module optional; binocular wide-FOV camera; ~3 h; warranty 8 / 12 months | https://www.unitree.com/H2/ |
| H2 Plus | Jetson T5000 (2,070 FP4 TFLOPS, 128 GB), SharpaWave hands with 22 active DOF each, 75 total DOF, wrist cameras, IMU, remote E-stop, Isaac GR00T/Sim/Lab/TeleOp/ROS, 12-month warranty | https://www.unitree.com/H2plus/ |
| H2 Plus price | shop shows $100,000 placeholder + "contact sales"; droneth: no public price | shop; https://droneth.or.th/product/unitree-h2-plus-humanoid-robot/ |
| H2 launch | 20 Oct 2025, 180 cm, 70 kg, dance/kung-fu demo | jiemian 13825705 |
| H2 Plus launch | 1 Jun 2026, with NVIDIA at GTC Taipei | zh.wikipedia 宇树科技 |
| Thai | No Thai seller lists the standard H2. MetaXR/droneth quote H2 PLUS (LINE @metaxr). SIAMBC has no H2 → `availability: import` | droneth; siambc products.json |

Not published (null): speed, charge time, certifications.

### H2 / H1 image hunt — none found → `"image": null`
- Commons search "Unitree H2" returns 0 hits. "Unitree" returns about 69 hits in total (G1, Go1/Go2, HQ, buildings, JMS 2025, WPAC 2026 portraits of Wang Xingxing and Yao Ming): none show an H1 or H2.
- Categories checked: Unitree, Unitree G1, Unitree at the Japan Mobility Show 2025, the Warsaw meeting, Humanoid robots, Bipedal walking robots, Dancing robots.
- Videos from China News Service (2,319 files) were filtered for 机器人/具身. I downloaded the 480p transcodes and checked frame grids every 2 s for: 链博会 (Unitree booth, G1 only), 北京亦庄 4S店 (dark G1, a partial black robot in a jersey), 武汉 7S店, 济南 6S, 智能车挑战赛 and 杭州 HJ985. No sharp H1, H1-2 or H2.
- WAIC 2025 photos by Xuthoria (49): G1s at the Lenovo and Tencent booths, no H-series. The user's other uploads have no robots.
- No H1-2 image either, so the H2 was kept (not switched to `unitree-h1`).

## Image chosen
- G1: https://commons.wikimedia.org/wiki/File:Unitree_G1.jpg (CC0, Sayanesy, "Unitree G1 at UAV Expo 2024", 1380×2326). I downloaded the 1280 px thumbnail and viewed it: it is a G1 (glowing ring face, UNITREE chest) and nearly full-body. The original URL returns 200. Focus "50% 30%".
- Alternative noted: "WAIC 2025 - Robots 03.jpg" (CC BY-SA 4.0, Xuthoria) is a sharp full-body G1, but it carries Lenovo branding, so I did not use it.
- 2026-10-26 (integrator): เปลี่ยนภาพ G1 เป็น File:Child_with_Robot_02.jpg (CC BY 4.0, Tonynirappathu, ก.ย. 2568) เพราะภาพเดิม (Unitree_G1.jpg) เบลอและพื้นหลังรก — ดูภาพแล้ว เป็น G1 เต็มตัว คมชัด
