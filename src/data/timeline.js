// The stops on the career timeline popup, oldest first. The last one is "where I am now".
// prop: which little pixel drawing sits in the bubble (see src/ui/pixelArt.js).
// color: which cube colour the stop's dot fills with.
export const timeline = [
  {
    role: 'Administrative Assistant',
    place: 'Concord Concrete Pumps',
    dates: 'June 2023 to August 2025',
    prop: 'desk',
    color: 'red',
  },
  {
    role: 'Junior Web Developer',
    place: 'Concord Concrete Pumps',
    dates: 'April 2026 to November 2026',
    prop: 'monitor',
    color: 'blue',
  },
  {
    role: '2nd Year Student',
    place: 'UBC',
    dates: 'Now',
    prop: 'campus',
    color: 'green',
    now: true, // the pixel student stops here, and this bubble is yellow
  },
];
