---
name: Live navigation before leaderboards
description: The user's current product priority and guardrails between simulated and real navigation.
---

Live turn-by-turn navigation is Sector's next major milestone; personal leaderboards follow.

**Why:** The user explicitly changed the roadmap to make live navigation the next major milestone.

**How to apply:** Keep the existing Mapbox browser simulation clearly distinct from live navigation, real journeys, and personal bests. Decide the live-navigation provider and technical path before implementation. This priority change does not by itself authorize purchases, paid account setup, or native-build changes.

## Replay comparison semantics

Compare sector splits only against a fully completed replay of the same unchanged route response and sector configuration, held in memory. Faster playback must not produce faster sector splits; repeat runs should match.

Manually seeking makes that entire run inspection-only, even if playback subsequently reaches arrival. A fresh replay from the start without seeking is required for baseline eligibility; an earlier valid baseline must survive inspection.

**Why:** The prototype is testing timing calculations, not measuring driving or inventing improvements. Refetching traffic estimates between comparison runs would silently change the baseline.

**How to apply:** Treat Mapbox times as simulation inputs. Partial runs never replace a completed comparison baseline. A changed sector configuration clears the old comparison even if the user later returns to the earlier count. Keep replays separate from real personal bests and avoid language that rewards speed.

## Synthetic delays are not provider estimates

Keep an unchanged Mapbox reference when adding an explicitly configured synthetic stop. Compare completed replays only with the same stop configuration; configuration changes clear that comparison.

**Why:** A synthetic delay must never be presented as live traffic or measured driving. Placing it inside a selected sector, rather than on a boundary, gives unambiguous attribution to that sector.

**How to apply:** Show the original estimate and added delay separately, include only consumed delay for early-ended runs, and freeze synthetic countdowns when playback is paused. Faster playback must not change the delay in simulation seconds.

## Preference-only practice persistence

Remembering practice configuration must be an explicit opt-in and stay local: sector count and bounded synthetic stop sector/duration values only. Do not expand it into saved journeys, locations, route geometry or steps, split results, or replay comparison baselines.

**Why:** The user requested remembering practice setup without saving journeys or locations, with no accounts, GPS, or backend storage.

**How to apply:** Preserve this privacy boundary when extending practice features. Keep saved searches separate, validate restored preferences before playback, and retain a clear forget/reset action.

## Sector's core priority

Personal leaderboards are the core of Sector. Treat verified individual best times and progress as the first leaderboard milestone; simulated practice results are not real performance records.

**Why:** The user identified personal leaderboards as Sector's core product value.

**How to apply:** Once planning leaderboard work, keep simulation data clearly separate from real activities and personal bests. Confirm whether the user means private self-comparison or rankings against other runners before defining broader visibility.
