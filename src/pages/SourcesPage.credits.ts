/** Creative Commons deed for a licence label ("CC BY-SA 4.0"), so each credit links the licence itself. */
export function licenceUrl(licence: string): string | null {
  if (/^CC0\b/i.test(licence.trim())) return 'https://creativecommons.org/publicdomain/zero/1.0/'
  const m = /^CC (BY(?:-NC)?(?:-SA|-ND)?) (\d\.\d)$/i.exec(licence.trim())
  return m ? `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/` : null
}