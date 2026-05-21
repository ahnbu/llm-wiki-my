import assert from "node:assert/strict";
import { deriveSourceFileName, sanitizeSourceFileName } from "../scripts/lib/source-file-name.mjs";

assert.equal(
  deriveSourceFileName("C:/Users/ahnbu/cowork/06_연구/= e북 제작/프로덕트개발_2024_정리본.md"),
  "프로덕트개발_2024"
);
assert.equal(
  deriveSourceFileName("C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/아이디어불패_2020f_정리본.md"),
  "아이디어불패_2020f"
);
assert.equal(
  deriveSourceFileName("C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/프롬프트텔링_2025f_최종본.md"),
  "프롬프트텔링_2025f"
);
assert.equal(sanitizeSourceFileName(" 프로덕트 개발 2024 "), "프로덕트-개발-2024");
assert.equal(sanitizeSourceFileName("ebook-product-dev-2024"), "ebook-product-dev-2024");

console.log("PASS: source file name");
