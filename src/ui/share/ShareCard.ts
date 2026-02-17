import { Container, Graphics, Text } from 'pixi.js';
import type { DifficultyMode } from '../../meta/Difficulty';

export interface ShareCardData {
  mode: 'DAILY' | 'NORMAL';
  dateKey: string | null;
  score: number;
  difficulty: DifficultyMode;
  nodesCleared: number;
  wins: number;
  timeSec: number;
  casualtiesPct: number;
  perks: string[];
  seed: number;
  packName: string;
  packVersion: string;
  urlPath: string;
}

export const SHARE_CARD_WIDTH = 900;
export const SHARE_CARD_HEIGHT = 500;

function formatDurationShort(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function formatPercent(value01: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value01)) * 100)}%`;
}

function difficultyLabel(value: DifficultyMode): string {
  return value === 'HARD' ? 'Hard' : 'Normal';
}

function buildPerkLines(perks: readonly string[], maxLineChars: number, maxLines: number): string[] {
  if (perks.length === 0) {
    return ['None'];
  }

  const lines: string[] = [''];
  let used = 0;
  for (let i = 0; i < perks.length; i += 1) {
    const token = lines[lines.length - 1].length === 0 ? perks[i] : `, ${perks[i]}`;
    if (lines[lines.length - 1].length + token.length <= maxLineChars) {
      lines[lines.length - 1] += token;
      used += 1;
      continue;
    }

    if (lines.length >= maxLines) {
      break;
    }

    lines.push(perks[i]);
    used += 1;
  }

  if (used < perks.length) {
    const remaining = perks.length - used;
    const suffix = ` +${remaining} more`;
    const lineIndex = lines.length - 1;
    if (lines[lineIndex].length + suffix.length <= maxLineChars) {
      lines[lineIndex] += suffix;
    } else if (suffix.length >= maxLineChars) {
      lines[lineIndex] = suffix.slice(0, maxLineChars);
    } else {
      const trimLen = Math.max(0, maxLineChars - suffix.length);
      lines[lineIndex] = `${lines[lineIndex].slice(0, trimLen).trimEnd()}${suffix}`;
    }
  }

  return lines;
}

export function buildShareResultText(data: ShareCardData): string {
  const header =
    data.mode === 'DAILY' && data.dateKey !== null
      ? `NIZAM Daily Challenge - ${data.dateKey} (SG)`
      : 'NIZAM Run Result';
  const perksText = data.perks.length > 0 ? data.perks.join(', ') : 'None';

  return [
    header,
    `Score: ${Math.max(0, Math.floor(data.score))} (${difficultyLabel(data.difficulty)})`,
    `Nodes: ${Math.max(0, Math.floor(data.nodesCleared))} | Wins: ${Math.max(0, Math.floor(data.wins))} | Casualties: ${formatPercent(data.casualtiesPct)} | Time: ${formatDurationShort(data.timeSec)}`,
    `Perks: ${perksText}`,
    `Seed: ${data.seed >>> 0} | Pack: ${data.packName} v${data.packVersion}`,
  ].join('\n');
}

export function createShareCardContainer(data: ShareCardData): Container {
  const root = new Container();
  root.position.set(0, 0);

  const bg = new Graphics();
  bg.roundRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT, 20);
  bg.fill({ color: 0x0e1624, alpha: 1 });
  bg.stroke({ color: 0x5f88b8, alpha: 0.95, width: 3 });
  root.addChild(bg);

  const topBand = new Graphics();
  topBand.roundRect(20, 20, SHARE_CARD_WIDTH - 40, 84, 12);
  topBand.fill({ color: 0x18263b, alpha: 0.95 });
  topBand.stroke({ color: 0x7cb1e8, alpha: 0.85, width: 1.4 });
  root.addChild(topBand);

  const title = new Text({
    text: data.mode === 'DAILY' ? 'NIZAM Daily Challenge' : 'NIZAM Run Result',
    style: {
      fill: 0xf8e6bd,
      fontFamily: 'monospace',
      fontSize: 36,
      fontWeight: 'bold',
    },
  });
  title.position.set(36, 36);
  root.addChild(title);

  const date = new Text({
    text: `Date (SG): ${data.dateKey ?? '-'}`,
    style: {
      fill: 0xb7d8ff,
      fontFamily: 'monospace',
      fontSize: 18,
    },
  });
  date.position.set(36, 78);
  root.addChild(date);

  const scoreLabel = new Text({
    text: 'Score',
    style: {
      fill: 0x9cc7ff,
      fontFamily: 'monospace',
      fontSize: 18,
    },
  });
  scoreLabel.position.set(36, 132);
  root.addChild(scoreLabel);

  const scoreText = new Text({
    text: `${Math.max(0, Math.floor(data.score))}`,
    style: {
      fill: 0xf9d88d,
      fontFamily: 'monospace',
      fontSize: 72,
      fontWeight: 'bold',
    },
  });
  scoreText.position.set(36, 152);
  root.addChild(scoreText);

  const rowOne = new Text({
    text: `Difficulty: ${difficultyLabel(data.difficulty)}   |   Nodes: ${Math.max(0, Math.floor(data.nodesCleared))}   |   Wins: ${Math.max(0, Math.floor(data.wins))}`,
    style: {
      fill: 0xdbe8fa,
      fontFamily: 'monospace',
      fontSize: 22,
    },
  });
  rowOne.position.set(36, 262);
  root.addChild(rowOne);

  const rowTwo = new Text({
    text: `Time: ${formatDurationShort(data.timeSec)}   |   Casualties: ${formatPercent(data.casualtiesPct)}`,
    style: {
      fill: 0xdbe8fa,
      fontFamily: 'monospace',
      fontSize: 22,
    },
  });
  rowTwo.position.set(36, 300);
  root.addChild(rowTwo);

  const perksLabel = new Text({
    text: 'Perks',
    style: {
      fill: 0xa8cdf8,
      fontFamily: 'monospace',
      fontSize: 17,
    },
  });
  perksLabel.position.set(36, 352);
  root.addChild(perksLabel);

  const perkLines = buildPerkLines(data.perks, 78, 2);
  const perksBody = new Text({
    text: perkLines.join('\n'),
    style: {
      fill: 0xeaf2ff,
      fontFamily: 'monospace',
      fontSize: 18,
      lineHeight: 28,
    },
  });
  perksBody.position.set(36, 378);
  root.addChild(perksBody);

  const footerLine = new Graphics();
  footerLine.moveTo(26, SHARE_CARD_HEIGHT - 52);
  footerLine.lineTo(SHARE_CARD_WIDTH - 26, SHARE_CARD_HEIGHT - 52);
  footerLine.stroke({ color: 0x446487, alpha: 0.9, width: 1.2 });
  root.addChild(footerLine);

  const footer = new Text({
    text: `Seed: ${data.seed >>> 0}   |   Pack: ${data.packName} v${data.packVersion}   |   ${data.urlPath}`,
    style: {
      fill: 0x9fbcdb,
      fontFamily: 'monospace',
      fontSize: 14,
    },
  });
  footer.position.set(32, SHARE_CARD_HEIGHT - 36);
  root.addChild(footer);

  return root;
}
