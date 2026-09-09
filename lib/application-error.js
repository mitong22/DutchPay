export class ApplicationError extends Error {
  constructor(message, code = "APPLICATION_ERROR") {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
  }
}

export function getApplicationErrorMessage(error) {
  if (error instanceof ApplicationError) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
