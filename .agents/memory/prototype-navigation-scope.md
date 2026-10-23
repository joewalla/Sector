---
name: Mapbox prototype before native navigation
description: User-approved prototype direction before paid Apple or Google setup.
---

Continue with the existing Mapbox integration and an explicitly labelled route simulation before pursuing paid Apple or Google setup.

**Why:** The user asked whether a semi-working prototype could be built here before spending with Google and Apple, and approved continuing with the Mapbox simulation.

**How to apply:** Prioritize browser-testable prototype functionality. Keep simulated results separate from real journeys and personal bests. Do not treat this choice as approval to install a native navigation SDK, purchase accounts, or claim real-road guidance is validated.

## Replay comparison semantics

Compare sector splits only against a fully completed replay of the same unchanged route response and sector configuration, held in memory. Faster playback must not produce faster sector splits; repeat runs should match.

Manually seeking makes that entire run inspection-only, even if playback subsequently reaches arrival. A fresh replay from the start without seeking is required for baseline eligibility; an earlier valid baseline must survive inspection.

**Why:** The prototype is testing timing calculations, not measuring driving or inventing improvements. Refetching traffic estimates between comparison runs would silently change the baseline.

**How to apply:** Treat Mapbox times as simulation inputs. Partial runs never replace a completed comparison baseline. A changed sector configuration clears the old comparison even if the user later returns to the earlier count. Keep replays separate from real personal bests and avoid language that rewards speed.

## Synthetic delays are not provider estimates

Keep an unchanged Mapbox reference when adding an explicitly configured synthetic stop. Compare completed replays only with the same stop configuration; configuration changes clear that comparison.

**Why:** A synthetic delay must never be presented as live traffic or measured driving. Placing it inside a selected sector, rather than on a boundary, gives unambiguous attribution to that sector.

**How to apply:** Show the original estimate and added delay separately, include only consumed delay for early-ended runs, and freeze synthetic countdowns when playback is paused. Faster playback must not change the delay in simulation seconds.
