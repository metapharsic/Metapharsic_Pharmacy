## 2026-11-01T18:31:30Z
Fix the inventory issues in Dead Stock Radar and Capital Lockup & Aging where loading fails with "failed to load the dead stock". Wire the data loading accurately using multi-threading as per the application architecture and fix the issue permanently.

Integrity mode: development

## Requirements

### R1. Dead Stock Radar Loading Fix
Permanently resolve the loading failure in the Dead Stock Radar feature so that dead stock inventory loads and displays accurately without showing "failed to load the dead stock" or failing to fetch data.

### R2. Capital Lockup & Aging Loading Fix
Resolve any corresponding data loading and calculation issues in Capital Lockup & Aging so that inventory aging and lockup metrics load and display accurately.

### R3. Multi-Threaded Architecture Integration
Wire the loading operations using multi-threading / asynchronous execution accurately as per the application's architecture to prevent blocking the UI thread and ensure thread-safe state management.

### R4. Verification and Automated Testing
Verify the fixes by running the existing project test suite and adding automated unit/integration tests covering the Dead Stock Radar and Capital Lockup & Aging loading logic.

## Acceptance Criteria

### Functionality & Bug Resolution
- [ ] Dead Stock Radar loads dead stock data successfully without returning "failed to load the dead stock".
- [ ] Capital Lockup & Aging loads and renders inventory aging and capital lockup metrics without errors.
- [ ] All data fetching and processing runs off the main thread, maintaining UI responsiveness.

### Testing & Verification
- [ ] New automated unit or integration tests cover the Dead Stock Radar and Capital Lockup & Aging loading and data processing paths.
- [ ] All new and existing project test suites pass cleanly.


## 2026-11-02T04:32:16Z
7023-38f96106d50572d6.js:1 ChunkLoadError: Loading chunk 9194 failed.
(error: http://localhost:5888/_next/static/chunks/app/(dashboard)/inventory/audit/page-af7a5580052ef57e.js)
    at Object.j (webpack-fcd61f508aae644d.js:1:3261)
    at webpack-fcd61f508aae644d.js:1:1400
    at Array.reduce (<anonymous>)
    at d.e (webpack-fcd61f508aae644d.js:1:1366)
    at 7023-38f96106d50572d6.js:2:18878
    at 7023-38f96106d50572d6.js:2:19080
    at t (7023-38f96106d50572d6.js:2:19283)
push.10353.window.console.error @ 7023-38f96106d50572d6.js:1


## 2026-11-02T05:09:01Z
I want give an option for selling the medicine. at a rate. even desiginig the single tablet rate. so that i can calculate the cost of each tablet and strip and know the profit. when doing the point of sale. how can i achive it. use multi thread to wire the logic to the rest of the app.


## 2026-11-02T05:33:45Z
were can i update the tablet cost. and how much to sell. give an option to chemist to sell at what price he wants to sell. with pre-defined options aswell.
