import path from "node:path";

const WORK_SUFFIXES = [
  /_정리본$/u,
  /_최종본$/u,
  /_최종$/u,
  /_arranged$/iu,
];

export function sanitizeSourceFileName(input, fallback = "source") {
  const value = String(input ?? "")
    .normalize("NFC")
    .replace(/[^\p{Script=Hangul}A-Za-z0-9_.\-\s]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return (value || fallback).slice(0, 80);
}

export function deriveSourceFileName(sourcePath, explicit = "") {
  if (explicit) return sanitizeSourceFileName(explicit);
  const normalizedPath = String(sourcePath ?? "").replaceAll("\\", "/");
  const base = path.posix.basename(normalizedPath, path.posix.extname(normalizedPath));
  const withoutWorkSuffix = WORK_SUFFIXES.reduce((value, suffix) => value.replace(suffix, ""), base);
  return sanitizeSourceFileName(withoutWorkSuffix);
}
