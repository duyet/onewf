# Cost Analysis

This document provides a cost breakdown for running onewf on Cloudflare Workers.

## Cloudflare Workers Pricing (Free Tier)

| Resource | Free Tier Limit | onewf Usage | Cost |
|----------|-----------------|-------------|------|
| Requests | 100,000/day | ~300/day (cron + health checks) | Free |
| CPU Time | 10ms/request | ~50ms/workflow invocation | Free |
| Duration | Unlimited (CPU-bound) | Workflows sleep during waits | Free |
| Workflows | 10,000/day | ~300/day | Free |

## Workflow-Specific Costs

### Cron Dispatcher
- **Frequency**: Every 15 minutes (96/day)
- **Duration**: ~50ms (loads config, creates 3 workflow instances)
- **Monthly invocations**: ~2,880
- **Cost**: Free (well within 10,000/day limit)

### Source Workflows (3 sources × 96/day)
- **CF Billing**: ~2s (API call + processing)
- **AnyRouter**: ~2s (API call + processing)
- **GCP Billing**: ~3s (OAuth + API call)
- **Monthly invocations**: ~8,640 each
- **Cost**: Free

### Alert Dispatch Workflow
- **Frequency**: Only when alerts trigger (estimated 10-50/day)
- **Duration**: ~5s (fan-out to 3 channels, D1 writes)
- **Monthly invocations**: ~300-1,500
- **Cost**: Free

## Storage Costs

### D1 Database
| Metric | Free Tier | onewf Usage |
|--------|-----------|-------------|
| Storage | 5 GB | ~10 MB/month (alert history) |
| Reads | 25M/day | ~1,000/day |
| Writes | 100K/day | ~500/day |

**Cost**: Free

### KV Namespaces
| Namespace | Free Tier | onewf Usage |
|-----------|-----------|-------------|
| CONFIG_KV | 1 GB | < 1 MB |
| IDEMPOTENCY_KV | 1 GB | ~100 KB/day (24h TTL) |

**Cost**: Free

### R2 Bucket
| Metric | Free Tier | onewf Usage |
|--------|-----------|-------------|
| Storage | 10 GB | Not used (reserved for large payloads) |
| Class A ops | 1M/month | 0 |
| Class B ops | 10M/month | 0 |

**Cost**: Free

## Monthly Cost Summary (Free Tier)

| Component | Monthly Cost |
|-----------|--------------|
| Workers Requests | $0 |
| Workers CPU | $0 |
| Workflows | $0 |
| D1 Storage/Reads/Writes | $0 |
| KV Storage/Ops | $0 |
| R2 Storage/Ops | $0 |
| **Total** | **$0** |

## Paid Tier Projections

If exceeding free tier (high-volume scenarios):

### Workers Paid Plan ($5/month)
- 10M requests/month
- 30M CPU-ms/month
- Includes 1M Workflow invocations

### D1 Paid ($0.75/GB/month storage, $0.001/M reads, $1/M writes)
| Scenario | Monthly Cost |
|----------|--------------|
| 10K alerts/month | ~$0.10 |
| 100K alerts/month | ~$1.00 |
| 1M alerts/month | ~$10.00 |

### KV Paid ($0.50/GB/month, $0.50/M ops)
| Scenario | Monthly Cost |
|----------|--------------|
| Standard usage | <$0.01 |

## Optimization Tips

1. **Use `step.sleep()` for rate limiting** - Doesn't count toward CPU time
2. **Short retention for Workflow history** - Default 7 days, reduce if needed
3. **Batch D1 writes** - Use transactions for multiple inserts
4. **Cache config in memory** - 5-minute TTL reduces KV reads
5. **Use R2 for large payloads** - If alert payloads exceed 1MB

## Cost Monitoring

```bash
# View Workers metrics
wrangler metrics --since 7d

# View D1 usage
wrangler d1 info onewf-db

# View KV usage
wrangler kv:namespace list
```

## Conclusion

For typical usage (3 sources, 3 channels, 96 cron runs/day), onewf runs **entirely within Cloudflare's generous free tier**. Even at 10x scale, monthly costs remain under $5/month.