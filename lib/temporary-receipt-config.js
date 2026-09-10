import "server-only";

export function isTemporaryReceiptDataEnabled() {
  const configuredValue = process.env.ENABLE_TEMP_RECEIPT_DATA;

  if (configuredValue !== undefined) {
    return configuredValue === "true";
  }

  return process.env.NODE_ENV === "development";
}
