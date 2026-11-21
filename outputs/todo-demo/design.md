# Todo Demo: Design Spec

Status: Draft for the implementer stage. No code is written at this stage.

## 1. Goals

Build a small, single-page todo app with these capabilities:

1. Add a task.
2. Mark a task done or undone.
3. Delete a task.
4. Filter the visible list by All, Active, or Done.
5. Show a count of items left (active tasks), regardless of the current filter.

Constraints:

- The page is one static `index.html`. No build step, no framework, no network calls.
- All logic lives in `todo.js`, a pure JavaScript module with no DOM access. It must run under Node with `require`, and it must also load in a browser as a plain `<script>`.
- Tasks live in memory only. Reloading the page clears them. There is no `localStorage`, no server, and no database.
- Tests live in `test.js`, use Node's built-in `assert` module, and run with `node test.js` with no dependencies.

Non-goals for this version:

- Persistence across reloads.
- Editing a task's text after creation.
- Due dates, priorities, tags, or multiple lists.
- "Clear completed" (may be added later; not required).
- Accessibility beyond basic semantics (see section 6), and no animations.

## 2. File List

All paths are relative to `outputs/todo-demo/`.

| File | Purpose | Created by |
|---|---|---|
| `design.md` | This spec. | Designer |
| `todo.js` | Pure logic module. No DOM, no `window`, no `document` references. Exports functions. | Implementer |
| `index.html` | Markup, minimal inline CSS, and a small inline `<script>` that wires DOM events to `todo.js`. Loads `todo.js` with a `<script src="todo.js">` tag before the inline script. | Implementer |
| `test.js` | Node tests using `require('assert')`. Requires `./todo.js`. Exits non-zero on failure. | Implementer |

The DOM glue lives in `index.html` to keep the file count at the three requested files. Do not create additional source files.

## 3. Data Model

### 3.1 Task

```
Task {
  id:   number    // positive integer, unique within a list, never reused
  text: string    // trimmed, non-empty, max 200 characters
  done: boolean   // false on creation
}
```

### 3.2 List state

```
TodoState {
  tasks:  Task[]  // in insertion order (oldest first)
  nextId: number  // starts at 1, increments on each add
}
```

### 3.3 Filter

A string with exactly one of three values: `"all"`, `"active"`, `"done"`. The default is `"all"`. The filter is UI state. It is passed into the pure functions as an argument; it is not stored inside `TodoState`.

### 3.4 Immutability rule

Every mutating function returns a new `TodoState` object and never modifies its input. The input state and its `tasks` array must be unchanged after the call. This makes the logic straightforward to test.

## 4. Module Interface (`todo.js`)

### 4.1 Exports

```
createState()                       -> TodoState
addTask(state, text)                -> TodoState
toggleTask(state, id)               -> TodoState
deleteTask(state, id)               -> TodoState
visibleTasks(state, filter)         -> Task[]
countLeft(state)                    -> number
```

### 4.2 Behavior

**createState()**
Returns `{ tasks: [], nextId: 1 }`.

**addTask(state, text)**
- Trim `text`. If the trimmed result is empty, return `state` unchanged (same object).
- If `text` is not a string, throw a `TypeError`.
- If the trimmed text is longer than 200 characters, truncate it to 200. Do not throw.
- Otherwise return a new state with a new task `{ id: state.nextId, text: trimmed, done: false }` appended, and `nextId` incremented by 1.

**toggleTask(state, id)**
- Flip `done` on the task with matching `id`. Return a new state.
- If no task has that `id`, return `state` unchanged (same object).

**deleteTask(state, id)**
- Remove the task with matching `id`. Return a new state. `nextId` is unchanged.
- If no task has that `id`, return `state` unchanged (same object).

**visibleTasks(state, filter)**
- `"all"`: return all tasks.
- `"active"`: return tasks where `done === false`.
- `"done"`: return tasks where `done === true`.
- Any other value: throw an `Error` whose message includes the bad value.
- Order is preserved. Returns a new array.

**countLeft(state)**
Returns the number of tasks where `done === false`. This count ignores the filter.

### 4.3 Module format

`todo.js` must work in both environments:

```js
// Node: require('./todo.js')
// Browser: <script src="todo.js"> exposes window.Todo
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createState, addTask, toggleTask, deleteTask, visibleTasks, countLeft };
} else {
  window.Todo = { createState, addTask, toggleTask, deleteTask, visibleTasks, countLeft };
}
```

No top-level code may touch `document` or `window` except inside the `else` branch.

## 5. UI Layout (`index.html`)

### 5.1 Structure, top to bottom

Single column, centered, maximum width 480px.

1. **Heading**: `<h1>Todo</h1>`.
2. **Add form**: `<form>` containing
   - a text `<input>` with placeholder "What needs doing?" and `maxlength="200"`, and
   - an "Add" `<button type="submit">`.
   Submitting with Enter works because it is a real form. An empty or whitespace-only submission adds nothing. The input is cleared and keeps focus after a successful add.
3. **Filter bar**: three buttons in a row, labeled "All", "Active", "Done". The active filter has `aria-pressed="true"` and a visually distinct style. The other two have `aria-pressed="false"`.
4. **Task list**: `<ul>`. One `<li>` per visible task containing, left to right:
   - a checkbox `<input type="checkbox">` that reflects `done`, with a label that is the task text,
   - the task text. Done tasks show with strike-through and a muted color,
   - a delete button labeled "×" with `aria-label="Delete task: <text>"`.
