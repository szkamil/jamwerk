// Self-hosted latin / latin-ext subsets (SIL Open Font License) so the page
// does not wait on fonts.googleapis.com. Variable files cover the weights
// the UI actually uses.
import bricolageLatin from './fonts/bricolage-grotesque-latin.woff2';
import bricolageLatinExt from './fonts/bricolage-grotesque-latin-ext.woff2';
import instrumentLatin from './fonts/instrument-sans-latin.woff2';
import instrumentLatinExt from './fonts/instrument-sans-latin-ext.woff2';

export const FONT_FILES: Record<string, ArrayBuffer> = {
  'bricolage-grotesque-latin.woff2': bricolageLatin,
  'bricolage-grotesque-latin-ext.woff2': bricolageLatinExt,
  'instrument-sans-latin.woff2': instrumentLatin,
  'instrument-sans-latin-ext.woff2': instrumentLatinExt,
};
