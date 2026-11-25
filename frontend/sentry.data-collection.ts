import type * as Sentry from "@sentry/nextjs";

type DataCollection = NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>["dataCollection"]>;

/**
 * Datos que el SDK de Sentry adjunta a los eventos. Desde Sentry 11 `sendDefaultPii` ya no existe y
 * `dataCollection` recopila por defecto usuario, cookies, cabeceras, cuerpos HTTP, query params,
 * datos de queries y variables de stack. Para mantener el comportamiento anterior
 * (`sendDefaultPii: false`, sin datos personales) se desactiva todo explícitamente: los eventos
 * llevan stack trace, contexto de código, entorno y release, pero no datos de clientes ni empleados.
 */
export const SENTRY_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};
