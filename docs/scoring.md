# Fit and Trend Scoring

## Default Fit model

Fit is a configurable 0-100 recruitment sorting score built from five 30-day activity metrics.

| Metric | Default target | Default weight |
|---|---:|---:|
| Xanax | 60 | 20 |
| Activity | 120 hours | 20 |
| Refills | 25 | 20 |
| Attacks | 200 | 20 |
| Ranked War hits | 40 | 20 |

Weights are normalized to total 100. If all configured weights are zero, the engine falls back to equal 20-point weights.

For each metric:

```text
component = min(max(actual, 0) / target, 1) * normalizedWeight
```

The five components are summed and capped to 100.

The curve is intentionally linear. Exceeding a target does not award bonus Fit above that component's configured weight.

## Attacks

The attack metric is:

```text
attackswon delta + attackslost delta
```

It measures attacks performed rather than only wins.

## Official Fit

Official Fit requires a complete 30-day activity window. A player reaching every configured target scores 100.

## Provisional Fit

Incomplete history is never silently treated as a 30-day measurement.

Scout takes the longest trustworthy shorter window, projects its pace to 30 days, runs the same Fit formula, and labels the result provisional.

```text
projected30 = measuredWindow * (30 / measuredDays)
```

Confidence bands:

| History | Confidence |
|---|---|
| 1-6 days | Very Low |
| 7-13 days | Low |
| 14-20 days | Medium |
| 21-29 days | High |
| 30+ days | Official |

For accounts younger than 30 days, cumulative lifetime totals can represent the full account-age activity window because the account did not exist before that period.

## Trend

Trend asks whether recent activity is accelerating or slowing relative to the 30-day baseline.

For each metric with a non-zero 30-day baseline:

```text
recentDaily = value7 / 7
baselineDaily = value30 / 30
metricTrendPercent = (recentDaily / baselineDaily - 1) * 100
```

The overall Trend is a weighted average of valid metric trend percentages using the same normalized weights as Fit.

Metrics whose 30-day baseline is zero are omitted from the overall Trend rather than creating division-by-zero values.

Examples:

- `+25%` means the weighted recent pace is roughly 25% above the 30-day pace.
- `-20%` means the weighted recent pace is roughly 20% below the 30-day pace.
- no valid baselines means Trend is not measured.

## Historical formulas

A Scout snapshot stores the formula used at capture time. Its **Original Fit** therefore never changes.

The UI can also calculate **Current Fit** from that snapshot's stored activity window using the formula configured today. This lets formula changes remain historically honest without making old data useless for present-day comparisons.

## Extra fields

These are intentionally not Fit components:

- Net worth
- Current activity streak
- Best activity streak
- Stat enhancers used

They are available as display and filtering information. This keeps the core Fit model focused on the five approved activity dimensions while still exposing useful recruitment context.
