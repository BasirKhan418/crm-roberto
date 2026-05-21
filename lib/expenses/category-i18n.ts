export type ExpenseCategoryLocale = "en" | "fr";

export type ExpenseCategoryDefinition = {
  key: string;
  nameEn: string;
  nameFr: string;
  aliases?: string[];
};

export const DEFAULT_EXPENSE_CATEGORY_DEFINITIONS: ExpenseCategoryDefinition[] = [
  { key: "fuel", nameEn: "Fuel", nameFr: "Carburant", aliases: ["essence", "gas", "gasoline"] },
  {
    key: "equipment-supplies",
    nameEn: "Equipment & supplies",
    nameFr: "Equipement et fournitures",
    aliases: ["fournitures", "materiel"],
  },
  { key: "subcontracting", nameEn: "Subcontracting", nameFr: "Sous-traitance", aliases: ["subcontractor"] },
  {
    key: "servers-hosting",
    nameEn: "Servers & hosting",
    nameFr: "Serveurs et hebergement",
    aliases: ["hosting", "hebergement", "serveur"],
  },
  { key: "telecom", nameEn: "Telecom", nameFr: "Telecom", aliases: ["telephone", "phone", "mobile"] },
  { key: "advertising", nameEn: "Advertising", nameFr: "Publicite", aliases: ["marketing", "ads"] },
  {
    key: "software-saas",
    nameEn: "Software & SaaS",
    nameFr: "Logiciels et SaaS",
    aliases: ["software", "saas", "logiciel"],
  },
  {
    key: "meals-entertainment",
    nameEn: "Meals & entertainment",
    nameFr: "Repas et divertissement",
    aliases: ["meals", "repas", "restaurant", "entertainment"],
  },
  { key: "travel", nameEn: "Travel", nameFr: "Deplacements", aliases: ["voyage", "transport"] },
  {
    key: "rent-utilities",
    nameEn: "Rent & utilities",
    nameFr: "Loyer et charges",
    aliases: ["rent", "loyer", "utilities", "charges"],
  },
  { key: "insurance", nameEn: "Insurance", nameFr: "Assurance", aliases: ["assurances"] },
  {
    key: "salaries-social-charges",
    nameEn: "Salaries & social charges",
    nameFr: "Salaires et charges sociales",
    aliases: ["salary", "salaries", "payroll", "charges-sociales"],
  },
  { key: "miscellaneous", nameEn: "Miscellaneous", nameFr: "Divers", aliases: ["other", "autre", "misc"] },
];

const DEFAULT_CATEGORY_BY_KEY = new Map(
  DEFAULT_EXPENSE_CATEGORY_DEFINITIONS.map((category) => [category.key, category])
);

const CATEGORY_ALIAS_TO_KEY = new Map<string, string>();

for (const category of DEFAULT_EXPENSE_CATEGORY_DEFINITIONS) {
  const aliasCandidates = [
    category.key,
    category.nameEn,
    category.nameFr,
    ...(category.aliases || []),
  ];

  for (const alias of aliasCandidates) {
    const normalizedAlias = toExpenseCategorySlug(alias);
    if (!normalizedAlias) continue;
    CATEGORY_ALIAS_TO_KEY.set(normalizedAlias, category.key);
  }
}

export function toExpenseCategorySlug(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

  return normalized;
}

function normalizeNonEmpty(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function resolveExpenseCategoryCanonicalKey(input: {
  key?: string | null;
  slug?: string | null;
  name?: string | null;
  nameEn?: string | null;
  nameFr?: string | null;
}) {
  const candidates = [
    normalizeNonEmpty(input.key),
    normalizeNonEmpty(input.slug),
    normalizeNonEmpty(input.nameEn),
    normalizeNonEmpty(input.nameFr),
    normalizeNonEmpty(input.name),
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = toExpenseCategorySlug(candidate);
    if (!normalizedCandidate) continue;
    const canonicalFromAlias = CATEGORY_ALIAS_TO_KEY.get(normalizedCandidate);
    if (canonicalFromAlias) {
      return canonicalFromAlias;
    }
  }

  for (const candidate of candidates) {
    const normalizedCandidate = toExpenseCategorySlug(candidate);
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  return "";
}

export function resolveDefaultExpenseCategoryTranslation(canonicalKey?: string | null) {
  if (!canonicalKey) return null;
  return DEFAULT_CATEGORY_BY_KEY.get(canonicalKey) || null;
}

export function resolveExpenseCategoryNameByLocale(
  category: {
    name?: string | null;
    nameEn?: string | null;
    nameFr?: string | null;
    canonicalKey?: string | null;
  },
  locale: ExpenseCategoryLocale
) {
  const en = normalizeNonEmpty(category.nameEn);
  const fr = normalizeNonEmpty(category.nameFr);
  const fallback = normalizeNonEmpty(category.name);
  const defaults = resolveDefaultExpenseCategoryTranslation(category.canonicalKey);

  if (locale === "fr") {
    return fr || defaults?.nameFr || fallback || en || "-";
  }

  return en || defaults?.nameEn || fallback || fr || "-";
}
