export function toDbEnum<TEnum extends Record<string, string>>(
  enumValues: TEnum,
  value: string
): TEnum[keyof TEnum] {
  const key = value.toUpperCase();

  if (!(key in enumValues)) {
    throw new Error(`Unsupported enum value: ${value}`);
  }

  return enumValues[key as keyof TEnum];
}
