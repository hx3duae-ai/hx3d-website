# Todo demo

A small single-page todo list. You can add tasks, mark them done, delete them, and filter the list to All, Active, or Done. It shows a count of items left.

## What it does

- Add a task from the input box (Enter or the Add button). Blank or whitespace-only input is ignored.
- Tick the checkbox to mark a task done. Tick it again to undo.
- Delete a task with the × button.
- Filter the list with All, Active, or Done.
- Shows "No tasks yet" when the list is empty, "Nothing here" when a filter hides everything, and "N items left" as a footer.
- Task text is trimmed and capped at 200 characters.

## How to open it

No build step and no server. Open `index.html` directly in a browser (double-click it, or drag it into a browser window). `index.html` loads `todo.js` from the same folder, so keep the two files together.

## How to run the tests

The tests use Node's built-in `assert` module and need no install.

```
node test.js
```

Each case prints `PASS` or `FAIL`. The last line gives the totals. The process exits with status 1 if any test fails.

## File layout

```
todo-demo/
  index.html   Page markup, styles, and the DOM code that renders the list
  todo.js      Pure logic: state, add, toggle, delete, filter, count (no DOM access)
  test.js      Unit tests for todo.js, run with node
  README.md    This file
```

`todo.js` exports its functions through `module.exports` under Node and sets `window.Todo` in the browser.

The logic functions never change their input. Each one returns a new state object:

- `createState()`
- `addTask(state, text)`
- `toggleTask(state, id)`
- `deleteTask(state, id)`
- `visibleTasks(state, filter)` where filter is `'all'`, `'active'`, or `'done'`
- `countLeft(state)`

## Known limits

- **In-memory only.** Tasks live in a JavaScript variable on the page. Reloading or closing the tab clears the list. Nothing is written to `localStorage`, a server, or a file.
- **Single list, single browser.** There is no sync and no sharing between tabs or devices.
- **No editing.** To change a task you must delete it and add it again.
- **Text limit.** Input is capped at 200 characters, both in the input field and in the logic. Longer text is truncated.
- **IDs are not reused.** Ids keep counting up within a session, even after deletes.
- **No ordering or due dates.** Tasks appear in the order they were added. There are no priorities, tags, or dates.
- **Needs a browser with script support.** The page has no fallback for users without JavaScript.
