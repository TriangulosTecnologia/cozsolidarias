/** Shape of a single navigation entry used in main nav and legal links. */
export type NavEntry = {
  id: string;
  href: string;
  label: string;
};

/**
 * Main navigation entries rendered in the Header, in display order.
 *
 * @example
 * mainNav.map((entry) => <NavLink key={entry.id} href={entry.href} label={entry.label} />)
 */
export const mainNav: NavEntry[] = [
  { id: 'mapa', href: '/mapas', label: 'Mapas' },
  { id: 'sobre', href: '/sobre', label: 'Sobre' },
  { id: 'contato', href: '/contato', label: 'Contato' },
];

/**
 * Footer legal navigation entries rendered in the Footer, in display order.
 *
 * @example
 * legalNav.map((entry) => <NavLink key={entry.id} href={entry.href} label={entry.label} />)
 */
export const legalNav: NavEntry[] = [
  { id: 'termos', href: '/termos', label: 'Termos de Uso' },
  { id: 'cookies', href: '/cookies', label: 'Cookies' },
];
