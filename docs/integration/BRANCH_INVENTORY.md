# Branch inventory for the integration

| Branch | Relation to main | Reuse strategy |
|---|---|---|
| main | Baseline | Keep unchanged until phase 5 |
| classroom/start | Identical | No merge |
| Hitbox | Identical | No merge |
| Movement-system-for-warzone-III | 4 commits ahead | Adapt movement/dash in phase 2, not wholesale merge |
| mapita | 7 commits ahead | Adapt server map generation and MapView in phase 2 |
| GAME_SURIAN | 1 commit ahead | Rewrite incorrect imports and incomplete collision code in phase 3 |
| Skibidi_Multimedia_Color | 2 commits ahead | Adapt profiles and appearances in phase 4 |
| work/phase-1 | Behind | No merge |
| work/phase-2 | Diverged | Reuse documentation selectively |

## Integration hazards

- `ArenaScene.ts`, `RoomManager.ts`, `socket/index.ts`, and shared `types.ts` overlap across feature branches.
- Movement branch duplicates `PlayerState` and mixes event names.
- Weapon branch places Phaser-dependent code in the server and contains placeholder collisions.
- Profile persistence needs serialized or transactional writes.
- Do not add archived `apps.zip`/`apps.rar` binaries.
