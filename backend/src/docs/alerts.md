# 🚨 Recommended Alerts (Prometheus / Grafana)

## 1. High Error Rate (Critical)
**Condition**: > 5% of HTTP requests are 5xx errors.
```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m])) 
/ 
sum(rate(http_requests_total[5m])) > 0.05
```

## 2. OCR Job Failures (Warning)
**Condition**: More than 1 failed OCR job in the last minute.
```promql
increase(ocr_job_failures_total[1m]) > 1
```

## 3. High Latency (Warning)
**Condition**: 95th Percentile of HTTP requests > 2 seconds.
```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2
```

## 4. OCR Queue Backlog (Critical)
**Condition**: More than 50 jobs waiting in the queue.
```promql
ocr_queue_depth{state="waiting"} > 50
```

## 5. Slow OCR Processing (Warning)
**Condition**: OCR Jobs taking longer than 60s on average.
```promql
rate(ocr_job_duration_seconds_sum[5m]) / rate(ocr_job_duration_seconds_count[5m]) > 60
```
