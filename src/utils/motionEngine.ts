export interface MotionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  position: 'left' | 'center' | 'right';
}

export interface MotionResult {
  regions: MotionRegion[];
  motionRatio: number;
}

export function captureFrameData(video: HTMLVideoElement): ImageData | null {
  if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function detectMotion(
  prev: ImageData,
  curr: ImageData,
  pixelThreshold = 30
): MotionResult {
  const W = curr.width;
  const H = curr.height;
  const GRID_COLS = 12;
  const GRID_ROWS = 9;
  const cellW = Math.floor(W / GRID_COLS);
  const cellH = Math.floor(H / GRID_ROWS);
  const CELL_MOTION_THRESHOLD = 0.12;

  const cellIntensity: number[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(0)
  );

  let totalMotionPx = 0;

  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      let motionPx = 0;
      const cellPixels = cellW * cellH;
      const startY = gy * cellH;
      const startX = gx * cellW;
      for (let py = startY; py < startY + cellH && py < H; py++) {
        for (let px = startX; px < startX + cellW && px < W; px++) {
          const idx = (py * W + px) * 4;
          const dr = Math.abs(curr.data[idx]     - prev.data[idx]);
          const dg = Math.abs(curr.data[idx + 1] - prev.data[idx + 1]);
          const db = Math.abs(curr.data[idx + 2] - prev.data[idx + 2]);
          if ((dr + dg + db) / 3 > pixelThreshold) motionPx++;
        }
      }
      const ratio = motionPx / cellPixels;
      cellIntensity[gy][gx] = ratio;
      if (ratio >= CELL_MOTION_THRESHOLD) totalMotionPx += motionPx;
    }
  }

  const visited: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(false)
  );
  const regions: MotionRegion[] = [];

  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      if (cellIntensity[gy][gx] >= CELL_MOTION_THRESHOLD && !visited[gy][gx]) {
        const queue: [number, number][] = [[gy, gx]];
        visited[gy][gx] = true;
        let minX = gx, maxX = gx, minY = gy, maxY = gy;
        let sumIntensity = 0;
        let count = 0;

        while (queue.length > 0) {
          const [cy, cx] = queue.shift()!;
          minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
          sumIntensity += cellIntensity[cy][cx];
          count++;
          for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const ny = cy + dy, nx = cx + dx;
            if (
              ny >= 0 && ny < GRID_ROWS && nx >= 0 && nx < GRID_COLS &&
              cellIntensity[ny][nx] >= CELL_MOTION_THRESHOLD && !visited[ny][nx]
            ) {
              visited[ny][nx] = true;
              queue.push([ny, nx]);
            }
          }
        }

        const rx = minX * cellW;
        const ry = minY * cellH;
        const rw = (maxX - minX + 1) * cellW;
        const rh = (maxY - minY + 1) * cellH;

        if (rw * rh >= 1500) {
          const centerX = rx + rw / 2;
          const pos: 'left' | 'center' | 'right' =
            centerX < W * 0.33 ? 'left' : centerX > W * 0.66 ? 'right' : 'center';
          regions.push({
            x: rx, y: ry, width: rw, height: rh,
            intensity: Math.min(1, sumIntensity / count / 0.5),
            position: pos,
          });
        }
      }
    }
  }

  return { regions, motionRatio: totalMotionPx / (W * H) };
}
