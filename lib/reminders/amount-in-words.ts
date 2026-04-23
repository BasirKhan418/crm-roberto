type Locale = 'en' | 'fr';

const FR_UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const FR_TENS: Record<number, string> = {
  20: 'vingt',
  30: 'trente',
  40: 'quarante',
  50: 'cinquante',
  60: 'soixante',
  70: 'soixante',
  80: 'quatre-vingt',
  90: 'quatre-vingt',
};

function frBelow100(n: number): string {
  if (n < 20) return FR_UNITS[n];
  if (n === 80) return 'quatre-vingts';

  const tens = n >= 70 && n < 80 ? 60 : n >= 90 ? 80 : Math.floor(n / 10) * 10;
  const rem = n - tens;
  const base = FR_TENS[tens];

  if (rem === 0) return base;
  if (tens === 70 || tens === 90) {
    return `${base}-${FR_UNITS[rem + 10]}`;
  }
  if (rem === 1 && tens !== 80) {
    return `${base} et un`;
  }
  return `${base}-${FR_UNITS[rem]}`;
}

function frBelow1000(n: number): string {
  if (n < 100) return frBelow100(n);
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  const prefix = hundreds === 1 ? 'cent' : `${FR_UNITS[hundreds]} cent${rem === 0 ? 's' : ''}`;
  return rem === 0 ? prefix : `${prefix === 'cent' || prefix.endsWith('cents') ? prefix.replace(/s$/, '') : prefix} ${frBelow100(rem)}`.trim();
}

function frInteger(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 1000) return frBelow1000(n);

  const thousands = Math.floor(n / 1000);
  const rem = n % 1000;
  const thousandsPart = thousands === 1 ? 'mille' : `${frBelow1000(thousands)} mille`;
  if (rem === 0) return thousandsPart;
  return `${thousandsPart} ${frBelow1000(rem)}`;
}


const EN_UNITS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const EN_TENS: Record<number, string> = {
  20: 'twenty',
  30: 'thirty',
  40: 'forty',
  50: 'fifty',
  60: 'sixty',
  70: 'seventy',
  80: 'eighty',
  90: 'ninety',
};

function enBelow100(n: number): string {
  if (n < 20) return EN_UNITS[n];
  const tens = Math.floor(n / 10) * 10;
  const rem = n % 10;
  return rem === 0 ? EN_TENS[tens] : `${EN_TENS[tens]}-${EN_UNITS[rem]}`;
}

function enBelow1000(n: number): string {
  if (n < 100) return enBelow100(n);
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  const prefix = `${EN_UNITS[hundreds]} hundred`;
  return rem === 0 ? prefix : `${prefix} and ${enBelow100(rem)}`;
}

function enInteger(n: number): string {
  if (n === 0) return 'zero';
  if (n < 1000) return enBelow1000(n);

  const thousands = Math.floor(n / 1000);
  const rem = n % 1000;
  const thousandsPart = `${enBelow1000(thousands)} thousand`;
  if (rem === 0) return thousandsPart;
  if (rem < 100) return `${thousandsPart} and ${enBelow100(rem)}`;
  return `${thousandsPart} ${enBelow1000(rem)}`;
}

export function amountCentsToWords(cents: number, locale: Locale): string {
  const safe = Math.max(0, Math.round(Number.isFinite(cents) ? cents : 0));
  const euros = Math.floor(safe / 100);
  const rem = safe % 100;

  if (euros > 999_999) {
    return '';
  }

  if (locale === 'fr') {
    const whole = frInteger(euros);
    const euroWord = euros <= 1 ? 'euro' : 'euros';
    if (rem === 0) {
      return `${whole} ${euroWord}`;
    }
    const centsWord = rem <= 1 ? 'centime' : 'centimes';
    return `${whole} ${euroWord} et ${frInteger(rem)} ${centsWord}`;
  }

  const whole = enInteger(euros);
  const euroWord = euros <= 1 ? 'euro' : 'euros';
  if (rem === 0) {
    return `${whole} ${euroWord}`;
  }
  const centsWord = rem <= 1 ? 'cent' : 'cents';
  return `${whole} ${euroWord} and ${enInteger(rem)} ${centsWord}`;
}
