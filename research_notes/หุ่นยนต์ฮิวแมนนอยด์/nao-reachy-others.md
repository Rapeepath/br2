# NAO6, Reachy 2, 1X NEO, UBTech, Fourier, Ameca: research notes (2026-10-26)

Result: **1 robot written** (`data/nao6.json`). Every other candidate was skipped because it had no verified free
image of the exact model, no published price, or could not be ordered from Thailand. Details are below.

Method: Commons API full-text search (`list=search`, `srnamespace=6`, including `insource:` and `incategory:` queries),
category browsing, and a frame-by-frame check of China News Service (CC BY 3.0/4.0) videos. I downloaded each 480p
transcode, pulled a frame every 3 s with ffmpeg and looked at the contact sheets. The session's WebSearch budget ran out
part-way through, so the later lookups used WebFetch or curl on known URLs plus Brave search.

---

## 1. `nao6`: Maxtronics NAO6 (written)

### Image (verified by viewing)
- **Chosen:** https://commons.wikimedia.org/wiki/File:Nao_-_Vivatech_2019_(32924388687).jpg
  - CC BY-SA 2.0, Jérémy Barande / École polytechnique (Flickr stream of the polytechnique DEI), taken 2019-05-16 at VivaTech.
  - Original 5377×3585. Both build thumbnails return 200: `…/thumb/0/06/Nao_-_Vivatech_2019_%2832924388687%29.jpg/1280px-…` (1280×853)
    and the 960px one. Focus "38% 40%".
  - **Why it is a NAO6 and not a V5:** the robot is dark grey and white with a round "NAO" logo on the chest button.
    This matches the official NAO6 photos exactly: the Maxtronics datasheet cover and the Generation Robots product
    photos, where Generation Robots lists the colour as "Dark gray". V5 robots on Commons are blue or orange/red with
    the Aldebaran stick-figure chest logo (e.g. *Nao Robot (Robocup 2016).jpg*). The photo also post-dates the NAO6
    launch (May 2018).
- **Rejected:**
  - *Nao Robot (Robocup 2016).jpg* (CC0): clear photo, but a blue V5.
  - *232 MNACTEC … humanoide NAO (2005).jpg* (CC BY-SA 4.0): a cut-away museum exhibit behind glass with a caption plate.
  - *Nao - Vivatech 2019 (46952311465).jpg*: same NAO6, portrait crop. A good alternative.
  - *Pareja de robots NAO.jpg*: two V5 robots (pink and blue).
  - *British State Visit to Italy 2025-04-08-…*: OGL 3 licence, and the robots are older blue NAOs.

