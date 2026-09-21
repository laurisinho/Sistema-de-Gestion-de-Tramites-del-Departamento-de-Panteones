import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 no reenvía el rechazo de una promesa en una ruta async a
// next(err): sin este wrapper, un error (p. ej. base de datos caída) deja la
// petición colgada o puede tumbar el proceso.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
