import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 no reenvía automáticamente el rechazo de una promesa dentro de una
// ruta async a next(err) -- sin este wrapper, un error (p. ej. la base de datos
// caída) deja la request colgada en vez de responder, o puede tumbar el proceso.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
