import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "El cuerpo de la peticion debe ser JSON valido.");
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "Datos invalidos.",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (isDuplicateKeyError(error)) {
    return Response.json(
      { error: "Ya existe un registro con un valor unico duplicado." },
      { status: 409 },
    );
  }

  if (isCastError(error)) {
    return Response.json({ error: "Identificador invalido." }, { status: 400 });
  }

  console.error(error);
  return Response.json({ error: "Error interno del servidor." }, { status: 500 });
}

export function requireId(id: string) {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new ApiError(400, "Identificador invalido.");
  }

  return id;
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function isCastError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "CastError"
  );
}
