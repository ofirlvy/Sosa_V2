// Language-direction helpers shared by cards and paste handling.
// Hebrew (and other RTL scripts) should read right-to-left with right alignment
// by default; detection is per-text so mixed boards behave naturally.

const RTL_CHARS = /[֐-׿؀-ۿ܀-ݏ]/; // Hebrew, Arabic, Syriac
const LTR_CHARS = /[A-Za-z]/;

export const hasHebrew = (text: string): boolean => /[֐-׿]/.test(text || '');

/** Direction of the FIRST strongly-directional character (mirrors dir="auto"). */
export const detectDirection = (text: string): 'rtl' | 'ltr' => {
  for (const ch of text || '') {
    if (RTL_CHARS.test(ch)) return 'rtl';
    if (LTR_CHARS.test(ch)) return 'ltr';
  }
  return 'ltr';
};

/** Default text alignment for content whose author didn't pick one explicitly. */
export const defaultAlignFor = (text: string): 'left' | 'right' =>
  detectDirection(text) === 'rtl' ? 'right' : 'left';
