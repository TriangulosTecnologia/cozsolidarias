'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { isLocale, type Locale } from '../../../config/locales';

/**
 * Server action — writes the chosen locale to the `locale` cookie and invalidates
 * the root layout so the document re-renders with the new locale on the next request.
 * Silently ignores invalid locale values.
 *
 * @example
 * await setLocale('en');
 */
export const setLocale = async (locale: Locale): Promise<void> => {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
  });

  revalidatePath('/', 'layout');
};
