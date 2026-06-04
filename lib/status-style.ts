import { STATUS_COLOR_MAP } from "@/lib/constants";

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return { r: 255, g: 255, b: 255 };
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function readableTextColor(background: string) {
  const { r, g, b } = hexToRgb(background);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#1f2937" : "#ffffff";
}

export function statusStyle(status: string) {
  const background = STATUS_COLOR_MAP[status] ?? "#e5e7eb";
  return {
    backgroundColor: background,
    color: readableTextColor(background),
    borderColor: background,
  };
}

export function statusCardStyle(status: string) {
  const background = STATUS_COLOR_MAP[status] ?? "#f8fafc";
  return {
    borderLeftColor: background,
  };
}