### Facts and sources
| Fact | Source |
|---|---|
| Model H25600. Size 574×311×275 mm, weight 5.48 kg | Datasheet: https://maxtronics.com/wp-content/uploads/nao-v6-datasheet-en-20260605-maxtronics_v5.pdf |
| 25 DOF (head 2, each arm 5, each leg 5, each hand 1, plus 1 pelvis joint) | Datasheet |
| Li-ion battery, 21.6 V / 2.9 Ah, 62.5 Wh. Charging 90 min. Run time 60 min active use / 90 min normal use | Datasheet, power page (checked on a rendered image of the page) |
| Intel Atom E3845 at 1.91 GHz, 4 GB DDR3, 32 GB eMMC, x86 Linux (Yocto) | Datasheet; Generation Robots |
| 2 front cameras (OV5640, 5 MP); sonar (2 transmitters, 2 receivers, 0.20–0.80 m); 3-axis gyro and accelerometer; FSR ×4 per foot; tactile head and hands; chest button; foot bumpers; 36 MRE encoders | Datasheet |
| 4 microphones | Generation Robots; the NAO7 page says "six … microphones instead of four" |
| TTS and ASR in 22 languages, with no Thai | Datasheet language list |
| Markings CE, FCC, NRTL, Giteki, PSE, RCM, IMDA, NCC, BSMI. Safety standard IEC 62368-1:2014. UN38.3. The certified-country list does not include Thailand. Made in China. IPX0 | Datasheet |
| SDK (Python, C++), Choregraphe, Robot Settings (Windows, macOS, Linux); NAO Activities (no-code Generative AI) | Datasheet; https://maxtronics.com/en/nao6/ |
| **€10,020 incl. VAT, €8,350 excl. VAT** ("From"); delivery within 3 weeks; 2-year warranty; includes the software suite | https://www.generationrobots.com/en/403100-programmable-humanoid-robot-nao-v6.html |
| Generation Robots is listed under the Maxtronics brand page (authorised reseller) | https://www.generationrobots.com/en/142_maxtronics |
| NAO Activities €1,200 incl. VAT; battery charger €96; transport case €478.80 | Generation Robots brand and product pages |
| Ships outside the EU (international post or UPS); the buyer pays import taxes, duties and VAT; shipping is not included; return shipping from outside Europe is at the buyer's cost | https://www.generationrobots.com/en/content/3-terms-and-conditions-of-use |
| RobotLAB (US): NAO V6 Standard Edition $16,990 with a 1-year warranty; School Starter Pack from $22,990; leasing (RaaS) | https://www.robotlab.com/store/nao/ |
| Aldebaran was placed in receivership in June 2025. Maxvision (Shenzhen) bought the core assets in July 2025. About 20,000 NAO sold in 70 countries | https://www.therobotreport.com/maxvision-buys-core-robot-assets-including-nao-pepper-aldebaran/ (2025-07-19) |
| Maxtronics was established in France on 2025-08-28. NAO is "the first humanoid robots industrialized at scale", with 20,000+ deployed and more than 3,600 scientific publications | https://maxtronics.com/en/company/ |
| NAO7 is in development (6 mics, ToF sensors, finger pointing, a torso touch screen, on-device AI); no date announced | https://maxtronics.com/en/nao7/ |
| Maxtronics gave on-site repair support to NAO teams at RoboCup 2026 (Incheon) | https://maxtronics.com/en/maxtronics-supports-the-global-robocup-community-at-robocup-2026/ |
| NAO Power 6 announced 2018-05-09; US/Canada release around late July 2018 | https://www.prweb.com/releases/chartacloud_robotteca_announces_softbank_s_nao_power_6_robot/prweb15469624.htm |
| V6 compared with V5: 5 MP cameras instead of 1.3 MP, SSD storage, faster boot and Wi-Fi, NAOqi 2.8 | https://www.robotlab.com/blog/first-impression-softbank-robotics-nao-v6/ (2018-06-19) |
| **Thailand:** True Robotics (True IoT) showed NAO for business use in 2017. SME Thailand article from 2018. No current Thai dealer with a published price was found | https://www.iphonemod.net/true-robotics-true-iot.html (2017-08-30); https://www.smethailandclub.com/tech/1680.html |

### Decisions
- `listPrice` = €10,020 (the published price incl. 20% French VAT, as instructed). `priceNote` gives €8,350 ex-VAT and
  says that the buyer pays Thai duty and 7% VAT. `priceTHB` = null.
- `availability` = `import`. `category` = `education`. `originGroup` = `europe`: Maxtronics is a French SAS, though the
  owner is Chinese and the robot is made in China.
- `runtimeH` = 1.5 (90 min normal use; 60 min active use is in `cons`). `speedMs`, `payloadKg` and `jointTorqueNm`
  are null because the datasheet does not give them. Third-party sites quote 0.3 m/s, but they are unreliable
  (humanoid-robots.io even calls Maxtronics Japanese).
- `handDof` = 1: the datasheet lists "Hand (in each) 1", a simple open/close hand.
- `launched` = 2018-05 (announcement and order start). The Maxtronics takeover is covered in `background`.

---

## 2. `pollen-reachy-2`: skipped (no image of Reachy 2)
- Commons has only the **first-generation** Reachy: *Reachy robot - École Polytechnique.jpg* (2020) and the video
  *Pollen Robotics - Reachy is back...and it's mobile!.webm* (CC BY 3.0, 2022). I viewed a still: it shows Reachy 1 on
  the 2022 mobile base, not Reachy 2. Searches for "Reachy 2", "Reachy2", "Pollen Robotics", "Hugging Face robot" and
  `insource:` variants, plus Category:Pollen Robotics and Category:Hugging Face, found nothing else.
