import { plan } from '../src/ui/icons/glyphs.ts';

function paintAttrs(p, color) {
  return `d="${p.d}" fill="${p.fill ? color : 'none'}" stroke="${p.stroke ? color : 'none'}" stroke-width="${p.width}"`;
}

export function glyphSvg(name, variant, size, color, x, y, id) {
  const { rotate, masked, cutouts, over } = plan(name, variant, size);
  const common = 'stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"';
  const mask = cutouts.length
    ? `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>${cutouts
        .map((p) => `<path ${paintAttrs(p, '#000')} ${common}/>`)
        .join('')}</mask>`
    : '';
  const body = masked.map((p) => `<path ${paintAttrs(p, color)} ${common}/>`).join('');
  const top = over.map((p) => `<path ${paintAttrs(p, color)} ${common}/>`).join('');
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" overflow="visible">${mask}<g transform="rotate(${rotate} 12 12)"><g${
    cutouts.length ? ` mask="url(#${id})"` : ''
  }>${body}</g>${top}</g></svg>`;
}
