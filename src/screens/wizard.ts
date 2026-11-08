/**
 * :Project:  suona-la-nota -- one screen at a time, and the rise between them
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The wizard: a page with every screen in it and one shown at a time, which is
 * not four addresses. It knows nothing about what a screen holds — it is given
 * the elements and the names — so the soundcheck of ticket 09 enters by adding
 * a name to `screen-name.ts` and a module beside the others, not by touching
 * this file.
 */
export interface Wizard<Name extends string> {
  show(name: Name): void;
}

/**
 * One screen at a time, with the rise the wizard asked for. The class is taken
 * away and put back so that going from a screen to itself animates too, which
 * is what happens when a session is replayed.
 */
export function createWizard<Name extends string>(screens: Record<Name, HTMLElement>): Wizard<Name> {
  const names = Object.keys(screens) as Name[];

  return {
    show(name: Name): void {
      for (const candidate of names) screens[candidate].hidden = candidate !== name;
      const shown = screens[name];
      shown.classList.remove('screen-in');
      void shown.offsetWidth;
      shown.classList.add('screen-in');
    },
  };
}
