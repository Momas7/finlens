import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export type ApiErrorCode = 'validation' | 'not_found' | 'conflict';

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') =>
  new ApiError(404, 'not_found', `${what} não encontrado.`);

/** Converte erros em `{ error: { code, message, fields? } }`; nunca expõe detalhes de 500. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | Error, request, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.status).send({
        error: { code: err.code, message: err.message, ...(err.fields && { fields: err.fields }) },
      });
    }
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] ??= issue.message;
      }
      return reply
        .status(400)
        .send({ error: { code: 'validation', message: 'Verifique os campos.', fields } });
    }
    const status = 'statusCode' in err && err.statusCode ? err.statusCode : 500;
    if (status < 500) {
      return reply
        .status(status)
        .send({ error: { code: status === 400 ? 'validation' : 'error', message: err.message } });
    }
    request.log.error({ err }, 'erro não tratado');
    return reply.status(500).send({ error: { code: 'internal', message: 'Erro interno.' } });
  });
}
