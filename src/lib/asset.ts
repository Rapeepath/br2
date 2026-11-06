/**
 * Site-root URL for a file in public/. The catalogue stores image paths relative ("images/x.jpg"), which
 * only resolved under hash routing; with real URLs ("/models/x") they must start at the root.
 */
export const asset = (path: string): string =>
  /^(?:[a-z]+:|\/)/i.test(path) ? path : `/${path.replace(/^\.\//, '')}`
