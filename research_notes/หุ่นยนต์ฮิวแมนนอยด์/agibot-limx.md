# บันทึกการค้นคว้า: AGIBOT X2, AGIBOT A2, LimX Luna, Galbot G1

ค้นคว้าเมื่อ 26 ตุลาคม 2569 ผลลัพธ์: `data/agibot-x2.json`, `data/agibot-a2.json`, `data/limx-luna.json`, `data/galbot-g1.json`
หลักการ: ตัวเลขทุกตัวมาจากแหล่งที่ระบุ ตัวเลขที่ผู้ผลิตไม่เปิดเผยใส่ `null`

---

## 1. AGIBOT X2 (灵犀 X2) — `agibot-x2`

### ราคาและรุ่น
| รุ่น | ราคา | แหล่ง |
|---|---|---|
| X2 Neo | 25,600 USD (ร้านค้าออนไลน์ AGIBOT) | https://store.agibot.com/collections/all ; https://store.agibot.com/products/x2 |
| X2 Ultra (New Version) | "Price on request" บนร้าน AGIBOT | https://store.agibot.com/products/x2-ultra |
| X2 Ultra ในไทย | **1,799,000 บาท** ("รุ่นรองลงมาอย่าง X2 Ultra เปิดราคาที่ 1,799,000 บาท") ประกาศโดย VST ECS ในงานเปิดตัว 25–26 มิ.ย. 2569 ไม่ระบุว่ารวม VAT | ผู้จัดการออนไลน์ https://mgronline.com/cyberbiz/detail/9690000061175 |
| X2 Basic 25 DOF (RBTX/igus) | 986,250 บาท "ไม่รวม ภาษีมูลค่าเพิ่ม ค่าจัดส่งคำนวณจากใบเสนอราคา" จัดส่ง 3 สัปดาห์ | https://th.rbtx.shop/th-TH/components/humanoid/agibot-x2-basic-humanoid-robot |
| X2 Ultra 30 DOF (RBTX) | 2,032,800 บาท (หน้ารวมสินค้า) | https://th.rbtx.shop/th-TH/components/humanoid |
| X2 Ultra (RobotShop) | 55,433 USD | https://www.robotshop.com/products/agibot-x2-ultra-humanoid-robot |
| OmniHand 3 | เริ่มต้น 5,360 USD | https://store.agibot.com/collections/all |

