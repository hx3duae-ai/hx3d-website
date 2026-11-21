# Review: Todo Demo

Reviewed against `design.md`. No shell commands were run. Verification was by reading the code and hand-tracing the test cases.

## Issues found and fixes

### 1. `addTask` could store text with a trailing space (todo.js)

- **Issue:** When text longer than 200 characters was truncated, `slice(0, 200)` could leave a trailing space at the cut point. This broke the Task.text invariant in design 3.1 ("trimmed, non-empty, max 200 characters").
- **Fix:** The truncated value is trimmed again: `trimmed.slice(0, MAX_TEXT_LENGTH).trim()`. The result is never empty, because `trimmed` starts with a non-whitespace character.
- **Test:** A new assertion was added inside existing case 7 (truncation). It checks that `'a'.repeat(199) + ' b'` stores `'a'.repeat(199)`. The case count stays at 29.
- **Trade-off:** A truncated value can be 199 characters, not exactly 200, when the cut lands on whitespace. Design 4.2 says "truncate to 200", and the data model says "trimmed". This fix follows the data model. The HTML `maxlength="200"` means the UI cannot produce this case anyway.

### 2. Console error on page load (index.html)

- **Issue:** Browsers request `/favicon.ico` by default. The file does not exist, so the console shows a 404. Manual check 1 in design 7.2 requires "no console errors".
- **Fix:** Added `<link rel="icon" href="data:,">` to `<head>`. This is an empty inline icon, so no request is made.

## Checked and found correct (no change)

- **todo.js:** `createState`, `addTask` (type check, empty/whitespace no-op, `nextId` increment), `toggleTask` and `deleteTask` (unknown id returns the same object, input not mutated), `visibleTasks` (three filters, bad filter throws `Error` with the value in the message), `countLeft`. Export shape matches design 4.3. No top-level `document` or `window` access outside the `else` branch.
- **test.js:** Cases 1 to 29 map one-to-one onto design 7.1. Count is 1 + 9 + 4 + 4 + 6 + 4 + 1 = 29. Runner exits 1 on any failure.
- **index.html:** Form, filter buttons with `aria-pressed`, list rendering with `textContent`, delete `aria-label`, empty-state texts ("No tasks yet" vs "Nothing here"), footer singular/plural, `[hidden]` override, and 320px layout (flex with `min-width: 0`, `overflow-wrap: anywhere`) all match design section 5.

## Hand-traced test result

- Cases 1 to 29, traced by hand against the code before and after the fixes: **29 of 29 expected to pass.**
- Case 7 with the new assertion: `'a'.repeat(199) + ' b'` gives trimmed length 201, slice to 200 gives `'a'*199 + ' '`, re-trim gives `'a'*199`. Passes.

## Remaining risk

- **Focus loss (not fixed):** `render()` rebuilds the whole list after every action. A keyboard user who toggles or deletes a task loses focus to `<body>`. Design section 1 lists "Accessibility beyond basic semantics" as a non-goal, so this is left as is. Restoring focus to the matching row would be the next step.
- **Shared task objects:** `addTask` and `deleteTask` reuse task objects from the previous state, and `visibleTasks` returns those objects by reference. No code mutates them, and the tests check that inputs are unchanged. A caller that mutates a returned task would change the state. Freezing task objects would prevent this, but it is not in the spec.
- **Browser walkthrough not run:** Design section 7.2 (manual checks) was verified by reading the markup and script only. No browser run was done. Layout at 320px is estimated, not measured.
- **Node run not performed:** The 29/29 result is a hand trace, not an execution. `node test.js` should still be run once before this is treated as verified.
- **Stale build report:** `build-report.md` says "Nothing was executed" and expects 29 passed. Both remain accurate after these changes.
