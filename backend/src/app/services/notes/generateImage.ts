import fs from "fs";
import path from "path";

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hashString(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function splitTitle(text: string, maxCharsPerLine = 18) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 4);
}

function buildCoverSvg(title: string, noteId: string) {
  const safeTitle = title.trim() || "Notebook";
  const lines = splitTitle(safeTitle);
  const seed = hashString(`${noteId}:${safeTitle}`);
  const hue = seed % 360;
  const hue2 = (hue + 42) % 360;
  const hue3 = (hue + 118) % 360;
  const topY = 145 - (lines.length - 1) * 18;

  const textLines = lines
    .map((line, index) => {
      const y = topY + index * 36;
      return `<text x="72" y="${y}" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escapeXml(safeTitle)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hue} 72% 22%)" />
      <stop offset="55%" stop-color="hsl(${hue2} 64% 18%)" />
      <stop offset="100%" stop-color="hsl(${hue3} 56% 13%)" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)" />
  <circle cx="1260" cy="180" r="360" fill="url(#glow)" opacity="0.35" />
  <circle cx="240" cy="720" r="260" fill="rgba(255,255,255,0.08)" />
  <rect x="72" y="72" width="220" height="10" rx="5" fill="rgba(255,255,255,0.38)" />
  <rect x="72" y="96" width="120" height="6" rx="3" fill="rgba(255,255,255,0.22)" />
  ${textLines}
  <text x="72" y="820" fill="rgba(255,255,255,0.72)" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="500">Notebook cover</text>
</svg>`;
}

export async function generateImage(
  prompt: string,
  noteId: string,
): Promise<string> {
  const publicDir = path.join(process.cwd(), "public", "notes");
  fs.mkdirSync(publicDir, { recursive: true });

  const fileName = `${noteId}.svg`;
  const filePath = path.join(publicDir, fileName);

  const svg = buildCoverSvg(prompt, noteId);
  fs.writeFileSync(filePath, svg, "utf8");

  return `/public/notes/${fileName}`;
}
