// Where everything sits. Units are metres; +x is east, +z is south, the ground is y = 0.

export const HALF = 250; // the playable area is a square from -HALF to +HALF

// The canal runs north-south. Like most Punjab canals it sits between raised earth banks.
export const CANAL = { x: -60, water: 6.6, bankIn: 7.5, bankOut: 12, toe: 18, h: 1.2, waterY: 0.7 };

export const BRIDGES = [
  { z: 20, half: 3.0, deck: 1.7, span: 9, approach: 32, kind: 'brick' },
  { z: 170, half: 5.0, deck: 1.7, span: 9, approach: 40, kind: 'road' },
];

// The paved road runs east-west. It is straight over the canal bridge and past the adda
// (between `calm[0]` and `calm[1]`) and drifts north and south by up to `bend` elsewhere.
export const ROAD = { z: 170, half: 3.6, bend: 4, calm: [-112, 132] };

// Lanes are drawn between two end points but wander sideways by up to `bend` metres, the way
// a cart track does. They run straight where they meet another lane (`pins`, measured along
// the lane from its first point) and on bridge approaches.
export const LANES = [
  { id: 'main', pts: [[-92, 20], [152, 20]], w: 4.2, kind: 'brick', bend: 2.6, pins: [83, 152, 214], calm: [[0, 66], [180, 214]] },
  { id: 'west', pts: [[-248, 20], [-92, 20]], w: 4, kind: 'dirt', bend: 2.6 },
  { id: 'link', pts: [[60, 22], [60, 166.4]], w: 4.4, kind: 'dirt', bend: 2.2, pins: [0] },
  { id: 'back', pts: [[-9, -20], [124, -20]], w: 4, kind: 'dirt', bend: 2.4, pins: [0, 131] },
  { id: 'east', pts: [[122, -44], [122, 62]], w: 4, kind: 'dirt', bend: 2.2, pins: [24, 64] },
  { id: 'conn', pts: [[-9, -20], [-9, 18]], w: 3.6, kind: 'dirt', bend: 1.0 },
  { id: 'tw', pts: [[-124, 22], [-124, 42]], w: 3.2, kind: 'dirt', bend: 1.2 },
];

// Walled family compounds. (x, z) is the centre, w runs along the street, d is the depth,
// face is the side the gate opens on. Most families live behind mud walls; only the better-off
// have built in brick. The village nudges each compound to follow the bend of its lane (see
// compoundFrame in world/village.js), so these are only where they would stand on a straight one.
export const COMPOUNDS = [
  { id: 'A', x: 10, z: 3, w: 26, d: 26, face: 's', wall: 'mud', animals: ['buffalo', 'buffalo'] },
  { id: 'B', x: 36, z: 3, w: 22, d: 26, face: 's', wall: 'mud', animals: ['cow'] },
  { id: 'C', x: 140, z: 3, w: 26, d: 26, face: 'w', wall: 'mud', animals: ['buffalo', 'cow'] },
  { id: 'D', x: -2, z: 37, w: 24, d: 26, face: 'n', wall: 'mud', animals: ['goat', 'goat'] },
  { id: 'E', x: 24, z: 37, w: 24, d: 26, face: 'n', wall: 'mud', animals: ['buffalo'] },
  { id: 'HOME', x: 46, z: 37, w: 18, d: 26, face: 'n', wall: 'mud', animals: ['buffalo'], home: true },
  { id: 'H', x: 76, z: 37, w: 24, d: 26, face: 'n', wall: 'mud', animals: ['cow', 'goat'] },
  { id: 'I', x: 102, z: 37, w: 24, d: 26, face: 'n', wall: 'brick', animals: ['buffalo', 'buffalo'] },
  { id: 'J', x: 140, z: 37, w: 26, d: 26, face: 'w', wall: 'mud', animals: ['goat'] },
  { id: 'K', x: 44, z: 64, w: 24, d: 24, face: 'e', wall: 'mud', animals: ['cow'] },
  { id: 'L', x: 76, z: 64, w: 24, d: 24, face: 'w', wall: 'mud', animals: ['buffalo'] },
  { id: 'M', x: 10, z: -36, w: 24, d: 24, face: 's', wall: 'mud', animals: ['buffalo', 'goat'] },
  { id: 'N', x: 38, z: -36, w: 24, d: 24, face: 's', wall: 'mud', animals: ['cow'] },
  { id: 'O', x: 66, z: -36, w: 24, d: 24, face: 's', wall: 'mud', animals: ['buffalo'] },
  { id: 'P', x: 94, z: -36, w: 24, d: 24, face: 's', wall: 'mud', animals: ['goat', 'goat'] },
];

export const MOSQUE = { x: 104, z: 3, w: 28, d: 26 }; // gate on the east side, mihrab on the west (qibla)
export const CHOWK = { x: 68, z: 3 }; // village square with the banyan tree
export const POND = { x: 162, z: 78, r: 15 };
export const TUBEWELL = { x: -124, z: 52 };
export const KILN = { x: 204, z: -204 };
export const SHOPS = { z: 156, kiryana: 74, tandoor: 85.5, chai: 97, puncture: 37, busStop: 47 };

// Field blocks, each cut into nx by nz plots separated by raised mud bunds.
export const FIELD_BLOCKS = [
  { x0: -250, x1: -80, z0: -250, z1: 15, nx: 3, nz: 5 },
  { x0: -250, x1: -142, z0: 25, z1: 158, nx: 2, nz: 3 },
  { x0: -106, x1: -80, z0: 25, z1: 158, nx: 1, nz: 3 },
  { x0: -142, x1: -106, z0: 72, z1: 158, nx: 1, nz: 2, first: 'flooded' },
  { x0: -40, x1: 150, z0: -250, z1: -56, nx: 4, nz: 4 },
  { x0: 150, x1: 250, z0: -150, z1: -56, nx: 2, nz: 2 },
  { x0: -40, x1: 54, z0: 82, z1: 148, nx: 2, nz: 1 },
  { x0: -40, x1: -18, z0: 26, z1: 80, nx: 1, nz: 1, first: 'berseem' },
  { x0: 66, x1: 250, z0: 100, z1: 148, nx: 3, nz: 1 },
  { x0: 182, x1: 250, z0: -50, z1: 96, nx: 1, nz: 3 },
  { x0: -250, x1: -80, z0: 184, z1: 250, nx: 3, nz: 1 },
  { x0: -40, x1: 250, z0: 184, z1: 250, nx: 5, nz: 1 },
];

// Named places: the name fades in when the player walks into the rectangle. First match wins.
export const AREAS = [
  { id: 'home', x0: 37, x1: 55, z0: 24, z1: 50 },
  { id: 'mosque', x0: 90, x1: 121, z0: -10, z1: 16 },
  { id: 'chowk', x0: 49, x1: 89, z0: -10, z1: 17 },
  { id: 'adda', x0: 26, x1: 112, z0: 148, z1: 166 },
  { id: 'pond', x0: 140, x1: 184, z0: 58, z1: 98 },
  { id: 'tubewell', x0: -142, x1: -106, z0: 26, z1: 72 },
  { id: 'kiln', x0: 170, x1: 250, z0: -250, z1: -170 },
  { id: 'canal', x0: -78, x1: -42, z0: -250, z1: 250 },
  { id: 'road', x0: -250, x1: 250, z0: 164, z1: 176 },
  { id: 'village', x0: -16, x1: 156, z0: -50, z1: 80 },
  { id: 'fields', x0: -250, x1: 250, z0: -250, z1: 250 },
];

export const START = { x: 46, z: 20.5, yaw: Math.PI }; // on the street outside the home gate
