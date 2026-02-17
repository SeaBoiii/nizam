import type { Container, Renderer } from 'pixi.js';

type CanvasLike = {
  toBlob?: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void;
  toDataURL?: (type?: string, quality?: number) => string;
  convertToBlob?: (options?: { type?: string; quality?: number }) => Promise<Blob>;
};

function dataUrlToBlob(dataUrl: string): Blob | null {
  const parts = dataUrl.split(',');
  if (parts.length !== 2) {
    return null;
  }
  const header = parts[0];
  const body = parts[1];
  const mimeMatch = /data:(.*?);base64/.exec(header);
  if (mimeMatch === null) {
    return null;
  }
  try {
    const binary = atob(body);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeMatch[1] || 'image/png' });
  } catch {
    return null;
  }
}

async function canvasToBlob(canvasLike: CanvasLike): Promise<Blob | null> {
  if (typeof canvasLike.convertToBlob === 'function') {
    try {
      return await canvasLike.convertToBlob({ type: 'image/png' });
    } catch {
      // continue with other fallbacks
    }
  }

  if (typeof canvasLike.toBlob === 'function') {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvasLike.toBlob?.((value) => resolve(value), 'image/png');
    });
    if (blob !== null) {
      return blob;
    }
  }

  if (typeof canvasLike.toDataURL === 'function') {
    const dataUrl = canvasLike.toDataURL('image/png');
    return dataUrlToBlob(dataUrl);
  }

  return null;
}

export async function exportShareCardPNG(renderer: Renderer, cardContainer: Container): Promise<Blob> {
  const canvasLike = renderer.extract.canvas({
    target: cardContainer,
    antialias: true,
    clearColor: '#0d1522',
  }) as unknown as CanvasLike;

  const blob = await canvasToBlob(canvasLike);
  if (blob !== null) {
    return blob;
  }

  const base64 = await renderer.extract.base64({
    target: cardContainer,
    format: 'png',
  });
  const fallbackBlob = dataUrlToBlob(base64);
  if (fallbackBlob !== null) {
    return fallbackBlob;
  }

  throw new Error('Unable to export share card PNG.');
}
