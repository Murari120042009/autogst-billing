import { Request, Response, NextFunction } from "express";
import { httpRequestDurationMicroseconds, httpRequestCount } from "../utils/metrics";

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const end = process.hrtime(start);
    const durationInSeconds = end[0] + end[1] / 1e9;

    // Record Metrics
    httpRequestCount.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });

    httpRequestDurationMicroseconds.observe(
      {
        method: req.method,
        route: req.route ? req.route.path : req.path,
        status_code: res.statusCode,
      },
      durationInSeconds
    );
  });

  next();
};
