/**
 * Canonical list of supported locales.
 * Add entries here only — all consumers (Providers, LocaleSwitcher, root layout) derive from this.
 */
export const LOCALES = ['pt-BR', 'en'] as const;

/** Union type of all supported locale codes. */
export type Locale = (typeof LOCALES)[number];

/**
 * Short display code for each locale, shown as the toggle target in `LocaleSwitcher`.
 * When the current locale is `pt-BR`, the button shows `EN` (the target to switch to).
 *
 * @example
 * LOCALE_CODES['pt-BR'] // 'PT'
 * LOCALE_CODES['en']    // 'EN'
 */
export const LOCALE_CODES: Record<Locale, string> = {
  'pt-BR': 'PT',
  en: 'EN',
};

/**
 * Accessible label for switching TO a given locale, expressed in that locale's own language.
 * Used as `aria-label` on `LocaleSwitcher` — always describes the target action, not the current state.
 *
 * @example
 * LOCALE_SWITCH_LABELS['en']    // 'Switch to English'   (shown when current is pt-BR)
 * LOCALE_SWITCH_LABELS['pt-BR'] // 'Mudar para português' (shown when current is en)
 */
export const LOCALE_SWITCH_LABELS: Record<Locale, string> = {
  en: 'Switch to English',
  'pt-BR': 'Mudar para português',
};

/**
 * Type guard that narrows an unknown value to a valid {@link Locale}.
 * Used to validate the `locale` cookie value before applying it.
 *
 * @example
 * isLocale('pt-BR') // true
 * isLocale('fr')    // false
 */
export const isLocale = (value: unknown): value is Locale => {
  return LOCALES.includes(value as Locale);
};
