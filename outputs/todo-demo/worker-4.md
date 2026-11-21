# Worker 4: Test coverage review (reviewer)

Summary: All 29 spec cases have a test. Gaps are in assertion strength, plus a few spec statements with no assertion. Found by reading, not by mutation testing.

| # | Severity | Where | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | major | test.js:43-46 | Type-guard test passes even without the guard (null.trim() throws TypeError anyway). Boxed strings and undefined untested. | Pass an object with a trim method and assert TypeError; add undefined and new String('x'). |
| 2 | major | test.js:146-149, 176-184 | Spec says visibleTasks returns a new array; no test checks it. An 'all' branch returning state.tasks by reference would pass. | assert.notStrictEqual(visibleTasks(s, filter), s.tasks) for all three filters. |
| 3 | minor | test.js:89-94 | "Does not change other tasks" uses 2 tasks and checks one index. | Use 3+ tasks and deepStrictEqual all non-target tasks. |
| 4 | minor | test.js:48-54 | Truncation boundaries untested (keep-first vs keep-last; exactly 200 and 201 chars). | Add a 200-char input (unchanged) and a 201-char input (becomes 200). |
| 5 | minor | test.js:170-174 | instanceof Error also accepts TypeError/RangeError; spec says Error. | Check err.name === 'Error' or constructor identity. |
| 6 | minor | test.js:123-136 | No direct assertion that deleteTask leaves nextId unchanged. | assert.strictEqual(deleteTask(s, 2).nextId, s.nextId). |
| 7 | minor (optional) | test.js:212-216 | Browser branch (window.Todo, no top-level document/window) untested. Not in the 7.1 minimum. | Optionally load todo.js in vm with a fake window and check window.Todo keys. |

Checked and fine: immutability tests use deep snapshots; identity checks are correct; countLeft-ignores-filter case is sound.

Verdict: pass with fixes

Note: the reviewer returned these findings without writing this file. Saved by the parent agent.
