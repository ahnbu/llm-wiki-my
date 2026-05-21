export function stripFrontmatter(markdown) {
  return String(markdown).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

function countChars(lines) {
  return lines.join("\n").trim().length;
}

function hasBody(lines) {
  return lines.join("\n").trim().length > 0;
}

function specialIndexFor(heading) {
  const normalized = heading.trim();
  if (/^프롤로그$/i.test(normalized)) return "00";
  if (/^에필로그$/i.test(normalized)) return "99";
  return "";
}

export function parseHeadingBlocks(markdown) {
  const lines = stripFrontmatter(markdown).split(/\r?\n/);
  const blocks = [];
  const stack = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match) {
      const level = match[1].length;
      const heading = match[2].trim();
      while (stack.length && stack.at(-1).level >= level) {
        stack.at(-1).endLine = index;
        stack.pop();
      }
      for (const parent of stack) parent.subtreeLines.push(line);
      const block = {
        id: `h${blocks.length + 1}`,
        level,
        heading,
        headingLine: line,
        parentHeadings: stack.map((item) => item.heading),
        parentIds: stack.map((item) => item.id),
        directBodyLines: [],
        subtreeLines: [line],
        startLine: index,
        endLine: lines.length,
        childIds: [],
      };
      if (stack.length) stack.at(-1).childIds.push(block.id);
      blocks.push(block);
      stack.push(block);
      continue;
    }

    for (const block of stack) block.subtreeLines.push(line);
    if (stack.length) stack.at(-1).directBodyLines.push(line);
  }

  for (const block of stack) block.endLine = lines.length;
  return blocks;
}

function hasTargetDescendant(blocks, block, targetLevel) {
  return blocks.some((candidate) => candidate.level === targetLevel && candidate.parentIds.includes(block.id));
}

function makeUnit(block, overrides = {}) {
  const lines = overrides.lines || block.subtreeLines;
  return {
    unitId: overrides.unitId || block.id,
    heading: overrides.heading || block.heading,
    level: block.level,
    effectiveHeadingLevel: overrides.effectiveHeadingLevel || block.level,
    unitKind: overrides.unitKind || "target-heading",
    parentHeadings: overrides.parentHeadings || block.parentHeadings,
    parent: (overrides.parentHeadings || block.parentHeadings).at(-1) || "",
    specialIndex: overrides.specialIndex || specialIndexFor(overrides.heading || block.heading),
    lines,
    startLine: block.startLine,
    endLine: overrides.endLine || block.endLine,
    charCount: countChars(lines),
  };
}

export function buildEffectiveUnits(blocks, targetLevel) {
  const units = [];
  const parentLevel = targetLevel - 1;

  for (const block of blocks) {
    if (block.level === targetLevel) {
      units.push(makeUnit(block, { unitKind: "target-heading" }));
      continue;
    }

    if (block.level !== parentLevel) continue;

    const hasTarget = hasTargetDescendant(blocks, block, targetLevel);
    if (!hasTarget) {
      if (hasBody(block.subtreeLines.slice(1))) {
        units.push(makeUnit(block, { unitKind: specialIndexFor(block.heading) ? "special" : "ancestor-leaf" }));
      }
      continue;
    }

    if (hasBody(block.directBodyLines)) {
      const heading = `${block.heading} - 도입부`;
      units.push(
        makeUnit(block, {
          unitId: `${block.id}:intro`,
          heading,
          unitKind: "parent-intro",
          effectiveHeadingLevel: block.level,
          parentHeadings: block.parentHeadings,
          lines: [block.headingLine, ...block.directBodyLines],
        })
      );
    }
  }

  return units.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
}

export function summarizeUnits(units, { softLimit = 20_000, hardLimit = 30_000 } = {}) {
  const charCounts = units.map((unit) => unit.charCount);
  const total = charCounts.reduce((sum, value) => sum + value, 0);
  const overSoftUnits = units.filter((unit) => unit.charCount > softLimit);
  const overHardUnits = units.filter((unit) => unit.charCount > hardLimit);
  return {
    count: units.length,
    averageCharCount: units.length ? Math.round(total / units.length) : 0,
    maxCharCount: charCounts.length ? Math.max(...charCounts) : 0,
    overSoftCount: overSoftUnits.length,
    overHardCount: overHardUnits.length,
    overHardUnits: overHardUnits.map((unit) => ({
      unitId: unit.unitId,
      heading: unit.heading,
      charCount: unit.charCount,
      unitKind: unit.unitKind,
    })),
  };
}

export function generatePartLabels(effectiveUnits, exceptionSplitTargets = []) {
  const exceptionIds = new Map(exceptionSplitTargets.map((target) => [target.unitId, target]));
  let regular = 1;
  return effectiveUnits.map((unit) => {
    const defaultLabel = unit.specialIndex || String(regular++).padStart(2, "0");
    const exception = exceptionIds.get(unit.unitId);
    const explicitParts = exception?.explicitParts || [];
    return {
      unitId: unit.unitId,
      heading: unit.heading,
      defaultLabel,
      generatedLabels: explicitParts.length
        ? explicitParts.map((part, index) => part.label || `${defaultLabel}-${index + 1}`)
        : [defaultLabel],
    };
  });
}