5. **Empty state**: when the visible list is empty, show a single line of muted text. Use "No tasks yet" when there are no tasks at all, and "Nothing here" when the filter hides everything.
6. **Footer**: text "N items left" (plural), "1 item left" (singular), or "0 items left". The count comes from `countLeft`, so it does not change with the filter.

### 5.2 Rendering rules

- The DOM is re-rendered from state after every action. Keep it simple: rebuild the list from `visibleTasks`.
- Task text is inserted with `textContent`, never `innerHTML`. This prevents markup injection from user input.
- The filter bar, count, and list all update from the same state object in one render pass.

### 5.3 Interactions

| Action | Result |
|---|---|
| Submit form with text | Task appended. Input cleared. Render. |
| Submit form empty | Nothing changes. Input keeps focus. |
| Click checkbox | Task toggled. Render. |
| Click "×" | Task deleted. Render. |
| Click filter button | Filter changes. Render. |

### 5.4 Styling

- Inline `<style>` in `index.html`, under about 60 lines.
- Neutral palette: near-white background, dark text, one accent color for the active filter.
- Font: system UI stack.
- Layout must work at phone width (320px and up) with no horizontal scroll.

## 6. Accessibility Baseline

- Real `<form>`, `<button>`, `<input>`, and `<label>` elements. No clickable `<div>`s.
- Each checkbox has a label. Each delete button has an `aria-label` that includes the task text.
- Filter buttons use `aria-pressed`.
- Visible focus styles are not removed.

## 7. Acceptance Tests

### 7.1 Automated (`node test.js`)

`test.js` must cover at least these cases. Each case uses `assert` from Node's standard library and prints a pass/fail line. The script exits with code 1 on the first failure, or after running all cases and reporting failures.

**createState**
1. Returns `{ tasks: [], nextId: 1 }`.

**addTask**
2. Adds a task with `id` 1, `done` false, and the given text, on an empty state.
3. Trims surrounding whitespace from the text.
4. Returns the same state object for an empty string.
5. Returns the same state object for a whitespace-only string.
6. Throws `TypeError` when `text` is not a string (for example `null` or `42`).
7. Truncates text longer than 200 characters to exactly 200.
8. Increments `nextId` by one per successful add.
9. Two sequential adds produce ids 1 and 2 in insertion order.
10. Does not mutate the input state (the `tasks` array length and `nextId` are unchanged).

**toggleTask**
11. Flips `done` from false to true, then true to false on a second call.
12. Does not change other tasks.
13. Returns the same state object for an unknown id.
14. Does not mutate the input state.

**deleteTask**
15. Removes the task with the matching id and keeps the order of the others.
16. Returns the same state object for an unknown id.
17. Does not reuse ids: after deleting id 2 and adding a new task, the new id is 3, not 2.
18. Does not mutate the input state.

**visibleTasks**
19. `"all"` returns every task in order.
20. `"active"` returns only tasks with `done === false`.
21. `"done"` returns only tasks with `done === true`.
22. An empty state returns `[]` for each of the three filters.
23. A filter value outside the three allowed values throws an `Error` whose message contains that value.
24. The filter does not change the state's `tasks` array.

**countLeft**
25. Returns 0 for an empty state.
26. Returns the number of not-done tasks, for example 2 active out of 3 total gives 2.
27. Does not change when the filter changes. (Call `visibleTasks` with each filter and confirm `countLeft` returns the same value.)
28. Returns 0 when all tasks are done.

**Module shape**
29. `require('./todo.js')` exposes all six named functions as functions.

### 7.2 Manual (browser, open `index.html` directly)

1. Page loads with no console errors. Empty state shows "No tasks yet". Footer shows "0 items left".
2. Type "Buy milk" and press Enter. Task appears. Footer shows "1 item left". Input is empty and focused.
3. Submit an empty input. Nothing is added.
4. Add three tasks. Footer shows "3 items left".
5. Check one task. Its text is struck through. Footer shows "2 items left".
6. Click "Active". Only the two unchecked tasks show. Footer still shows "2 items left". "Active" is pressed.
7. Click "Done". Only the checked task shows. Footer still shows "2 items left".
8. With "Done" selected, the "Nothing here" message appears when no task is done. Check one, then confirm the message disappears.
9. Click "×" on a task. It disappears. Footer updates.
10. Enter `<b>bold</b>` as a task. It shows as literal text, not bold.
11. Reload the page. All tasks are gone (in-memory only, expected).
12. Resize to 320px wide. No horizontal scroll.

## 8. Implementation Order (for the implementer stage)

1. `todo.js` with the module format from section 4.3.
2. `test.js` covering section 7.1. Run `node test.js` until it passes.
3. `index.html` wired to `todo.js` per section 5.
4. Walk through section 7.2 in a browser.

## 9. Open Questions

None blocking. Defaults chosen above:
- Maximum task length is 200 characters, truncated rather than rejected.
- Filter is held in UI state, not in `TodoState`.
- "Clear completed" is excluded from this version.
