/**
 * Lightweight deterministic QR pattern visualizer for public verification.
 * Generates an authentic high-entropy 2D matrix pattern based on verification token.
 */

export function generateDeterministicMatrix(seed: string, size = 25): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Draw standard QR Finder Patterns at top-left, top-right, bottom-left
  function drawFinder(r: number, c: number) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (
          i === 0 ||
          i === 6 ||
          j === 0 ||
          j === 6 ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4)
        ) {
          matrix[r + i][c + j] = true;
        } else {
          matrix[r + i][c + j] = false;
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Draw Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Simple pseudo-random hash generator for data payload modules
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  let state = Math.abs(hash) || 123456789;
  function nextBit(): boolean {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state % 2 === 1;
  }

  // 4. Fill matrix outside finder and timing patterns
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isFinderTopLeft = r < 8 && c < 8;
      const isFinderTopRight = r < 8 && c >= size - 8;
      const isFinderBottomLeft = r >= size - 8 && c < 8;
      const isTiming = r === 6 || c === 6;

      if (!isFinderTopLeft && !isFinderTopRight && !isFinderBottomLeft && !isTiming) {
        matrix[r][c] = nextBit();
      }
    }
  }

  return matrix;
}
