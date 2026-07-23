export const W = 45;
export const H = 60;

export const C = {
  B: '#F9E6D1', // Beige
  Y: '#FFD753', // Yellow
  G: '#3A5C34', // Green
  P: '#FCCAE2', // Pink
  D: '#5F2427', // Burgundy
};

function createGrid() {
  return Array.from({ length: H }, () => Array(W).fill('B'));
}

function rect(grid, x, y, w, h, c) {
  for (let i = y; i < y + h; i++) {
    for (let j = x; j < x + w; j++) {
      if (i >= 0 && i < H && j >= 0 && j < W) grid[i][j] = c;
    }
  }
}

function triangle(grid, cx, cy, w, h, c) {
  for (let i = 0; i < h; i++) {
    const rowW = Math.floor((i / h) * (w / 2));
    for (let j = cx - rowW; j <= cx + rowW; j++) {
      const y = cy + i;
      if (y >= 0 && y < H && j >= 0 && j < W) grid[y][j] = c;
    }
  }
}

function drawCat(grid, x, y, c, flip) {
  const cat = [
    " E E ",
    " HHH ",
    "HHHHH",
    " BBB ",
    " BBB ",
    "TBBB ",
    " T   "
  ];
  
  for (let i = 0; i < cat.length; i++) {
    for (let j = 0; j < cat[i].length; j++) {
      const char = cat[i][j];
      if (char !== ' ') {
        const px = x + (flip ? cat[i].length - 1 - j : j);
        const py = y + i;
        if (py >= 0 && py < H && px >= 0 && px < W) {
          grid[py][px] = c;
          if (i === 2 && (j === 1 || j === 3)) {
            grid[py][px] = c === 'D' ? 'B' : 'D';
          }
        }
      }
    }
  }
}

export function getScene1() {
  const grid = createGrid();
  rect(grid, 0, 0, W, 8, 'P');
  rect(grid, 0, 8, W, 12, 'B');
  triangle(grid, 12, 6, 40, 30, 'D'); 
  triangle(grid, 35, 8, 36, 28, 'Y'); 
  triangle(grid, 22, 16, 45, 25, 'G'); 
  triangle(grid, 8, 20, 25, 20, 'G'); 
  rect(grid, 0, 35, W, 25, 'D');

  // Map
  for (let i = 0; i < 10; i++) {
    const startX = 12 - Math.floor(i / 2);
    const endX = 32 + Math.floor(i / 2);
    for (let j = startX; j <= endX; j++) {
      const y = 42 + i;
      if (y >= 0 && y < H && j >= 0 && j < W) {
        grid[y][j] = 'B';
        if ((i * 7 + j * 3) % 11 < 2) grid[y][j] = 'G';
      }
    }
  }

  drawCat(grid, 4, 34, 'B', false); 
  drawCat(grid, 14, 30, 'Y', false); 
  drawCat(grid, 26, 31, 'Y', true); 
  drawCat(grid, 34, 28, 'P', true); 
  drawCat(grid, 32, 38, 'D', true); 
  drawCat(grid, 24, 44, 'P', true); 
  drawCat(grid, 12, 45, 'Y', false); 

  return grid.flat();
}

export function getScene2() {
  const grid = createGrid();
  // Organize: Folders and boxes
  rect(grid, 0, 0, W, H, 'B');
  rect(grid, 0, 40, W, 20, 'G');
  
  // Shelves
  rect(grid, 5, 10, 35, 2, 'D');
  rect(grid, 5, 25, 35, 2, 'D');
  
  // Folders
  rect(grid, 8, 4, 6, 6, 'Y');
  rect(grid, 15, 5, 6, 5, 'P');
  rect(grid, 25, 3, 6, 7, 'G');
  
  rect(grid, 10, 18, 8, 7, 'P');
  rect(grid, 20, 19, 8, 6, 'Y');
  
  drawCat(grid, 6, 33, 'Y', false);
  drawCat(grid, 28, 33, 'D', true);
  drawCat(grid, 18, 45, 'P', false);
  
  return grid.flat();
}

export function getScene3() {
  const grid = createGrid();
  // Style: Painting, palette
  rect(grid, 0, 0, W, H, 'P');
  rect(grid, 0, 45, W, 15, 'D');
  
  // Canvas
  rect(grid, 10, 10, 25, 20, 'B');
  rect(grid, 12, 12, 21, 16, 'Y');
  
  // Palette
  rect(grid, 25, 35, 12, 8, 'B');
  rect(grid, 27, 37, 2, 2, 'G');
  rect(grid, 30, 37, 2, 2, 'D');
  rect(grid, 33, 37, 2, 2, 'P');
  
  drawCat(grid, 8, 38, 'Y', false);
  drawCat(grid, 18, 38, 'G', false);
  
  return grid.flat();
}

export function getScene4() {
  const grid = createGrid();
  // Act: Rocket launch
  rect(grid, 0, 0, W, H, 'D');
  
  // Stars
  for(let i=0; i<30; i++) {
    grid[Math.floor(Math.random()*40)][Math.floor(Math.random()*W)] = 'B';
  }
  
  // Rocket
  triangle(grid, 22, 10, 10, 10, 'Y');
  rect(grid, 18, 20, 9, 20, 'B');
  rect(grid, 20, 25, 5, 5, 'P'); // Window
  triangle(grid, 14, 30, 8, 10, 'Y');
  triangle(grid, 23, 30, 8, 10, 'Y');
  
  // Flames
  triangle(grid, 22, 40, 8, 15, 'P');
  triangle(grid, 22, 42, 4, 10, 'Y');
  
  drawCat(grid, 5, 45, 'Y', false);
  drawCat(grid, 35, 45, 'P', true);
  
  return grid.flat();
}

export const scenes = [
  { id: 'strategize', title: 'Strategize', description: 'Plan your next big move with precision.', data: getScene1() },
  { id: 'organize', title: 'Organize', description: 'Keep your ideas structured and accessible.', data: getScene2() },
  { id: 'style', title: 'Style', description: 'Design with the signature Sosa aesthetic.', data: getScene3() },
  { id: 'act', title: 'Act', description: 'Execute your vision and launch.', data: getScene4() }
];
