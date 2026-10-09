import pino, { type DestinationStream, type Logger } from 'pino';
import { type Config } from './config';

/**
 * The only fields a log line may carry (NFR-3). Anything else, such as a
 * request body, query string, coordinates or an address, is dropped before
 * the line is written, even if some code passes it by mistake.
 */
export const LOG_FIELD_ALLOW_LIST: ReadonlySet<string> = new Set([
  'reqId',
  'method',
  'route',
  'status',
  'latencyMs',
  'cacheHit',
  'errorCode',
  'port',
  'provider',
  'attestMode',
]);
/** Keys pino itself writes on every line. */
const PINO_KEYS: ReadonlySet<string> = new Set(['level', 'time', 'msg']);

/**
 * Wraps the destination so every line is filtered against the allow-list as
 * the last step. This also covers child-logger bindings, which pino writes
 * without passing them through its formatters.
 */
function allowListStream(inner: DestinationStream): DestinationStream {
  return {
    write(line: string): void {
      const fields = JSON.parse(line) as Record<string, unknown>;
      const kept: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (PINO_KEYS.has(key) || LOG_FIELD_ALLOW_LIST.has(key)) kept[key] = value;
      }
      inner.write(`${JSON.stringify(kept)}\n`);
    },
  };
}

/** Structured JSON logger with the allow-list applied to every line. */
export function createLogger(config: Pick<Config, 'logLevel'>, stream?: DestinationStream): Logger {
  return pino(
    {
      level: config.logLevel,
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
    },
    allowListStream(stream ?? pino.destination(1)),
  );
}
