export function isImageURL(iconURL?: string | null): iconURL is string {
  if (!iconURL) {
    return false;
  }

  return /^https?:\/\//i.test(iconURL) || (iconURL.startsWith('/') && !iconURL.startsWith('//'));
}

const THEME_AWARE_BRAND_PATTERN = /(?:^|[^a-z0-9])(?:aeonthic|lumen)(?:[^a-z0-9]|$)/i;
const WHITE_BRAND_LOGO_PATTERN = /logo-white\.(?:png|svg|webp)(?:[?#]|$)/i;

export function isThemeAwareBrandLogo(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => value != null && THEME_AWARE_BRAND_PATTERN.test(value));
}

export function getThemeAwareBrandLogoClass(iconURL?: string | null): string {
  if (!isThemeAwareBrandLogo(iconURL)) {
    return '';
  }

  return WHITE_BRAND_LOGO_PATTERN.test(iconURL ?? '') ? 'invert dark:invert-0' : 'dark:invert';
}
