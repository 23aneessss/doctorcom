export function parseModelJson(rawText: string): unknown | null {
  const direct = tryParseJson(rawText);
  if (direct !== null) {
    return direct;
  }

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    const fenced = tryParseJson(fencedMatch[1] ?? "");
    if (fenced !== null) {
      return fenced;
    }
  }

  const firstBraceIndex = rawText.indexOf("{");
  const lastBraceIndex = rawText.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    const objectSlice = rawText.slice(firstBraceIndex, lastBraceIndex + 1);
    const objectValue = tryParseJson(objectSlice);
    if (objectValue !== null) {
      return objectValue;
    }
  }

  const firstBracketIndex = rawText.indexOf("[");
  const lastBracketIndex = rawText.lastIndexOf("]");
  if (firstBracketIndex >= 0 && lastBracketIndex > firstBracketIndex) {
    return tryParseJson(rawText.slice(firstBracketIndex, lastBracketIndex + 1));
  }

  return null;
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