- ตรวจสอบหน้าเว็บของ VST ECS เอง (ข่าวองค์กร และบทความ "AGIBOT หุ่นยนต์อัจฉริยะ 4 รุ่น") — **ไม่มีราคาบาท** มีเพียงชื่อรุ่น X2 Ultra, A2 Ultra, D1 Edu, C5 (https://www.vstecs.co.th/en/index.php/about-vst-ecs/corporate-news/850-corporate-news-agibot-launch-thailand.html ; https://www.vstecs.co.th/th/index.php/knowledge-online/agibot-four-robot-models-are-elevating-businesses-with-ai.html) ราคาบาทจึงอ้างจาก MGR ซึ่งรายงานราคาที่ประกาศในงานเปิดตัว (ผู้พูด: นายสมศักดิ์ เพ็ชรทวีพรเดช CEO VST ECS และ Abel Deng AGIBOT) → ใช้เป็น `priceTHB` (ราคาผู้จำหน่ายในไทย) และระบุใน priceNote ว่าไม่ระบุ VAT
- กรุงเทพธุรกิจรายงานต่างออกไปว่า "ฮิวแมนนอยด์เริ่มราว 3 ล้านบาท" และสี่ขาราว 900,000 บาท (https://www.bangkokbiznews.com/tech/ai/1240305) — ไม่ใช้ เพราะ MGR ระบุตัวเลขรายรุ่นชัดเจน
- RBTX: ผู้จัดทำเว็บไซต์ (imprint) คือ igus SE & Co. KG ประเทศเยอรมนี (https://th.rbtx.shop/th-TH/imprint) ไม่ใช่บริษัทไทยโดยชัดเจน และราคาไม่รวม VAT → ไม่ใส่เป็น trim กล่าวถึงใน priceNote เท่านั้น

### สเปก
- ร้าน AGIBOT (X2 Neo): สูง ~1.31 ม., กว้าง 460 มม., ลึก 210 มม., หนัก ~35 กก., 30 DOF (คอ 1, แขน 7×2, เอว 3, ขา 6×2), แบต ~500 Wh, ใช้งาน ~2 ชม. ที่ 0.5 ม./วิ, ชาร์จ ≤1.5 ชม., RK3588 ×2, ไม่มี LiDAR/RGB-D, ไม่รองรับ secondary development, ไม่มีการนำทางอัตโนมัติ, payload สูงสุด 3 กก. (ท่าเฉพาะ) ≤1 กก. ทั้งช่วง, อุณหภูมิ -10 ถึง 40 °C, ของในกล่อง: ตัวหุ่น ชาร์จเจอร์ รีโมต ไมโครโฟน คู่มือ ใบรับรองความสอดคล้อง — https://store.agibot.com/products/x2
- ร้าน AGIBOT (X2 Ultra New Version): 31 DOF (คอ 2), ~39 กก., ~500 Wh, RK3588 ×2 + Orin NX (157 TOPS), กล้อง RGB โต้ตอบ/RGB คู่หน้า/RGB หลัง/RGB-D, LiDAR 3D — https://store.agibot.com/products/x2-ultra
- หน้าผลิตภัณฑ์ทางการ: X2 ≈35 กก. 25 DOF, X2 Ultra ≈39 กก. 30 DOF, ~500 Wh, ความเร็วสูงสุด 1.8 ม./วิ (ปกติ ≤0.8), OmniHand/OmniPicker ใช้ได้เฉพาะ Ultra (ซื้อแยก), นำทางอัตโนมัติ/หลบสิ่งกีดขวางเฉพาะ Ultra — https://www.agibot.com/products/X2
- เอกสารนักพัฒนา AimDK: แรงบิดสูงสุด 120 N·m, 1.8 ม./วิ, ~421 Wh (ต่างจากหน้าเว็บที่ระบุ ~500 Wh → ใช้ 500 ตามหน้าผลิตภัณฑ์และร้านค้า), ROS 2 + AimDK Python/C++ — https://x2-aimdk.agibot.com/en/latest/about_agibot_X2/robot_specifications.html ; https://x2-aimdk.agibot.com/en/latest/about_agibot_X2/part_name.html
- ร้านค้าระบุความเร็ว "Up to 2 m/s" แต่หน้าผลิตภัณฑ์และเอกสารระบุ 1.8 → ใช้ 1.8 และเขียนไว้ใน considerations
- `dof` X2 Neo = 30 ตามร้านค้า (ที่มาของราคา); X2 Ultra = 30 ตามหน้าผลิตภัณฑ์ (รุ่นใหม่ 31 → ใน considerations)

### ประวัติ/ตลาด
- เปิดตัว 11 มี.ค. 2568 เริ่มขายอย่างเป็นทางการ 22 พ.ค. 2568 3 รุ่น (交互版/Pro/Ultra) ราคา 十几万元至三四十万元 — https://finance.sina.cn/2025-05-22/detail-inexmnmc1784363.d.html → `launched: 2025-05`
- Omdia: AGIBOT ส่งมอบ >5,100 ตัวในปี 2568 ส่วนแบ่ง 39% อันดับ 1 (8 ม.ค. 2569) — https://www.prnewswire.com/news-releases/omdia-ranks-agibot-no1-worldwide-in-humanoid-robot-shipments-in-2025-302656788.html
- ผลิตครบ 10,000 ตัว 30 มี.ค. 2569 — https://kyodonewsprwire.jp/release/202603306613
- ก่อตั้ง ก.พ. 2566 โดย Deng Taihua และ Peng Zhihui (อดีต Huawei) — https://en.wikipedia.org/wiki/AgiBot
- Brand Buffet (25 มิ.ย. 2569): X2 สูง 131 ซม. หนัก 39 กก. รุ่นขายดีที่สุด เต้นและช่วยงานในซูเปอร์มาร์เก็ตได้ รับประกัน X2 "18 เดือน" A2 "1 ปี" VST ECS ส่งทีมบริการในไทย ช่องทาง B2B/B2C เช่าอีเวนต์ — https://www.brandbuffet.in.th/2026/06/agibot-partner-with-vst-ecs-bring-humanoid-robots-to-find-jobs-in-thailand/
- APC 2026 Thailand 25 มิ.ย. 2569 กรุงเทพฯ, เปิดตัว AgiRaaS (เช่า) — https://www.utusan.com.my/pr-newswire-en/2026/06/agibot-brings-apc-2026-to-thailand-building-a-professional-partner-ecosystem-to-accelerate-local-deployment-of-embodied-ai/
- MGR: รูปแบบซื้อขาด เช่าระยะสั้นสำหรับอีเวนต์ และสมาชิกรายปี
- GULF: ความร่วมมือ/บริษัทร่วมทุน 17 มี.ค. 2569 หุ่นยนต์ต้อนรับในค้าปลีกและสาขาการเงิน ตรวจโรงไฟฟ้า — https://www.agibot.com/article/231/detail/51.html
- นายกฯ อนุทิน เยือน AGIBOT เซี่ยงไฮ้ 17 ก.ค. 2569 "หุ่นยนต์ AGIBOT X2 สาธิตศิลปะการต่อสู้มวยไทย" — https://www.thaigov.go.th/th/news/166545
- PostToday (Facebook) มีคลิปหุ่นยนต์ทำท่ามวยไทยในงานเปิดตัว VST ECS × AGIBOT ที่กรุงเทพฯ (ไม่ได้ระบุรุ่นในผลค้นหา → ไม่ใส่ใน JSON)
- SKY ICT × AGIBOT แผนนำร่องหุ่นยนต์ต้อนรับในสนามบิน (26 ต.ค. 2569, ไม่ระบุรุ่น/สนามบิน) — https://www.bangkokbiznews.com/tech/ai/1257222 → ไม่ใส่ใน JSON
- ร้านไทยอื่นที่โฆษณา X2: บริษัท อาร์3โซล่าเซลล์ จำกัด (r3solarcell.co.th/product/agibot-x2/) "ราคาพิเศษ ก่อน vat" ไม่แสดงตัวเลข → ไม่ใช้

### รูปภาพ
- https://commons.wikimedia.org/wiki/File:AGIBOT-X2-_by_JxFile_MWC26.jpg — CC BY 4.0, JJxFile, MWC 2026 บาร์เซโลนา ดูภาพแล้ว: X2 เต็มตัวหน้าป้าย "AGIBOT X2" (หน้าอกมีโลโก้ Minth Group) focus "50% 40%" ทดสอบ thumb 1280/960 = 200

---

## 2. AGIBOT A2 (远征 A2) — `agibot-a2`

### ราคาและรุ่น
- A2 Lite 44,560 USD; ค่าขนส่ง 500–3,000 USD; ผู้ซื้อชำระอากร/ภาษีเอง; รับประกัน 1 ปีหรือ 3,000 ชม. — https://store.agibot.com/products/a2-lite
- A2 Ultra "Price on request" บนร้าน AGIBOT — https://store.agibot.com/collections/all
- **A2 Ultra ในไทย 3,118,000 บาท** ("หุ่นยนต์รุ่นเรือธง AGIBOT A2 Ultra ... ถูกเคาะที่ 3,118,000 บาท") — MGR (ลิงก์ข้างต้น) ไม่ระบุ VAT
- RobotShop A2 Ultra 112,061 USD — https://www.robotshop.com/products/agibot-a2-ultra-humanoid-robot
- RBTX TH: "Agibot A2-Series" ราคา "ตามคำร้องขอ"
- droneth ประมาณการ 3.5–6.6 ล้านบาท = ประมาณการ ไม่ใช้

### สเปก
- A2 Lite (ร้านค้า): 169 ซม., ~63 กก., DOF แขน 5×2 ขา 6×2 หัว 1 (= 23), แรงบิดสูงสุด 270 N·m, เดิน 0.5–0.8 ม./วิ, แขนรับน้ำหนัก 1.5 กก./ข้าง, แบต 14.4 Ah ยืน ~4 ชม. 35 นาที เดิน 1.5 ชม. ชาร์จ 2 ชม. ≤500 W ที่ 48 V DC, hot-swap, CPU 14 คอร์ ไม่มี Jetson, ไม่มีเซนเซอร์รับรู้/เสียง, ลำโพง 5 W, WiFi, ของในกล่องมี wireless emergency stop
- A2 Ultra (เอกสาร AimDK): 169 ซม. ≈69 กก., แบต 14.4 Ah ชาร์จ 2 ชม., ยืน+พูด ~3 ชม. เดิน ~1.5 ชม., Jetson AGX Orin 64GB, กล้อง RGB-D หัว (0.3–10 ม.), RGB อก, RGB-D เอว (0.15–5 ม.), fisheye 2 ตัว, LiDAR 0.2–40 ม. @10% / 70 ม. @80%, ลำโพง 5 W ×2, แขนรับ 2 กก. (มีมือ), ข้ามสิ่งกีดขวาง 20 มม., Arm Collision Sensing — https://open-sg.agibot.com/docs/en/aimdk/a2/v1_3/dev_guide/01-a2_overview
- หน้าผลิตภัณฑ์: เดินสูงสุด 1.2 ม./วิ, ขึ้นทางลาด 10°, hot-swap + fast charge, ใช้งานจริง >1,000 ตัว, ทดสอบเดิน 5,100 ชม., ตรวจ 92 รายการ — https://www.agibot.com/products/a2
- RobotShop: 40 DOF รวมมือ 6 DOF ×2, แรงบิดเข่า 270 N·m, ลาดชัน 8%, ทางเดิน >2 ม. (ตัวเลข DOF รวมไม่มีในเอกสารผู้ผลิต: 7×2 แขน + 6×2 ขา + 2 หัว + 6×2 มือ = 40 สอดคล้อง)
- ไม่มีค่าโวลต์ของแบตเตอรี่ → batteryWh null
- Brand Buffet: A2 169 ซม. 69 กก. 20 ภาษารวมไทย รับประกัน 1 ปี; กรุงเทพธุรกิจ: ซ่อมบำรุงในไทย วิศวกรจีนช่วยงานซับซ้อน
- เปิดตัว ส.ค. 2567, AGIBOT เริ่มผลิตจำนวนมาก ธ.ค. 2567, สถิติกินเนสส์ เดิน 106.286 กม. ใน 3 วัน (พ.ย. 2568) — https://en.wikipedia.org/wiki/AgiBot → `launched: 2024-08` (วันเปิดตัวพร้อมเป้าส่งมอบ ไม่พบวันเปิดรับคำสั่งซื้อที่แน่นอน)

### รูปภาพ
- ไม่พบรูป A2 จากการค้นใน Commons (AgiBot/智元/远征/Category:AgiBot/WAIC 2025/CES/MWC/วิดีโอ CNS ที่มีคำว่า 机器人 — เปิดดูคลิป 4S店 ปักกิ่งแล้วไม่มี A2)
- ผู้ประสานงานแจ้งเบาะแส: https://commons.wikimedia.org/wiki/File:National_instrument_Dombra_and_humanoid_robot.jpg — CC0, ZhanatKappassov, 1 ต.ค. 2568 ดูภาพแล้ว: หน้าอกมีโลโก้ "智元机器人" เปรียบเทียบกับภาพทางการ A2 Ultra (banner และภาพสเปก 169 ซม./69 กก. ที่ agibot.com/products/a2) ตรงกันทั้งแถบไฟโค้งสีฟ้าที่อก ไฟที่ไหล่ ลำตัวส่วนล่างสีดำ หน้ากากดำพร้อมตาไฟสีฟ้า และมีมือห้านิ้วสีดำ → A2 (ลักษณะตรงกับ A2 Ultra ไม่ใช่ A2 Lite ที่ไม่มีมือคล่องแคล่ว) หุ่นยืนติดโครงแขวนนิรภัย อยู่ด้านขวาของภาพ focus "80% 45%" ทดสอบ thumb 1280/960 = 200

---

## 3. LimX Luna — `limx-luna`

### ยืนยันรุ่นจากรูป
- https://commons.wikimedia.org/wiki/File:044_MNACTEC_(Terrassa),_exposici%C3%B3_temporal_Robots,_robot_androide_LimX_Luna.jpg — CC BY-SA 4.0, Enric, 20 ก.ย. 2569
- ดูภาพแล้ว: ตัวสีเงิน หัวหน้ากากดำทรงรี มีไฟรูปข้าวหลามตัดสีฟ้า อก/ท้องหุ้มผ้า โลโก้ LimX ที่อก — ตรงกับภาพ banner ทางการของ Luna (หน้ากากดำมีไฟรูปข้าวหลามตัด) และภาพ luna-2-1 (อกหุ้มผ้า) ที่ https://www.limxdynamics.com/en/products/luna ; **ไม่ใช่ Oli** ซึ่งหัวเป็นกล่องกล้องสี่เหลี่ยม (ภาพ oli img-1/oli-bg ที่ https://www.limxdynamics.com/en/products/oli) → ใช้ id `limx-luna` focus "50% 35%" ทดสอบ thumb 1280/960 = 200

### ราคาและการจำหน่าย
- ราคาขายปลีกในจีน 298,000 หยวน ผู้ซื้อ 100 รายแรกลด 40,000 หยวน เปิดรับจอง — https://finance.sina.com.cn/tech/roll/2026-05-25/doc-inhzctrk1968363.shtml ; https://www.21jingji.com/article/20260525/herald/c980a69270df9a7ce8c483b563066939.html ; TechNode https://technode.com/2026/05/26/limx-dynamics-unveils-luna-humanoid-robot-with-ai-dance-learning/
- TNN: "เปิดให้สั่งจองแล้วในประเทศจีน และมีแผนจะขยายตลาดไปสู่ระดับสากลภายในปี 2027" ราคาแปลง 1.34 ล้านบาท (เป็นการแปลงค่าเงิน) — https://www.tnnthailand.com/tech/236096/ → `availability: preorder`
- droneth.or.th (Drone Association Thailand) หน้า LimX Luna: ราคา "ติดต่อขอใบเสนอราคา" สั่งจอง ติดต่อผ่าน LINE metaxr; ระบุว่าฟังก์ชันขั้นสูงต้องสมัคร LimX Studio และมีหลายเวอร์ชัน — https://droneth.or.th/product/limx-luna/ (market.md: สถานะผู้นำเข้าไม่ชัดเจน) และมีหน้า TRON 1 — https://droneth.or.th/zh/product/limx-tron-1-biped-robot/
- เปิดตัว 25 พ.ค. 2569 → `launched: 2026-05`

### สเปก (หน้าสเปกทางการ)
- ภาษาจีน: 2 คอลัมน์ "Luna 创享版 / 创作版" ค่าตรงกันทุกแถว; สูง 160 ซม., ไหล่ 47 ซม., แขน 69 ซม., **54 กก.**, 27 DOF (คอ 2, เอว 3, แขน 5×2, ขา 6×2), มือฝ่ามือ/กำปั้นมาตรฐาน, มือห้านิ้ว 6 DOF = อุปกรณ์เสริม (○), แบตลิ้นชัก 2 ก้อน 10,000 mAh ใช้งาน ~4 ชม. ชาร์จ ~1 ชม., ชาร์จเจอร์ 58.8 V 10 A, hot-swap, เดินสูงสุด 5 กม./ชม. (= 1.39 ม./วิ), แขนรับ 3 กก./ข้าง, แรงบิดมอเตอร์สูงสุด 200 N·m, RK3588 ×2 (ควบคุม 16G/256G, รับรู้ 8G/32G), IMU 6 แกน, กล้อง RGB, ไมค์, ลำโพง, แถบไฟ LED, WiFi 6, Bluetooth, LimX UP / LimX Studio / COSA, ท่าเต้น 20 + ท่าทาง 20, รับประกัน 12 เดือน — https://www.limxdynamics.com/zh/products/luna/spec
- ภาษาอังกฤษ: น้ำหนัก **56 กก.** (ขัดกับภาษาจีน → weightKg [54, 56] และเขียนไว้ใน considerations) — https://www.limxdynamics.com/en/products/luna/spec
- ความปลอดภัย (หน้าผลิตภัณฑ์): หยุดเมื่อล้ม, หยุดเมื่อมีแรงภายนอก/การกระแทก, ปุ่มหยุดฉุกเฉิน, หยุด/รีเซ็ตระหว่างการแสดงได้; Video to Motion; AI task editor; ควบคุม 200+ ตัว — https://www.limxdynamics.com/en/products/luna
- batteryWh = null (ไม่ระบุโวลต์ของแบตเตอรี่)

### บริษัท
- ก่อตั้ง ม.ค. 2565 เซินเจิ้น ผู้ก่อตั้ง Will Zhang, ผู้ลงทุน Alibaba (A, ก.ค. 2567), JD.com (ก.ค. 2568), Lenovo Capital, NIO Capital; Series B 200 ล้าน USD (ก.พ. 2569) + Pre-IPO 200 ล้าน USD (ก.ค. 2569); TRON 1 (2567), Oli/TRON 2 (2568), Luna/COSA (2569) — https://www.limxdynamics.com/en/about
- Oli: 3 รุ่น Lite/EDU/Super เริ่มต้น 158,000 หยวน 165 ซม. 31 DOF (31 ก.ค. 2568) — https://technode.com/2025/07/31/limx-dynamics-launches-humanoid-robot-limx-oli-starting-at-21800/

### ไม่ได้ทำไฟล์ Oli
- รูปใน Commons เป็น Luna ไม่ใช่ Oli; Oli ในไทยพบร้าน Cool Mania (cool-mania.co.th — ผู้ดำเนินการ Media Leaders s.r.o. สาธารณรัฐเช็ก) แสดงราคา "LimX Oli 31 DOF + INTEL cameras 165 ซม." 2,242,000 บาท ไม่ระบุ VAT — https://www.cool-mania.co.th/kaed-cet/hun-ynt-hiw-ma-nxyd-laea-hun-ynt (ไม่ใช่บริษัทไทยโดยชัดเจน)

### ภาพอื่นในชุด MNACTEC "exposició temporal Robots" (Category:Robots (mNACTEC exhibition))
- ฮิวแมนนอยด์ในชุด: LimX Luna (044), InMoov (217), DARwIn-OP/NAO (218), U05 (224), REEM (225), Promobot V.2 (226), Gepeto Plus (227 — ดูภาพแล้ว รูปทรงแบบ Pepper มีจอที่อก), Zeno R25 (229), ASIMO (230), Mechadroid C3 (231), NAO (232), NEXTAGE (214) และภาพรวม 043/045 (ASIMO, หุ่นสีขาวตาเขียว)
- ไม่พบฮิวแมนนอยด์จีนรุ่นอื่นที่มีราคาเผยแพร่ในชุดนี้ (NAO มีไฟล์ nao6.json ของเอเจนต์อื่นแล้ว)

---

## 4. Galbot G1 — `galbot-g1`

### ราคา (ช่องทางทางการ)
- หน้า G1 ของ Galbot มีปุ่ม "前往购买 / Buy Now" ลิงก์ไป JD.com สินค้า 100296074780 (ร้าน "京东自营") — http://www.galbot.com/g1/ ; https://item.m.jd.com/product/100296074780.html (หน้า JD ไม่แสดงราคาแบบไม่ล็อกอิน)
- ราคาบน JD: "近63万元 (未补贴的价格为69.99万元)" ก.พ. 2569 — 新京报 https://finance.sina.cn/2026-02-17/detail-inhnckrf8995506.d.html ; 极目新闻 "京东上架的两台单价近63万元的Galbot G1，12分钟内便被苏州一家零售企业下单锁定 … Galbot G1被连夜加购近300台" — https://www.ctdsb.net/c1746_202602/2665505.html
- 钛媒体 5 ก.ย. 2569: G1 "京东标价约70万元", S1 ราว 105 万元, ระดมทุนรวมราว 70 亿元 มูลค่า >200 亿元 (มี.ค. 2569) — https://www.tmtpost.com/8129137.html
- → `listPrice: 699,900 CNY` (ราคาก่อนเงินอุดหนุนบนช่องทางที่ผู้ผลิตแนะนำ) รวม Galbot ไว้เพราะเป็นราคาจากร้านค้าปลีกที่ได้รับอนุญาต (JD จำหน่ายเอง ลิงก์จากเว็บไซต์ผู้ผลิต)
- RobotJia ระบุ $88,000 (≈63 万) — https://robotjia.com/robots/galbot-g1 (ไม่ใช้) ; ตัวเลขผู้ขายต่อ ~$206k ที่ scout พบ ไม่ได้ยืนยัน → ไม่ใช้

### สเปก (เว็บไซต์ทางการ http://www.galbot.com/g1/)
- สูงสุด 1,730 มม., ขายกตัว 650 มม., แขน 710 มม., พื้นที่ทำงานแนวดิ่ง 0–2,100 มม. แนวนอน 1,900 มม., 92.5 กก., IP54, 0–40 °C, แบต 48 V 30 Ah (= 1,440 Wh), ชาร์จ 54.6 V 10 A, ใช้งาน 8 ชม., ชาร์จ 3.5 ชม., กล้องสเตอริโอหัว ×1, RGB ลำตัว ×4, IMU, กล้องความลึกข้อมือ ×2, เซนเซอร์แรง 6 แกนข้อมือ ×2, LiDAR 3D ×1, อัลตราโซนิก ×8, Jetson AGX Orin 64GB 275 TOPS, WiFi/BT 5.2, จอ 5.5", ไมค์ 4 ตัวแบบเส้นตรง ×2, ลำโพง 5 W ×2, รับน้ำหนักข้างละ 5 กก. รวม 10 กก., 21 DOF (คอ 2, แขน 7×2, เอว 3, ขา 2) ไม่รวมฐานและปลายแขน, ปลายแขนเปลี่ยนได้ (มือ/ถ้วยดูด/กริปเปอร์), ฐาน 4 ล้อรอบทิศทาง 600×600 มม., 1.5 ม./วิ, ปุ่มเปิดเครื่องและปุ่มหยุดฉุกเฉิน; 银河太空舱 >170 จุดใน >40 เมือง; คลังค้าปลีกด่วนกว่า 100 แห่ง 7×24 ชม. ต่อเนื่อง >1.5 ปี
- เปิดตัว มิ.ย. 2567 ที่งาน BAAI (北京智源大会) และเริ่มให้บริการเชิงพาณิชย์ในร้านยา มิ.ย. 2567; ส่งมอบสะสมปี 2568 >1,200 ตัว — https://baike.baidu.com/item/Galbot/68718803 (เปิดอ่านผ่านเบราว์เซอร์) ; 新京报 27 มี.ค. 2568 https://m.bjnews.com.cn/detail/1742967366129297.html → `launched: 2024-06`
- ก่อตั้ง 2566 ผู้ก่อตั้ง Wang He (王鹤) — https://www.galbot.com/about/
- ไทย: ไม่พบผู้จัดจำหน่าย (market.md) และไม่มีใน RBTX TH → `availability: import`

### รูปภาพ
- เลือก https://commons.wikimedia.org/wiki/File:WAIC_2025_-_Robots_10.jpg — CC BY-SA 4.0, Xuthoria, WAIC 2025 เซี่ยงไฮ้ ดูภาพแล้ว: G1 กำลังหยิบสินค้าจากชั้นในฉากร้านสะดวกซื้อ ฐานมีตัวอักษร "G1" และ "GALBOT" ชัดเจน focus "55% 40%" ทดสอบ thumb 1280/960 = 200 (ภาพ 08/09 ในชุดเดียวกันก็เป็น G1)
- ภาพ CC0 ร้าน 银河太空舱 เซินเจิ้น (SABAIEE HuangChuis MMADEEG, curid 176888169–176888175) ดูแล้ว: หุ่นอยู่หลังกระจก มีเงาสะท้อนและวันที่ประทับมุมภาพ ภาพ R12S 03 ชัดที่สุดแต่ยังด้อยกว่าภาพ WAIC → ไม่ใช้ (curid 176888173 เป็นภาพมวยไม่เกี่ยวข้อง)

---

## 5. ข้อค้นพบที่เป็นประโยชน์ต่อเอเจนต์อื่น

- **RBTX Thailand (igus)** https://th.rbtx.shop/th-TH/components/humanoid แสดงราคาบาท (ไม่รวม VAT ค่าส่งตามใบเสนอราคา) ของฮิวแมนนอยด์หลายรุ่น ณ 26 ต.ค. 2569 เช่น AGIBOT A3 Ultra 3,950,000; A3 3,300,000; G2 5,550,000; X2 Basic 986,250; X2 Ultra 2,032,800; Astribot S1 4,458,750; NOETIX BUMI 294,500; NOETIX N2 1,135,750; Booster K1 Basic EDU 629,950 / K1 Geek 524,950 / K1 Pro EDU 749,950 / T2 Pro 1,499,950 และ 4,999,950; Dobot ATOM-W 3,725,000 / Atom Max 4,300,000 และ 3,950,000 / Atom Trainer D 1,710,000; Fourier GR2 8,511,784.50 / GR3 8,170,973; MagicLab G1 5,256,646.50; ROBOTERA L7 6,739,154 / Q5 3,432,232; UniX Wanda 2.0 3,432,232; Unitree G1 Basic 1,150,000 / G1 EDU 1,575,000 / G1 รุ่นพิเศษ 2,250,000 / H1 4,450,000 / H1-2 6,000,000 / H2 EDU 3,094,000 / H2 2,100,000 / R1 Base 420,000 / R1 EDU 750,000; รุ่น "ตามคำร้องขอ": AGIBOT X1, A2-Series, CASBOT 02, Fourier GR1, Galaxea, Kepler K2 ฯลฯ ผู้จัดทำเว็บไซต์คือ igus SE & Co. KG (เยอรมนี)
- Cool Mania (cool-mania.co.th, Media Leaders s.r.o.) แสดงราคาบาทของ LimX Oli 2,242,000 บาท
- Commons ชุด "WAIC 2025 - Robots 01–49" (CC BY-SA 4.0, Xuthoria) มีภาพ Galbot G1 (08–10), Fourier (11), Lenovo (03), TURIN (06–07), หุ่นเล่นเคอร์ลิงที่บูธศูนย์นวัตกรรมเซี่ยงไฮ้ (31–32, 47–48) ฯลฯ อาจเป็นประโยชน์กับรุ่นอื่น

## 6. ข้อจำกัด
- โควตา WebSearch ของเซสชันหมดระหว่างทำงาน การค้นต่อจากนั้นใช้ Google ผ่านเบราว์เซอร์และการเปิดหน้าเว็บโดยตรง
- ราคาบาทของ AGIBOT มาจากรายงานข่าว (MGR) ไม่พบบนหน้าเว็บของ VST ECS เอง และไม่ระบุว่ารวม VAT
