import pino from 'pino';
import { config } from './env';

const pinoConfig = 
  config.NODE_ENV === 'production'
    ? {
        level: config.LOG_LEVEL,
        formatters: {
          level: (label) => {
            return { level: label.toUpperCase() };
          },
        },
      }
    : {
        level: config.LOG_LEVEL,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      };

export const logger = pino(pinoConfig);

export default logger;
