// Thai interface strings (the default language). Keys are shared with en.ts, which must define every one.
// Pages add their own keys here as they are translated; `{name}` placeholders are filled by t().
export const th = {
  'site.name': 'Servo',
  'site.tagline': 'แค็ตตาล็อกหุ่นยนต์ฮิวแมนนอยด์',
  'site.wordmarkSub': 'Humanoid Showroom Thailand',

  'shell.skip': 'ข้ามไปยังเนื้อหา',
  'shell.menu': 'เมนูหลัก',
  'shell.themeToDark': 'เปลี่ยนเป็นธีมมืด',
  'shell.themeToLight': 'เปลี่ยนเป็นธีมสว่าง',
  'shell.compareCount': 'เลือกไว้ {count} รุ่น',
  'shell.cta': 'ติดต่อและนัดชม',
  'shell.langSwitch': 'English',
  'shell.langSwitchLabel': 'Read this page in English',

  'nav.models': 'หุ่นยนต์',
  'nav.compare': 'เปรียบเทียบ',
  'nav.guide': 'คู่มือก่อนซื้อ',
  'nav.sources': 'แหล่งข้อมูล',

  'footer.menu': 'เมนู',
  'footer.blurb':
    'ข้อมูลเพื่อประกอบการตัดสินใจ เรียบเรียงจากเว็บไซต์ผู้ผลิต ผู้จัดจำหน่ายในไทย และสื่อเทคโนโลยี ราคาที่แปลงจากสกุลเงินต่างประเทศเป็นราคาโดยประมาณ ยังไม่รวมค่าขนส่งและภาษีนำเข้า และอาจเปลี่ยนแปลงได้ โปรดตรวจสอบกับผู้จำหน่ายก่อนตัดสินใจ',
  'footer.photos': 'ภาพถ่ายจาก Wikimedia Commons ตามสัญญาอนุญาตของผู้ถ่าย ดูเครดิตได้ที่หน้า',
  'footer.trademarks': 'ชื่อและเครื่องหมายการค้าเป็นของเจ้าของแต่ละราย',
  'footer.about': 'เกี่ยวกับข้อมูล',
  'footer.bottom': 'Servo แค็ตตาล็อกหุ่นยนต์ฮิวแมนนอยด์ที่สั่งซื้อได้ในไทย',
  'footer.updated': 'ข้อมูลล่าสุด {date}',
  'footer.simulation':
    'ร้าน สต็อก ราคาขาย การจอง และใบเสนอราคาบนเว็บนี้เป็นระบบจำลองเพื่อการสาธิต ไม่มีการซื้อขายหรือรับเงินจริง',

  'tray.label': 'รายการเปรียบเทียบ',
  'tray.clear': 'ล้างรายการ',
  'tray.go': 'เปรียบเทียบ {count}/{limit}',
  'tray.remove': 'นำ {name} ออกจากรายการเปรียบเทียบ',
  'tray.announce': 'เลือกเปรียบเทียบแล้ว {count} จาก {limit} รุ่น',
  'tray.cleared': 'ล้างรายการเปรียบเทียบแล้ว',

  'notFound.title': 'ไม่พบหน้า',
  'notFound.heading1': 'ไม่พบหน้า',
  'notFound.heading2': 'ที่ต้องการ',
  'notFound.body': 'ลิงก์อาจไม่ถูกต้อง หรือรุ่นนี้ไม่มีในแค็ตตาล็อก',
  'notFound.home': 'กลับไปดูหุ่นยนต์ทั้งหมด',

  'soon.body': 'หน้านี้กำลังจัดทำ ระหว่างนี้ติดต่อเราได้ทางโทรศัพท์หรือ LINE',
  'soon.home': 'กลับหน้าแรก',

  'page.contact': 'ติดต่อเรา',
  'page.booking': 'นัดชมการสาธิต',
  'page.faq': 'คำถามที่พบบ่อย',
  'page.privacy': 'นโยบายความเป็นส่วนตัว',
  'page.service': 'บริการหลังการขาย',
  'page.finance': 'คำนวณค่างวดและค่าใช้จ่าย',
  'page.configure': 'จัดสเปกและขอใบเสนอราคา',
  'page.quote': 'ใบเสนอราคา',
  'page.solutions': 'โซลูชันตามงาน',
} as const

export type DictKey = keyof typeof th
