// Monthly report (hours + shift times, no money) drawn on a canvas,
// downloaded as PNG or as a one-page PDF that embeds the same picture.
import { paidMs, roundTime } from '@/lib/pay';

const W = 1240; // A4 width at 150 dpi
const PAD = 90;
const ROW = 44;
const INK = '#3b2a20';
const MUTED = '#8a7b70';
const LINE = '#eadfd3';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const pad2 = (n) => String(n).padStart(2, '0');
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (ms) => new Date(ms).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtHours = (ms) => {
  const m = Math.round(ms / 60000);
  return `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;
};

function draw(shifts, monthLabel, now) {
  const rows = [...shifts].sort((a, b) => a.start_at - b.start_at);
  const tableTop = 470;
  const H = Math.max(1754, tableTop + ROW * (rows.length + 2) + 120);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';

  // header
  g.fillStyle = MUTED;
  g.font = `600 26px ${FONT}`;
  g.fillText('Turni Maria', PAD, 110);
  g.fillStyle = INK;
  g.font = `700 64px ${FONT}`;
  const title = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  g.fillText(title, PAD, 180);
  g.fillStyle = MUTED;
  g.font = `400 26px ${FONT}`;
  g.fillText('Riepilogo ore e orari dei turni', PAD, 232);

  // summary boxes
  const total = rows.reduce((acc, s) => acc + paidMs(s, now), 0);
  const boxes = [['Turni', String(rows.length)], ['Ore totali', fmtHours(total)]];
  const bw = (W - PAD * 2 - 30) / 2;
  boxes.forEach(([label, value], i) => {
    const x = PAD + i * (bw + 30);
    g.fillStyle = '#fff4e6';
    g.beginPath();
    g.roundRect(x, 290, bw, 120, 20);
    g.fill();
    g.fillStyle = MUTED;
    g.font = `700 22px ${FONT}`;
    g.fillText(label.toUpperCase(), x + 30, 325);
    g.fillStyle = INK;
    g.font = `700 46px ${FONT}`;
    g.fillText(value, x + 30, 375);
  });

  // table
  const cols = [
    { label: 'Giorno', x: PAD + 20, align: 'left' },
    { label: 'Inizio', x: PAD + 520, align: 'right' },
    { label: 'Fine', x: PAD + 750, align: 'right' },
    { label: 'Ore', x: W - PAD - 20, align: 'right' },
  ];
  const cell = (text, col, y) => {
    g.textAlign = col.align;
    g.fillText(text, col.x, y);
  };

  g.fillStyle = MUTED;
  g.font = `700 22px ${FONT}`;
  cols.forEach((col) => cell(col.label.toUpperCase(), col, tableTop + ROW / 2));
  g.fillStyle = INK;
  g.fillRect(PAD, tableTop + ROW - 2, W - PAD * 2, 2);

  g.font = `400 27px ${FONT}`;
  rows.forEach((s, i) => {
    const y = tableTop + ROW * (i + 1);
    if (i % 2) {
      g.fillStyle = '#fbf7f2';
      g.fillRect(PAD, y, W - PAD * 2, ROW);
    }
    g.fillStyle = INK;
    cell(fmtDay(s.start_at), cols[0], y + ROW / 2);
    cell(fmtTime(roundTime(s.start_at)), cols[1], y + ROW / 2);
    cell(s.end_at ? fmtTime(roundTime(s.end_at)) : 'in corso', cols[2], y + ROW / 2);
    cell(fmtHours(paidMs(s, now)), cols[3], y + ROW / 2);
  });
  const end = tableTop + ROW * (rows.length + 1);
  if (!rows.length) {
    g.fillStyle = MUTED;
    g.textAlign = 'left';
    g.fillText('Nessun turno in questo mese.', PAD + 20, end + ROW / 2);
  }

  // total row
  const ty = end + (rows.length ? 0 : ROW);
  g.fillStyle = INK;
  g.fillRect(PAD, ty, W - PAD * 2, 2);
  g.font = `700 28px ${FONT}`;
  cell('Totale', cols[0], ty + ROW / 2 + 6);
  cell(fmtHours(total), cols[3], ty + ROW / 2 + 6);

  // footer
  g.textAlign = 'left';
  g.fillStyle = MUTED;
  g.font = `400 21px ${FONT}`;
  const made = new Date(now).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  g.fillText(`Orari arrotondati alla mezz'ora · Generato il ${made}`, PAD, H - 70);
  g.fillStyle = LINE;
  g.fillRect(PAD, H - 100, W - PAD * 2, 1);
  return c;
}

const toBlob = (canvas, type, q) => new Promise((ok) => canvas.toBlob(ok, type, q));

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Minimal PDF: one page, the JPEG of the canvas stretched over it (A4 width).
async function canvasToPdf(canvas) {
  const jpg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
  const pw = 595.28;
  const ph = +(pw * (canvas.height / canvas.width)).toFixed(2);
  const enc = new TextEncoder();
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    [`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, '\nendstream'],
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  const parts = [];
  let size = 0;
  const push = (p) => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); size += b.length; };
  const offsets = [];
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objs.forEach((o, i) => {
    offsets.push(size);
    push(`${i + 1} 0 obj\n`);
    (Array.isArray(o) ? o : [o]).forEach(push);
    push('\nendobj\n');
  });
  const xref = size;
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
  offsets.forEach((o) => push(`${String(o).padStart(10, '0')} 00000 n \n`));
  push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

export async function exportMonth({ shifts, monthLabel, y, m, format }) {
  const now = Date.now();
  const canvas = draw(shifts, monthLabel, now);
  const name = `turni-${y}-${pad2(m + 1)}`;
  if (format === 'png') save(await toBlob(canvas, 'image/png'), `${name}.png`);
  else save(await canvasToPdf(canvas), `${name}.pdf`);
}
