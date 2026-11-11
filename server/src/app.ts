import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { appConfig } from './config/app.config';
import { errorHandler, AppError } from './middleware/error.middleware';
import { v1Router } from './routes/v1.router';
import { setupSwagger } from './config/swagger';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: appConfig.corsOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
if (!appConfig.isTest) {
  app.use(
    pinoHttp({
      transport: appConfig.isDevelopment
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    })
  );
}

setupSwagger(app);

app.use(appConfig.apiPrefix, v1Router);

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message:
      'Welcome to V3 API. Please use /api/v1 endpoints or visit /api/docs for documentation.',
  });
});

app.use((req: Request, _res: Response) => {
  throw new AppError(404, `Route ${req.method} ${req.originalUrl} not found`, 'NOT_FOUND');
});

app.use(errorHandler);
