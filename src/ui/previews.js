// Tiny drawn previews for the hover card: a simple picture of what each project's screen is like.
// They are sketches made of plain shapes, with no real data in them.
// A project picks one with its `preview` field in projects.js.
// Colours: "currentColor" is cream, var(--card-theme) is the face colour.
const frame = (inner) => `
  <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${inner}
  </svg>`;

const sketches = {
  // Columns of cards, like stages on a production board.
  board: frame(`
    <g fill="currentColor">
      <rect x="10" y="10" width="28" height="5" rx="2.5" opacity=".55"/>
      <rect x="46" y="10" width="28" height="5" rx="2.5" opacity=".55"/>
      <rect x="82" y="10" width="28" height="5" rx="2.5" opacity=".55"/>
      <rect x="10" y="21" width="28" height="14" rx="4"/>
      <rect x="10" y="39" width="28" height="14" rx="4"/>
      <rect x="10" y="57" width="28" height="14" rx="4" opacity=".4"/>
      <rect x="46" y="39" width="28" height="14" rx="4"/>
      <rect x="82" y="21" width="28" height="14" rx="4"/>
      <rect x="82" y="39" width="28" height="14" rx="4" opacity=".4"/>
    </g>
    <rect x="46" y="21" width="28" height="14" rx="4" fill="var(--card-theme)"/>`),

  // A barcode beside a short stock list.
  barcode: frame(`
    <g fill="currentColor">
      <rect x="10" y="14" width="3" height="40"/>
      <rect x="16" y="14" width="1.5" height="40"/>
      <rect x="20" y="14" width="4" height="40"/>
      <rect x="27" y="14" width="1.5" height="40"/>
      <rect x="31" y="14" width="2.5" height="40"/>
      <rect x="36" y="14" width="4" height="40"/>
      <rect x="43" y="14" width="1.5" height="40"/>
      <rect x="47" y="14" width="3" height="40"/>
      <rect x="10" y="60" width="40" height="5" rx="2.5" opacity=".55"/>
      <rect x="62" y="14" width="34" height="6" rx="3"/>
      <rect x="62" y="32" width="28" height="6" rx="3"/>
      <rect x="62" y="50" width="34" height="6" rx="3" opacity=".4"/>
      <rect x="102" y="32" width="8" height="6" rx="3" opacity=".55"/>
      <rect x="102" y="50" width="8" height="6" rx="3" opacity=".4"/>
    </g>
    <rect x="100" y="12" width="12" height="10" rx="4" fill="var(--card-theme)"/>`),

  // A grid of products.
  shop: frame(`
    <g fill="currentColor">
      <rect x="10" y="10" width="28" height="20" rx="5"/>
      <rect x="82" y="10" width="28" height="20" rx="5"/>
      <rect x="10" y="44" width="28" height="20" rx="5" opacity=".4"/>
      <rect x="46" y="44" width="28" height="20" rx="5"/>
      <rect x="82" y="44" width="28" height="20" rx="5" opacity=".4"/>
      <rect x="10" y="33" width="18" height="4" rx="2" opacity=".55"/>
      <rect x="46" y="33" width="18" height="4" rx="2" opacity=".55"/>
      <rect x="82" y="33" width="18" height="4" rx="2" opacity=".55"/>
      <rect x="10" y="67" width="18" height="4" rx="2" opacity=".55"/>
      <rect x="46" y="67" width="18" height="4" rx="2" opacity=".55"/>
      <rect x="82" y="67" width="18" height="4" rx="2" opacity=".55"/>
    </g>
    <rect x="46" y="10" width="28" height="20" rx="5" fill="var(--card-theme)"/>`),

  // One item with its details and a button.
  listing: frame(`
    <g fill="currentColor">
      <rect x="10" y="10" width="50" height="60" rx="7"/>
      <rect x="68" y="12" width="42" height="7" rx="3.5"/>
      <rect x="68" y="25" width="30" height="5" rx="2.5" opacity=".55"/>
      <rect x="68" y="35" width="36" height="5" rx="2.5" opacity=".4"/>
      <rect x="68" y="45" width="24" height="5" rx="2.5" opacity=".4"/>
    </g>
    <rect x="68" y="57" width="34" height="13" rx="6.5" fill="var(--card-theme)"/>`),
};

export const previewSketch = (kind) => sketches[kind] ?? '';