function levelKey(level) {
  return `H${level}`;
}

export function recommendSplitLevel(levelSummaries, { softLimit = 20_000 } = {}) {
  const sorted = [...levelSummaries].sort((a, b) => a.level - b.level);
  let selected = sorted.at(-1) || null;
  for (const summary of sorted) {
    if (summary.effective.averageCharCount <= softLimit && summary.effective.overHardCount <= 2) {
      selected = summary;
      break;
    }
  }

  const exceptionSplitTargets =
    selected && selected.effective.overHardCount > 0 && selected.effective.overHardCount <= 2
      ? selected.effective.overHardUnits
      : [];
  const suffix = exceptionSplitTargets.length ? " + exception" : "";

  return {
    defaultLevel: selected?.level || 0,
    label: selected ? `H${selected.level}${suffix}` : "none",
    reason: selected
      ? `H${selected.level} average ${selected.effective.averageCharCount} chars; ${selected.effective.overHardCount} hard-warning unit(s)`
      : "No heading units found",
    exceptionSplitTargets,
  };
}

export function analyzeMarkdownSplit(markdown, options = {}) {
  const levels = options.levels || [2, 3];
  const softLimit = options.softLimit ?? 20_000;
  const hardLimit = options.hardLimit ?? 30_000;
  const blocks = parseHeadingBlocks(markdown);
  const levelResults = levels.map((level) => {
    const rawBlocks = blocks.filter((block) => block.level === level);
    const rawUnits = rawBlocks.map((block) => makeUnit(block));
    const effectiveUnits = buildEffectiveUnits(blocks, level);
    return {
      level,
      rawHeadingCount: rawBlocks.length,
      effectiveUnitCount: effectiveUnits.length,
      raw: summarizeUnits(rawUnits, { softLimit, hardLimit }),
      effective: summarizeUnits(effectiveUnits, { softLimit, hardLimit }),
      effectiveUnits,
    };
  });
  const recommendation = recommendSplitLevel(levelResults, { softLimit, hardLimit });
  const defaultLevel = levelResults.find((item) => item.level === recommendation.defaultLevel);
  const generatedPartLabels = defaultLevel ? generatePartLabels(defaultLevel.effectiveUnits, recommendation.exceptionSplitTargets) : [];

  const rawHeadingStats = {};
  const effectiveSplitUnitStats = {};
  for (const item of levelResults) {
    rawHeadingStats[levelKey(item.level)] = item.raw;
    effectiveSplitUnitStats[levelKey(item.level)] = item.effective;
  }

  return {
    levels: levelResults,
    recommendation,
    manifest: {
      analyzedHeadingLevels: levels,
      rawHeadingStats,
      effectiveSplitUnitStats,
      defaultSplitLevel: recommendation.defaultLevel,
      exceptionSplitTargets: recommendation.exceptionSplitTargets,
      generatedPartLabels,
      parentHeadingContext: (defaultLevel?.effectiveUnits || []).map((unit) => ({
        unitId: unit.unitId,
        heading: unit.heading,
        parentHeadings: unit.parentHeadings,
      })),
      limitFlags: {
        softLimit,
        hardLimit,
      },
    },
  };
}

export function buildSplitPartsFromMarkdown(markdown, { level }) {
  const content = stripFrontmatter(markdown);
  const lines = content.split(/\r?\n/);
  const blocks = parseHeadingBlocks(markdown);
  const parts = buildEffectiveUnits(blocks, level).map((unit) => ({
    heading: unit.heading,
    parent: unit.parent,
    parentHeadings: unit.parentHeadings,
    unitKind: unit.unitKind,
    effectiveHeadingLevel: unit.effectiveHeadingLevel,
    specialIndex: unit.specialIndex,
    lines: unit.lines,
    unitId: unit.unitId,
  }));

  const firstStart = buildEffectiveUnits(blocks, level).at(0)?.startLine ?? lines.length;
  const introText = lines.slice(0, firstStart).join("\n").trim();
  const prologue = parts.find((part) => part.specialIndex === "00");
  if (introText && prologue) {
    prologue.lines.unshift("## 원문 서문", "", introText, "");
  } else if (introText) {
    parts.unshift({
      heading: "프롤로그",
      parent: "",
      parentHeadings: [],
      unitKind: "special",
      effectiveHeadingLevel: Math.max(1, level - 1),
      specialIndex: "00",
      lines: ["## 원문 서문", "", introText],
      unitId: "intro:prologue",
    });
  }

  return parts.filter((part) => hasBody(part.lines));
}
