/**
 * ISO/IEC 18004 Compliant QR Code Engine for National Legal Metrology Platform.
 * Generates genuine, scannable QR Code matrices and SVG data for mobile scanning.
 */

import QRCode from 'qrcode';

/**
 * Generates a real boolean matrix representing standard QR Code modules.
 */
export function generateDeterministicMatrix(text: string, _size = 25): boolean[][] {
  try {
    const qr = QRCode.create(text || 'TOKEN-VERIFIED', {
      errorCorrectionLevel: 'M',
    });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const matrix: boolean[][] = [];
    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        row.push(Boolean(data[r * size + c]));
      }
      matrix.push(row);
    }
    return matrix;
  } catch (err) {
    console.error('Failed to generate standard QR matrix, using fallback', err);
    return Array.from({ length: 25 }, () => Array(25).fill(false));
  }
}

/**
 * Generates an SVG string of a compliant QR Code.
 */
export async function generateQrSvg(text: string): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#0B1E36',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR SVG', err);
    return '';
  }
}

/**
 * Generates a Data URL (base64 image) of a compliant QR Code.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      color: {
        dark: '#0B1E36',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR Data URL', err);
    return '';
  }
}
