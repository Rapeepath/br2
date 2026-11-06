import type { DictKey } from './th'

// English interface strings for the /en mirror. Every Thai key must exist here (the type enforces it).
export const en: Record<DictKey, string> = {
  'site.name': 'Servo',
  'site.tagline': 'Humanoid robot catalogue',
  'site.wordmarkSub': 'Humanoid Showroom Thailand',

  'shell.skip': 'Skip to content',
  'shell.menu': 'Main menu',
  'shell.themeToDark': 'Switch to dark theme',
  'shell.themeToLight': 'Switch to light theme',
  'shell.compareCount': '{count} selected',
  'shell.cta': 'Contact & visit',
  'shell.langSwitch': 'ภาษาไทย',
  'shell.langSwitchLabel': 'อ่านหน้านี้เป็นภาษาไทย',

  'nav.models': 'Robots',
  'nav.compare': 'Compare',
  'nav.guide': 'Buyer’s guide',
  'nav.sources': 'Sources',

  'footer.menu': 'Menu',
  'footer.blurb':
    'Information to help you decide, compiled from makers’ and Thai distributors’ websites and the technology press. Prices converted from foreign currencies are approximate, exclude shipping and import taxes, and may change; check with the seller before you decide.',
  'footer.photos': 'Photos from Wikimedia Commons under each photographer’s licence; credits are on the',
  'footer.trademarks': 'Names and trademarks belong to their owners.',
  'footer.about': 'About the data',
  'footer.bottom': 'Servo, a catalogue of humanoid robots you can order in Thailand',
  'footer.updated': 'Data as of {date}',
  'footer.simulation':
    'The shop, stock, sale prices, bookings and quotations on this site are a simulation for demonstration. Nothing is sold and no money is taken.',

  'tray.label': 'Comparison list',
  'tray.clear': 'Clear list',
  'tray.go': 'Compare {count}/{limit}',
  'tray.remove': 'Remove {name} from the comparison',
  'tray.announce': '{count} of {limit} models selected to compare',
  'tray.cleared': 'Comparison list cleared',

  'notFound.title': 'Page not found',
  'notFound.heading1': 'Page',
  'notFound.heading2': 'not found',
  'notFound.body': 'The link may be wrong, or this model is not in the catalogue.',
  'notFound.home': 'Back to all robots',

  'soon.body': 'This page is being prepared. Meanwhile, reach us by phone or LINE.',
  'soon.home': 'Back to the home page',

  'page.contact': 'Contact us',
  'page.booking': 'Book a demonstration',
  'page.faq': 'Frequently asked questions',
  'page.privacy': 'Privacy policy',
  'page.service': 'After-sales service',
  'page.finance': 'Financing and running costs',
  'page.configure': 'Configure and request a quote',
  'page.quote': 'Quotation',
  'page.solutions': 'Solutions by use',
}
