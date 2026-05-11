from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, status_code: int, detail: str, code: str = None):
        self.status_code = status_code
        self.detail = detail
        self.code = code or "error"


class NotFoundException(AppException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(404, f"{resource} not found", "not_found")


class ConflictException(AppException):
    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(409, detail, "conflict")


class ValidationException(AppException):
    def __init__(self, detail: str):
        super().__init__(422, detail, "validation_error")


class UnauthorizedException(AppException):
    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(401, detail, "unauthorized")


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(403, detail, "forbidden")


async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.detail,
                "status": exc.status_code,
            }
        },
    )


async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred",
                "status": 500,
            }
        },
    )
