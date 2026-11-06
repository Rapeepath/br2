// Which robots fit which job. A model belongs to a solution when its category matches, or when its own use
// cases / "ideal for" lines (the Thai research text) mention the job; the page then quotes those very lines,
// so every claim on it comes from the catalogue.
import { models, type ModelWithGallery } from '../../data'
import type { Lang } from '../../i18n'
import { localized } from '../../i18n/content'
import type { Category } from '../../lib/types'

export type SolutionSlug = 'research' | 'education' | 'service' | 'industrial'

interface SolutionDef {
  slug: SolutionSlug
  categories: Category[]
  keywords: string[]
  th: { title: string; short: string; lede: string; needs: string[] }
  en: { title: string; short: string; lede: string; needs: string[] }
}

export const SOLUTIONS: SolutionDef[] = [
  {
    slug: 'research',
    categories: ['research'],
    keywords: ['วิจัย', 'พัฒนาซอฟต์แวร์', 'embodied'],
    th: {
      title: 'งานวิจัยและพัฒนา',
      short: 'มหาวิทยาลัย ศูนย์วิจัย และทีมพัฒนาซอฟต์แวร์หุ่นยนต์',
      lede: 'หุ่นยนต์ที่เปิดให้เขียนโปรแกรมควบคุมการเคลื่อนไหวและการรับรู้ สำหรับงานวิจัยการเดินสองขา reinforcement learning และ embodied AI',
      needs: ['SDK หรือ ROS 2 ที่เข้าถึงข้อต่อและเซนเซอร์ได้', 'โครงแขวนกันล้มสำหรับทดลองการเดิน', 'แบตเตอรี่สำรองเพื่อทดลองต่อเนื่อง'],
    },
    en: {
      title: 'Research and development',
      short: 'Universities, research centres and robot software teams',
      lede: 'Robots that open motion and perception to your own code, for research into biped walking, reinforcement learning and embodied AI.',
      needs: ['An SDK or ROS 2 access to joints and sensors', 'A fall-arrest gantry for walking trials', 'Spare batteries for long test sessions'],
    },
  },
  {
    slug: 'education',
    categories: ['education'],
    keywords: ['สอน', 'การเรียน', 'โรงเรียน', 'การศึกษา', 'สถานศึกษา'],
    th: {
      title: 'การศึกษา',
      short: 'โรงเรียน มหาวิทยาลัย และศูนย์การเรียนรู้',
      lede: 'หุ่นยนต์สำหรับสอนการเขียนโปรแกรม วิทยาการหุ่นยนต์ และ AI ในห้องเรียน ขนาดเคลื่อนย้ายง่าย และมีหลักสูตรรองรับ',
      needs: ['ซอฟต์แวร์เขียนโปรแกรมที่ผู้เรียนเริ่มได้ง่าย', 'อบรมครูผู้สอนก่อนเปิดคลาส', 'พื้นที่ปลอดภัยสำหรับการสาธิตหน้าห้อง'],
    },
    en: {
      title: 'Education',
      short: 'Schools, universities and learning centres',
      lede: 'Robots for teaching programming, robotics and AI in class, easy to move between rooms and backed by teaching material.',
      needs: ['Programming software students can start with easily', 'Teacher training before classes begin', 'A safe space for demonstrations in front of the class'],
    },
  },
  {
    slug: 'service',
    categories: ['service'],
    keywords: ['ต้อนรับ', 'ค้าปลีก', 'ห้าง', 'โรงแรม', 'งานบริการ', 'โชว์รูม', 'อีเวนต์'],
    th: {
      title: 'งานบริการและค้าปลีก',
      short: 'ห้าง โรงแรม โชว์รูม ธนาคาร และงานอีเวนต์',
      lede: 'หุ่นยนต์ต้อนรับ ให้ข้อมูล และดึงดูดผู้คน สำหรับพื้นที่ที่มีลูกค้าเดินผ่านทั้งวัน จนถึงงานหยิบส่งสินค้าในร้านอัตโนมัติ',
      needs: ['เนื้อหาและบทพูดที่ปรับตามแบรนด์', 'พื้นที่เดินที่เรียบและกั้นระยะปลอดภัย', 'จุดชาร์จใกล้พื้นที่ใช้งาน'],
    },
    en: {
      title: 'Service and retail',
      short: 'Malls, hotels, showrooms, banks and events',
      lede: 'Robots that welcome, inform and draw a crowd where customers pass all day, through to picking and handing over goods in automated shops.',
      needs: ['Content and scripts tailored to your brand', 'A level floor and a safety distance around the robot', 'Charging close to where it works'],
    },
  },
  {
    slug: 'industrial',
    categories: ['industrial'],
    keywords: ['โรงงาน', 'อุตสาหกรรม', 'คลังสินค้า', 'โลจิสติกส์', 'คัดแยก'],
    th: {
      title: 'อุตสาหกรรมและคลังสินค้า',
      short: 'โรงงาน คลังสินค้า และผู้ประกอบระบบ',
      lede: 'หุ่นยนต์ที่หยิบ จับ และเคลื่อนย้ายชิ้นงาน สำหรับทดลองงานคัดแยก ป้อนวัสดุ และหยิบแพ็กสินค้าร่วมกับคน',
      needs: ['ประเมินความเสี่ยงและกำหนดพื้นที่ทำงานร่วมกับคน', 'เครือข่าย Wi-Fi ที่ครอบคลุมพื้นที่ทั้งหมด', 'ผู้ประกอบระบบที่เชื่อมกับระบบคลังสินค้าเดิม'],
    },
    en: {
      title: 'Industry and warehousing',
      short: 'Factories, warehouses and system integrators',
      lede: 'Robots that pick, grip and move parts, for trials in sorting, material feeding and order picking alongside people.',
      needs: ['A risk assessment and defined shared work zones', 'Wi-Fi that covers the whole area', 'An integrator to connect it to your warehouse systems'],
    },
  },
]

export const solutionOf = (slug: string | undefined) => SOLUTIONS.find((s) => s.slug === slug)

export interface SolutionMatch {
  model: ModelWithGallery
  /** The model's own lines (in the page's language) that put it here */
  reasons: string[]
  primary: boolean
}

export function matchModels(slug: SolutionSlug, lang: Lang): SolutionMatch[] {
  const def = solutionOf(slug)!
  const hits = (line: string) => def.keywords.some((k) => line.includes(k))
  return models
    .map((base) => {
      const m = localized(base, lang)
      const idx = (list: string[]) => list.map((line, i) => (hits(line) ? i : -1)).filter((i) => i >= 0)
      const use = idx(base.useCases).map((i) => m.useCases[i] ?? base.useCases[i])
      const ideal = idx(base.idealFor).map((i) => m.idealFor[i] ?? base.idealFor[i])
      const primary = def.categories.includes(base.category)
      return { model: m, reasons: [...use, ...ideal].slice(0, 4), primary }
    })
    .filter((x) => x.primary || x.reasons.length > 0)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || b.reasons.length - a.reasons.length || (a.model.span.price?.[0] ?? 0) - (b.model.span.price?.[0] ?? 0))
}
