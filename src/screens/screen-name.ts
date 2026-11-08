/**
 * :Project:  suona-la-nota -- the names of the screens of the page
 * :Created:  lun 09 nov 2026 00:10:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The screens of the wizard, and nothing else: a list of names in one place,
 * so that adding the soundcheck of ticket 09 is a line here, an element in
 * `index.html`, a module beside the others and a row in the composition — and
 * never an edit to the wizard, which only knows how to show one of them.
 */
export type ScreenName = 'setup' | 'exercise' | 'summary';
