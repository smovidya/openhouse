// Supplied corrections: preserve their exact order and behavior, including destructive ranges.
export const normalizationRules: readonly (readonly [RegExp, string])[] = [
  [/ํ[าๅ]/gu, "ำ"],
  [/เเ/gu, "แ"],
  [/([เ-ไ])[^฀-ฮ]+/gu, "$1"],
  [/([ะ-ำๅ])[ัำ-ฺ๊-ํ็-้]+/gu, "$1"],
  [/(ำ)[ั-ฺ็-ํ]+/gu, "$1"],
  [/([าิ-ืํ])[ะ-ฺๅ็ํ]+/gu, "$1"],
  [/([ุ-ฺ])[ะ-ฺๅ็ํ]+/gu, "$1"],
  [/(็)[ะ-ฺๅ็ํ]+/gu, "$1"],
  [/([่-๋])[ัำ-ฺ็-ํ]+/gu, "$1"],
  [/(่)[่-]+/gu, "$1"],
  [/(้)[่-]+/gu, "$1"],
  [/(๊)[่-]+/gu, "$1"],
  [/(๋)[่-]+/gu, "$1"],
  [/(์)[่-]+/gu, "$1"],
  [/([^฀-ฮ])์+/gu, "$1"],
];
export const normalizationReady = normalizationRules.length === 15;

export function normalizeCertificateText(raw: string): string {
  let value = raw.normalize("NFC");
  for (const [pattern, replacement] of normalizationRules) {
    if (!pattern.global || !pattern.unicode)
      throw new Error("Rules must use gu flags");
    value = value.replace(pattern, replacement);
  }
  return value.normalize("NFC").trim();
}
