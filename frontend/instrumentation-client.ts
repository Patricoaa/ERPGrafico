import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_GIT_HASH,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    sendDefaultPii: false,
    // Replay desactivado por defecto — consume cuota y agrega ruido.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = (Sentry as unknown as { captureRouterTransitionStart: typeof import('@sentry/nextjs')['captureRouterTransitionStart'] }).captureRouterTransitionStart;
