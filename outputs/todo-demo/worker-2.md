# Worker 2: Accessibility review (reviewer)

Summary: Section 6 baseline passes. Main gap is keyboard focus lost after each toggle or delete, since the list is rebuilt on every render.

| # | Severity | Where | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | major | index.html:78-81, 93-96, 129-133 | Full re-render removes the focused checkbox or delete button; focus drops to body. Outside section 6 baseline. | Restore focus to the same task's checkbox, nearest remaining item, or the input if the list is empty. Or update nodes instead of rebuilding. |
| 2 | minor | index.html:46-47, 110-111 | Count and empty-state changes are not announced. | Add role="status" (or aria-live="polite") to #count and #empty. |
| 3 | minor | index.html:47 | footer inside main is not a contentinfo landmark; it is a status line. | Use `<p id="count" role="status">`. |
| 4 | minor | index.html:9, 15-16 | Control border #dcdce0 is about 1.3:1 on the background, below WCAG 1.4.11 3:1. Text contrast passes. | Darken control borders to about #8a8a90 or add a fill or shadow. |
| 5 | minor | index.html:91-96 | Duplicate task texts give identical delete-button names. | Append position, e.g. "Delete task: Buy milk, item 2 of 3". |

Verdict: pass with fixes

Note: the reviewer returned these findings without writing this file. Saved by the parent agent.
