import { isImageURL, isThemeAwareBrandLogo, getThemeAwareBrandLogoClass } from '../icons';

describe('isImageURL', () => {
  it.each(['https://example.com/icon.png', 'http://example.com/icon.png', '/assets/icon.svg'])(
    'accepts image URL %s',
    (iconURL) => {
      expect(isImageURL(iconURL)).toBe(true);
    },
  );

  it.each(['openAI', 'anthropic', 'assets/icon.svg', '//example.com/icon.png', '', null])(
    'rejects non-image URL %s',
    (iconURL) => {
      expect(isImageURL(iconURL)).toBe(false);
    },
  );
});

describe('isThemeAwareBrandLogo', () => {
  it.each([
    ['Aeonthic'],
    ['Lumen-1-Pulsar'],
    ['lumen_logo.png'],
    ['https://cdn.dfveloper.com/assets/Aeonthic/Logo/logo.png'],
    ['https://cdn.dfveloper.com/assets/Aeonthic/Lumen/Logo/logo.png'],
  ])('recognizes the monochrome brand logo in %s', (value) => {
    expect(isThemeAwareBrandLogo(value)).toBe(true);
  });

  it('recognizes a brand from any available icon metadata', () => {
    expect(isThemeAwareBrandLogo('/assets/logo.png', 'Lumen', 'custom')).toBe(true);
  });

  it.each([['OpenAI'], ['https://example.com/logo.png'], [null], [undefined]])(
    'does not alter unrelated logos in %s',
    (value) => {
      expect(isThemeAwareBrandLogo(value)).toBe(false);
    },
  );
});

describe('getThemeAwareBrandLogoClass', () => {
  it('inverts a black brand logo in dark mode', () => {
    expect(
      getThemeAwareBrandLogoClass('https://cdn.dfveloper.com/assets/Aeonthic/Lumen/Logo/logo.png'),
    ).toBe('dark:invert');
  });

  it('inverts a legacy white brand logo only in light mode', () => {
    expect(
      getThemeAwareBrandLogoClass(
        'https://cdn.dfveloper.com/assets/Aeonthic/Lumen/Logo/logo-white.png',
      ),
    ).toBe('invert dark:invert-0');
  });

  it('does not alter unrelated logos', () => {
    expect(getThemeAwareBrandLogoClass('https://example.com/logo-white.png')).toBe('');
  });
});
