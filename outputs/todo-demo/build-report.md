# Build Report: Todo Demo

## Files written

All paths are under `/home/user/hx3d-website/outputs/todo-demo/`.

- `todo.js`: pure logic module (`createState`, `addTask`, `toggleTask`, `deleteTask`, `visibleTasks`, `countLeft`). No DOM access. Exports via `module.exports` in Node and `window.Todo` in the browser.
- `test.js`: Node tests using `require('assert')`. 29 cases matching design section 7.1, plus a runner that prints PASS/FAIL per case and exits with code 1 on any failure.
- `index.html`: markup, inline CSS, and an inline script that loads `todo.js` via `<script src="todo.js">` and wires the DOM to it. Rendering uses `textContent` only.
- `build-report.md`: this file.

## Status

Nothing was executed during the build (per instructions). Tests and the browser walkthrough in design section 7.2 have not been run yet.

## Commands to run

```
node test.js
```

Run from `/home/user/hx3d-website/outputs/todo-demo/`. Expected: 29 passed, 0 failed.

Manual check (no command needed): open `index.html` in a browser and walk through design section 7.2.
