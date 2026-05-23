type JsonRecord = Record<string, unknown>;

export function serialize(value: unknown) {
  const plain = JSON.parse(JSON.stringify(value));
  return normalizeIds(plain);
}

function normalizeIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeIds);
  }

  if (!isRecord(value)) {
    return value;
  }

  if ("_id" in value) {
    value.id = value._id;
    delete value._id;
  }

  delete value.__v;

  for (const [key, child] of Object.entries(value)) {
    value[key] = normalizeIds(child);
  }

  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}
