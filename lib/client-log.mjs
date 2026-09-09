let sent = 0;

export function redactClientLog(value, max = 4_000) {
  return String(value ?? "")
    .replace(/\/invite\/[^/?#\s]+/gi, "/invite/[redacted]")
    .replace(
      /((?:bearer|token|secret|password|authorization|cookie|api[-_]?key)\s*(?:[:=]|\s)\s*)[^\s,;&]+/gi,
      "$1[redacted]",
    )
    .slice(0, max);
}

export function reportClientError(reason, area, status) {
  if (process.env.NODE_ENV === "production" || sent >= 20) return;
  sent += 1;

  try {
    const error = reason instanceof Error ? reason : null;
    console.error(`[client-error:${area}]`, reason);
    navigator.sendBeacon(
      "/api/client-errors",
      JSON.stringify({
        area: redactClientLog(area, 80),
        message: redactClientLog(error?.message ?? reason, 1_000),
        stack: redactClientLog(error?.stack, 4_000),
        path: redactClientLog(location.pathname, 500),
        userAgent: navigator.userAgent.slice(0, 500),
        status: Number.isInteger(status) ? status : undefined,
      }),
    );
  } catch {}
}
