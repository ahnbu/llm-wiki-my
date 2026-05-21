#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { analyzeMarkdownSplit } from "./lib/markdown-split-units.mjs";

function parseArgs(argv) {
  const args = { sources: [], levels: [2, 3], softLimit: 20_000, hardLimit: 30_000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") args.sources.push(argv[++index]);
    else if (arg === "--levels") args.levels = argv[++index].split(",").map((value) => Number(value.trim()));
    else if (arg === "--soft-limit") args.softLimit = Number(argv[++index]);
    else if (arg === "--hard-limit") args.hardLimit = Number(argv[++index]);
    else if (arg === "--manifest") args.manifest = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.sources.length === 0) {
    throw new Error(
      "Usage: node scripts/recommend-markdown-split.mjs --source <file.md> [--source <file2.md>] [--levels 2,3] [--soft-limit 20000] [--hard-limit 30000] [--manifest <manifest.json>]"
    );
  }
  if (args.levels.some((level) => !Number.isInteger(level) || level < 1 || level > 6)) {
    throw new Error("--levels must be a comma-separated list of heading levels from 1 to 6");
  }
  if (!Number.isFinite(args.softLimit) || !Number.isFinite(args.hardLimit)) {
    throw new Error("--soft-limit and --hard-limit must be numbers");
  }
  return args;
}

function sourceKeyFrom(sourcePath) {
  return path.basename(sourcePath, path.extname(sourcePath));
}

function levelStats(levels, level) {
  const result = levels.find((item) => item.level === level);
  return result?.effective || {
    count: 0,
    averageCharCount: 0,
    maxCharCount: 0,
    overSoftCount: 0,
    overHardCount: 0,
  };
}

function rawCount(levels, level) {
  return levels.find((item) => item.level === level)?.rawHeadingCount || 0;
}

function formatRecommendation(recommendation) {
  if (!recommendation.defaultLevel) return "none";
  const suffix = recommendation.exceptionSplitTargets.length ? " + exception" : "";
  return `H${recommendation.defaultLevel}${suffix}`;
}

function reportTable(rows) {
  const lines = [
    "| file | H2 raw/effective | H2 avg | H2 max | H2 >20K/>30K | H3 raw/effective | H3 avg | H3 max | H3 >20K/>30K | 권장 기준 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
  ];
  for (const row of rows) {
    const h2 = levelStats(row.levels, 2);
    const h3 = levelStats(row.levels, 3);
    lines.push(
      `| ${row.file} | ${rawCount(row.levels, 2)}/${h2.count} | ${h2.averageCharCount} | ${h2.maxCharCount} | ${h2.overSoftCount}/${h2.overHardCount} | ${rawCount(row.levels, 3)}/${h3.count} | ${h3.averageCharCount} | ${h3.maxCharCount} | ${h3.overSoftCount}/${h3.overHardCount} | ${formatRecommendation(row.recommendation)} |`
    );
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sources = [];
  const rows = [];

  for (const source of args.sources) {
    const sourcePath = path.resolve(source);
    const markdown = await fs.readFile(sourcePath, "utf8");
    const analysis = analyzeMarkdownSplit(markdown, {
      levels: args.levels,
      softLimit: args.softLimit,
      hardLimit: args.hardLimit,
    });
    const sourceEntry = {
      sourcePath: sourcePath.replaceAll("\\", "/"),
      sourceKey: sourceKeyFrom(sourcePath),
      analyzedHeadingLevels: analysis.manifest.analyzedHeadingLevels,
      rawHeadingStats: analysis.manifest.rawHeadingStats,
      effectiveSplitUnitStats: analysis.manifest.effectiveSplitUnitStats,
      defaultSplitLevel: analysis.manifest.defaultSplitLevel,
      exceptionSplitTargets: analysis.manifest.exceptionSplitTargets,
      generatedPartLabels: analysis.manifest.generatedPartLabels,
      parentHeadingContext: analysis.manifest.parentHeadingContext,
      limitFlags: analysis.manifest.limitFlags,
      recommendation: analysis.recommendation,
      levels: analysis.levels.map((level) => ({
        level: level.level,
        rawHeadingCount: level.rawHeadingCount,
        effectiveUnitCount: level.effectiveUnitCount,
        raw: level.raw,
        effective: level.effective,
      })),
      manifestFields: [
        "source path",
        "source key",
        "analyzed heading levels",
        "raw heading stats",
        "effective split unit stats",
        "default split level",
        "exception split targets",
        "generated part labels",
        "parent heading context",
        "soft/hard limit flags",
      ],
    };
    sources.push(sourceEntry);
    rows.push({
      file: path.basename(sourcePath),
      levels: analysis.levels,
      recommendation: analysis.recommendation,
    });
  }

  console.log(reportTable(rows));
  if (args.manifest) {
    const manifestPath = path.resolve(args.manifest);
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), sources }, null, 2)}\n`, "utf8");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
