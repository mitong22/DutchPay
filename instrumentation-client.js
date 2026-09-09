import { reportClientError } from "@/lib/client-log.mjs";

try {
  window.addEventListener("error", (event) => {
    if (event.error || event.message) {
      reportClientError(event.error ?? event.message, "window.error");
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, "window.unhandledrejection");
  });
} catch (error) {
  console.error("[client-logger-setup]", error);
}
