import { defineMessages } from '@ttoss/react-i18n';

const messages = defineMessages({
  sobre: {
    defaultMessage: 'About',
    description: 'Main navigation link to the About page.',
  },
  contato: {
    defaultMessage: 'Contact',
    description: 'Main navigation link to the Contact page.',
  },
  termos: {
    defaultMessage: 'Terms of Use',
    description: 'Footer legal link to the Terms of Use page.',
  },
  cookies: {
    defaultMessage: 'Cookies',
    description: 'Footer legal link to the Cookies policy page.',
  },
});

/** Shape of a single navigation entry used in main nav and legal links. */
export type NavEntry = {
  id: string;
  href: string;
  label: (typeof messages)[keyof typeof messages];
};

/**
 * Main navigation entries rendered in the Header, in display order.
 * Labels are i18n descriptors — call `intl.formatMessage(entry.label)` to render.
 *
 * @example
 * mainNav.map((entry) => <NavLink key={entry.id} href={entry.href} label={entry.label} />)
 */
export const mainNav: NavEntry[] = [
  { id: 'sobre', href: '/sobre', label: messages.sobre },
  { id: 'contato', href: '/contato', label: messages.contato },
];

/**
 * Footer legal navigation entries rendered in the Footer, in display order.
 *
 * @example
 * legalNav.map((entry) => <NavLink key={entry.id} href={entry.href} label={entry.label} />)
 */
export const legalNav: NavEntry[] = [
  { id: 'termos', href: '/termos', label: messages.termos },
  { id: 'cookies', href: '/cookies', label: messages.cookies },
];
