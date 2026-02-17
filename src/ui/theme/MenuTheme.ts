import { Graphics } from 'pixi.js';

export const MENU_TITLE_FONT = 'Georgia, Times New Roman, serif';
export const MENU_BODY_FONT = 'Trebuchet MS, Segoe UI, sans-serif';
export const MENU_MONO_FONT = 'Consolas, Menlo, monospace';

interface MenuCardOptions {
  radius?: number;
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  borderWidth?: number;
  sheen?: boolean;
}

const DEFAULT_CARD_OPTIONS: Required<MenuCardOptions> = {
  radius: 12,
  fillColor: 0x121e2b,
  fillAlpha: 0.96,
  borderColor: 0x7fa9cd,
  borderAlpha: 0.88,
  borderWidth: 1.6,
  sheen: true,
};

export function drawMenuBackdrop(graphics: Graphics, width: number, height: number): void {
  graphics.clear();
  graphics.rect(0, 0, width, height);
  graphics.fill({ color: 0x0a1219, alpha: 1 });

  graphics.circle(width * 0.16, height * 0.16, Math.max(150, width * 0.16));
  graphics.fill({ color: 0x1f3d56, alpha: 0.22 });

  graphics.circle(width * 0.88, height * 0.2, Math.max(130, width * 0.11));
  graphics.fill({ color: 0x5a3f2b, alpha: 0.18 });

  for (let i = 0; i < 8; i += 1) {
    const y = height * (0.1 + i * 0.11);
    graphics.moveTo(0, y);
    graphics.lineTo(width, y - 36);
  }
  graphics.stroke({ color: 0x95b8d7, alpha: 0.06, width: 1 });
}

export function drawMenuCard(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: MenuCardOptions,
): void {
  const resolved = { ...DEFAULT_CARD_OPTIONS, ...(options ?? {}) };

  graphics.clear();
  graphics.roundRect(x, y, width, height, resolved.radius);
  graphics.fill({ color: resolved.fillColor, alpha: resolved.fillAlpha });
  graphics.stroke({
    color: resolved.borderColor,
    alpha: resolved.borderAlpha,
    width: resolved.borderWidth,
  });

  if (resolved.sheen) {
    graphics.roundRect(
      x + 2,
      y + 2,
      width - 4,
      Math.max(18, Math.min(height * 0.22, 74)),
      Math.max(6, resolved.radius - 2),
    );
    graphics.fill({ color: 0xffffff, alpha: 0.04 });
  }
}

export function styleCodeTextArea(area: HTMLTextAreaElement): void {
  area.style.fontFamily = MENU_MONO_FONT;
  area.style.fontSize = '12px';
  area.style.background = '#0f1a24';
  area.style.color = '#d4e7ff';
  area.style.border = '1px solid #7fa7cb';
  area.style.borderRadius = '10px';
  area.style.padding = '10px';
  area.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
  area.style.resize = 'none';
}