- Status facts: Hugging Face acquired Pollen Robotics in April 2025. Reachy 2 has 7-DOF arms, about 3 kg payload per
  arm, an adjustable height of 136–166 cm, up to 50 kg, an omnidirectional base with LiDAR, and runs ROS 2 Humble.
  There is no price on the official page (https://pollen-robotics.com/reachy-2/). Media quote **about $70,000**
  (https://www.deeplearning.ai/the-batch/hugging-face-acquires-pollen-robotics-launches-reachy-2-robot-for-open-source-research ;
  https://techcrunch.com/2025/04/14/hugging-face-buys-a-humanoid-robotics-startup).

## 3. `1x-neo`: skipped (not orderable outside the US; no image)
- The official order page (https://www.1x.tech/order) offers **$20,000** ownership (3-year warranty, priority delivery)
  or **$499/month**, with a $200 deposit and "US Deliveries start 2026".
- https://www.1x.tech/discover/neo-home-robot says that 1X will deliver "primarily in the U.S in 2026 and expand to
  other markets starting in 2027". The colours are Tan, Gray and Dark Brown.
- https://www.1x.tech/discover/neo-factory: 10,000 NEOs were booked in 5 days after the 2025-10-28 launch. The Hayward,
  CA factory (58,000 sq ft) has started full-scale production, with capacity of up to 10,000 a year. First shipments
  are promised in 2026.
- No Commons image exists. *Halodi Robotics' Perception Engineer…* shows the older EVE.
- The `notForSale` entry already in market.json matches these facts.

## 4. UBTech: skipped (no free image of any current UBTech humanoid)
- Commons has only *UBTECH Alpha 1PRO Humanoid Robot - hack4no 2016.jpg* (an old hobby robot) and
  *Ma Ying-jeou visit Ping An Finance Center-20240401.png* (CNS CC BY 4.0, which shows a Walker X with a large logo,
  not a model that is sold). There are no hits for Walker S, S1, S2, Tiangong, 天工行者 or Uworld.
- I watched the CNS videos with frame sheets: 探访全球首家具身智能机器人4S店 (Beijing, Aug 2025), 能文又能武…链博会
  (Jul 2025), 光谷人形机器人7S店 (Wuhan, Nov 2025) and 济南机器人6S中心 (Dec 2025). None shows a UBTech Walker. They show
  UniX AI Wanda, Booster T1, Unitree, Hubei 光谷东智 robots and a "Y"-logo grey humanoid.
- Status facts for the "not for sale in Thailand" list:
  - **Tiangong Walker**: RMB 299,000, launched 2025-03-13 with the Beijing Humanoid Robot Innovation Center. 170 cm,
    20 DOF, 10 km/h, NVIDIA Orin. Pre-orders opened then, with deliveries from Q2 2025 for research and education buyers
    (https://technode.com/2025/03/13/ubtech-launches-tiangong-walker-a-research-grade-humanoid-robot-priced-under-45k/).
  - **Walker S2**: sold B2B only. 1,000 units delivered by July 2026, and a partnership with Siemens Digital Industries
    Software (https://www.boerse-express.com/news/articles/ubtech-robotics-aktie-1000-walker-s2-ausgeliefert-siemens-partnerschaft-931458).
  - **UWORLD U1** (a bionic companion humanoid with silicone skin): U1 Lite ¥119,800, U1 Pro ¥169,800, U1 Ultra ¥990,000
    (male) or ¥880,000 (female). Pre-sale on JD.com from 2026-06-02; more than 10,000 orders by 2026-06-30 and more than
    13,000 later; shipping from mid-September 2026; China-focused
    (https://autonews.gasgoo.com/articles/news/starting-from-119800-yuan-ubtech-uworld-u1-full-channel-orders-exceed-10000-2072326807465279489).
  - No UBTech humanoid dealer was found in Thailand. A search snippet mentions a Thai depositary receipt "UBTECH23"
    from Yuanta (https://www.mitihoon.com/?p=617331, https://www.innovestx.co.th/cafeinvest/th/articles/ubtech-metax-20260615).
    I have not verified this.

## 5. Fourier and Engineered Arts Ameca: skipped
- **Fourier** (GR-3 / N1): there are no Commons images, and none were found under the `insource:` "Fourier Intelligence",
  "Fourier GR" or 傅利叶 queries.
- **Ameca**: the only photo is *Ameca Generation 1.jpg* (CC BY-SA), and the current robot is a later generation.
  engineeredarts.com publishes no price (sale or rental is on request).

## Image leads for other agents (not my robots)
- *National instrument Dombra and humanoid robot.jpg* and *Humanoid robot is being programmed.jpg* (both CC0,
  ZhanatKappassov, Oct 2025, Kazakhstan): a full-size humanoid with the **智元机器人 (AgiBot)** chest logo, probably the
  **AgiBot A2**. The photo is sharp and shows the whole body.
- *Paris - Salon VivaTech 2025 - 13.jpg* (Commons, Unitree booth at VivaTech 2025): a seated black humanoid and a
  silver one in an armchair, which look like a **Unitree H1** and a **Unitree G1**, plus Unitree quadrupeds. The scene is
  cluttered; not verified.
- CNS video 光谷人形机器人7S店 (Wuhan, Nov 2025, CC BY 3.0): grey **NAO6** robots dancing at about 88–116 s, under
  subtitles.
