// Shown in a little card every time a shift ends. Always in Italian.
export const LOVE_PHRASES = [
  'Sei il mio posto preferito al mondo. ❤️',
  'Ogni giorno con te è il mio giorno più bello.',
  'Ti amo più di ieri e meno di domani.',
  'Sei la ragione del mio sorriso.',
  'La doccia ti aspetta, e anche io',
  'Con te anche un caffè diventa magia.',
  'Sei la mia casa, ovunque io sia.',
  'Torna a casa: qualcuno ti aspetta con un abbraccio enorme. 🤗',
  'Sei stata bravissima oggi. Sono fiero di te.',
  'Sei il mio sogno più bello.',
  'Ogni turno finisce, il mio amore per te no.',
  'Sei la stella più luminosa del mio cielo. ✨',
  'Mi basta guardarti per essere felice.',
  'Tu sei il mio per sempre.',
  'Il mondo è più dolce da quando ci sei tu.',
  'Riposa, amore mio: te lo sei meritato.',
  'Se potessi scegliere di nuovo, sceglierei sempre te.',
  'Non vedo l ora di invadere il tuo spazio vitale',
  'Sei il mio pensiero più bello, ogni minuto.',
  'Insieme a te tutto ha senso.',
  'Non sarò un coniglio, ma non vedo l ora di abbracciarti',
];

export function randomLovePhrase(exclude) {
  const pool = LOVE_PHRASES.filter((p) => p !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
