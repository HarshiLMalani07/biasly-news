# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured with Session Replay, Error Tracking, and Support enabled; native health, error, and support signal sources are active. A focused scout troop, two product-specific scouts, and two Replay Vision monitors are also active.

Findings will start appearing in the [Self-driving inbox](https://us.posthog.com/project/621863/inbox) within about 30 minutes as the coordinator runs and new data arrives.

## AI data processing

Approved. The organization-level AI processing prerequisite was granted before this setup began.

## GitHub

Connected before this run through the PostHog GitHub App. No GitHub Issues responder was enabled because no connected tools were selected.

## Products enabled

| Product | Result | Notes |
| --- | --- | --- |
| Session Replay | Already enabled | This is a web app and its `posthog.init` configuration does not disable recording. |
| Error Tracking | Already enabled | Client exception capture remains enabled. |
| Support | Enabled | Connect an inbound email, inbox, or Slack channel in PostHog before support tickets can arrive. |

## Signal sources

| Signal source | Action | Notes |
| --- | --- | --- |
| `signals_scout` / `cross_source_issue` | Left on by default | No opt-out row existed, so scout findings flow to the inbox by default. |
| `health_checks` / `health_issue` | Enabled | Source configuration created. |
| `error_tracking` / `issue_created` | Enabled | Source configuration created. |
| `error_tracking` / `issue_reopened` | Enabled | Source configuration created. |
| `error_tracking` / `issue_spiking` | Enabled | Source configuration created. |
| `conversations` / `ticket` | Enabled | Source configuration created; it remains idle until a Support channel is connected. |
| Session replay source row | Skipped | Replay coverage is provided by the Replay Vision monitors below; this retired source row was not created. |
| External-tool sources | Skipped | No issue tracker, support desk, or other external tool was selected. |

## Connected tools

No connected tools were selected. GitHub Issues, Linear, Jira, Sentry, and Zendesk were offered and marked **not used** for this setup.

## Scout troop

**Run budget:** 100 runs/day; 0 used at setup time; 100 remaining. The project is enrolled in scout early access. Banner: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

### Active scouts (6)

| Scout | Why it is active |
| --- | --- |
| General | Covers cross-product patterns and uncovered surfaces. |
| Product analytics | Watches core product-flow regressions. |
| Web analytics | Watches traffic, attribution, landing-page health, and 404 behavior. |
| AI observability | Watches AI reliability, latency, cost, and volume regressions. |
| News ingestion health | Custom scout for sustained ingestion degradation. |
| AI analysis completion health | Custom scout for end-to-end analysis completion and backlog degradation. |

### Disabled built-in scouts

24 built-in scouts remain disabled to keep the troop selective. Error tracking is covered by its native responder and Session Replay is covered by Replay Vision monitors, so their duplicate scouts remain off. Surface-specific scouts for surveys, experiments, feature flags, revenue, logs, CSP, customer analytics, data pipelines, data warehouse, APM, MCP tool calls, web vitals, Conversations, Tasks, and skills hygiene are disabled because that surface was not confirmed as a primary active need. Cross-product anomaly detection, observability gaps, inbox validation, insight alerts, PR follow-up, and Replay Vision trend analysis are also disabled for this fresh configuration.

## Custom scouts

| Scout | What it watches | Discriminator | Why it is custom |
| --- | --- | --- | --- |
| `signals-scout-news-ingestion-health` | The scraping and article-ingestion pipeline described by `lib/pipeline/scrape.ts` and `app/api/scrape/route.ts`. | Sustained drop in successful article imports explained by persistent failure/rejection patterns, rather than a small manual run or normal duplicate handling. | Built-ins do not own this domain-specific ingestion outcome. |
| `signals-scout-ai-analysis-completion-health` | The analysis and embedding pipeline described by `lib/pipeline/analyze.ts` and `app/api/analyze/route.ts`. | Sustained mismatch between completed work, failures, and remaining pending work that creates a real backlog. | AI observability covers trace-level behavior; this scout owns end-to-end pipeline completion. |

The custom-scout proposal was approved for both candidates. Other potential surfaces were ruled out because they were already covered by native error/replay routes or by enabled built-ins. To quiet a custom scout without deleting it, set its configuration’s `emit` value to `false` in PostHog; it will then run in dry-run mode.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes confirmed visible defects into the Self-driving inbox. These are the only items in this setup that spend Replay Vision quota. Each finding carries half weight, so corroboration is needed before a finding is promoted into a report.

| Scanner | Status | What it watches | Query scope | Sampling | Estimated monthly spend |
| --- | --- | --- | --- | --- | --- |
| [Broken article analysis](https://us.posthog.com/project/621863/replay-vision/01a0c797-4187-786d-b43d-ec2c7062ebde) | Created | Visible breakage in the article-reading and AI-analysis detail experience: failed pages, missing article content, absent analysis, blank bias distribution, or missing related stories. | Recordings that include a `/news/` URL. This is the product’s article-reading completion flow, where a reader reviews the selected story and its analysis. | 50% | 0 observations / 0 credits, based on the current seven-day estimate. |
| [News reading frustration](https://us.posthog.com/project/621863/replay-vision/01a0c797-417b-776b-b8f7-ce1200c44f9c) | Created | Clear reader frustration: unresponsive article links, a failing “View more” control, missing analysis insights, or unresponsive related stories. | `$rageclick` sessions only; deliberately no URL filter. | 100% | 0 observations / 0 credits, based on the current seven-day estimate. |

Session Replay has no recordings yet. Both monitors are armed and will begin working as soon as recordings arrive. The Replay Vision organization budget is 2,500 credits for the current period, with all 2,500 credits remaining at setup time.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so enabled Support ticket signals can begin arriving.
- [ ] Generate normal web traffic after deployment so Session Replay records sessions and the two Replay Vision monitors can begin observing them.
- [ ] Run normal scraping and AI analysis jobs so the custom scouts can establish healthy outcome baselines from their captured pipeline events.
- [ ] The setup MCP connection could not read the event-definition schema because it lacks `property_definition:read`; grant that scope on reconnection if direct event-schema inspection is needed.
- [ ] Rate scanner observations after they appear to receive configuration recommendations for review: [Broken article analysis](https://us.posthog.com/project/621863/replay-vision/01a0c797-4187-786d-b43d-ec2c7062ebde) and [News reading frustration](https://us.posthog.com/project/621863/replay-vision/01a0c797-417b-776b-b8f7-ce1200c44f9c).

## What happens next

Fresh scout configurations are picked up within about 30 minutes. Each scout run draws from the daily budget, then findings cluster into reports in the Self-driving inbox. Immediately actionable reports can start coding tasks; review all resulting changes before merging.

## Files modified or created

- Created `posthog-self-driving-report.md`.
- No application source files were changed.
