'use strict';

const assert = require('assert');
const Todo = require('./todo.js');

const { createState, addTask, toggleTask, deleteTask, visibleTasks, countLeft } = Todo;

const cases = [];
function test(group, name, fn) {
  cases.push({ name: group + ': ' + name, fn });
}

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

// createState
test('createState', 'returns empty state with nextId 1', function () {
  assert.deepStrictEqual(createState(), { tasks: [], nextId: 1 });
});

// addTask
test('addTask', 'adds task with id 1 and done false on empty state', function () {
  const s = addTask(createState(), 'Buy milk');
  assert.deepStrictEqual(s.tasks, [{ id: 1, text: 'Buy milk', done: false }]);
});

test('addTask', 'trims surrounding whitespace', function () {
  const s = addTask(createState(), '  hello  ');
  assert.strictEqual(s.tasks[0].text, 'hello');
});

test('addTask', 'returns same state for empty string', function () {
  const s0 = createState();
  assert.strictEqual(addTask(s0, ''), s0);
});

test('addTask', 'returns same state for whitespace-only string', function () {
  const s0 = createState();
  assert.strictEqual(addTask(s0, ' \t  '), s0);
});

test('addTask', 'throws TypeError for non-string input', function () {
  assert.throws(function () { addTask(createState(), null); }, TypeError);
  assert.throws(function () { addTask(createState(), 42); }, TypeError);
});

test('addTask', 'truncates text longer than 200 to exactly 200', function () {
  const s = addTask(createState(), 'a'.repeat(250));
  assert.strictEqual(s.tasks[0].text.length, 200);
  // Cut point lands on a space: the stored text must still be trimmed.
  const t = addTask(createState(), 'a'.repeat(199) + ' b');
  assert.strictEqual(t.tasks[0].text, 'a'.repeat(199));
});

test('addTask', 'increments nextId by one per successful add', function () {
  const s1 = addTask(createState(), 'a');
  const s2 = addTask(s1, 'b');
  assert.strictEqual(s1.nextId, 2);
  assert.strictEqual(s2.nextId, 3);
});

test('addTask', 'two sequential adds produce ids 1 and 2 in order', function () {
  const s = addTask(addTask(createState(), 'first'), 'second');
  assert.deepStrictEqual(s.tasks.map(function (t) { return t.id; }), [1, 2]);
  assert.deepStrictEqual(s.tasks.map(function (t) { return t.text; }), ['first', 'second']);
});

test('addTask', 'does not mutate input state', function () {
  const s = addTask(createState(), 'a');
  const before = snapshot(s);
  const tasksRef = s.tasks;
  addTask(s, 'b');
  assert.strictEqual(s.tasks, tasksRef);
  assert.strictEqual(s.tasks.length, 1);
  assert.strictEqual(s.nextId, 2);
  assert.deepStrictEqual(snapshot(s), before);
});

// toggleTask
test('toggleTask', 'flips done false -> true -> false', function () {
  const s1 = addTask(createState(), 'a');
  const s2 = toggleTask(s1, 1);
  assert.strictEqual(s2.tasks[0].done, true);
  const s3 = toggleTask(s2, 1);
  assert.strictEqual(s3.tasks[0].done, false);
});

test('toggleTask', 'does not change other tasks', function () {
  const s1 = addTask(addTask(createState(), 'a'), 'b');
  const s2 = toggleTask(s1, 1);
  assert.deepStrictEqual(s2.tasks[1], s1.tasks[1]);
  assert.strictEqual(s2.tasks[0].text, 'a');
});

test('toggleTask', 'returns same state for unknown id', function () {
  const s = addTask(createState(), 'a');
  assert.strictEqual(toggleTask(s, 99), s);
});

test('toggleTask', 'does not mutate input state', function () {
  const s = addTask(addTask(createState(), 'a'), 'b');
  const before = snapshot(s);
  toggleTask(s, 1);
  assert.deepStrictEqual(snapshot(s), before);
});

// deleteTask
test('deleteTask', 'removes matching task and keeps order of others', function () {
  let s = addTask(createState(), 'a');
  s = addTask(s, 'b');
  s = addTask(s, 'c');
  const after = deleteTask(s, 2);
  assert.deepStrictEqual(after.tasks.map(function (t) { return t.id; }), [1, 3]);
  assert.deepStrictEqual(after.tasks.map(function (t) { return t.text; }), ['a', 'c']);
});

test('deleteTask', 'returns same state for unknown id', function () {
  const s = addTask(createState(), 'a');
  assert.strictEqual(deleteTask(s, 99), s);
});

test('deleteTask', 'does not reuse ids after delete', function () {
  let s = addTask(createState(), 'a');
  s = addTask(s, 'b');
  s = deleteTask(s, 2);
  s = addTask(s, 'c');
  assert.strictEqual(s.tasks[s.tasks.length - 1].id, 3);
});

test('deleteTask', 'does not mutate input state', function () {
  const s = addTask(addTask(createState(), 'a'), 'b');
  const before = snapshot(s);
  deleteTask(s, 1);
  assert.deepStrictEqual(snapshot(s), before);
});

// visibleTasks
const mixed = function () {
  let s = addTask(createState(), 'a'); // id 1
  s = addTask(s, 'b');                 // id 2
  s = addTask(s, 'c');                 // id 3
  return toggleTask(s, 2);             // id 2 done
};

test('visibleTasks', 'all returns every task in order', function () {
  const ids = visibleTasks(mixed(), 'all').map(function (t) { return t.id; });
  assert.deepStrictEqual(ids, [1, 2, 3]);
});

test('visibleTasks', 'active returns only not-done tasks', function () {
  const list = visibleTasks(mixed(), 'active');
  assert.deepStrictEqual(list.map(function (t) { return t.id; }), [1, 3]);
  list.forEach(function (t) { assert.strictEqual(t.done, false); });
});

test('visibleTasks', 'done returns only done tasks', function () {
  const list = visibleTasks(mixed(), 'done');
  assert.deepStrictEqual(list.map(function (t) { return t.id; }), [2]);
  list.forEach(function (t) { assert.strictEqual(t.done, true); });
});

test('visibleTasks', 'empty state returns [] for each filter', function () {
  const s = createState();
  assert.deepStrictEqual(visibleTasks(s, 'all'), []);
  assert.deepStrictEqual(visibleTasks(s, 'active'), []);
  assert.deepStrictEqual(visibleTasks(s, 'done'), []);
});

test('visibleTasks', 'throws Error containing bad filter value', function () {
  assert.throws(function () { visibleTasks(mixed(), 'archived'); }, function (err) {
    return err instanceof Error && err.message.indexOf('archived') !== -1;
  });
});

test('visibleTasks', 'does not change the state tasks array', function () {
  const s = mixed();
  const tasksRef = s.tasks;
  const before = snapshot(s);
  visibleTasks(s, 'active');
  visibleTasks(s, 'done');
  assert.strictEqual(s.tasks, tasksRef);
  assert.deepStrictEqual(snapshot(s), before);
});

// countLeft
test('countLeft', 'returns 0 for empty state', function () {
  assert.strictEqual(countLeft(createState()), 0);
});

test('countLeft', 'returns number of not-done tasks', function () {
  // 3 total, 1 done -> 2 left
  assert.strictEqual(countLeft(mixed()), 2);
});

test('countLeft', 'does not change when filter changes', function () {
  const s = mixed();
  const expected = countLeft(s);
  ['all', 'active', 'done'].forEach(function (f) {
    visibleTasks(s, f);
    assert.strictEqual(countLeft(s), expected);
  });
});

test('countLeft', 'returns 0 when all tasks are done', function () {
  let s = addTask(addTask(createState(), 'a'), 'b');
  s = toggleTask(toggleTask(s, 1), 2);
  assert.strictEqual(countLeft(s), 0);
});

// Module shape
test('module', 'exposes all six named functions', function () {
  ['createState', 'addTask', 'toggleTask', 'deleteTask', 'visibleTasks', 'countLeft'].forEach(function (name) {
    assert.strictEqual(typeof Todo[name], 'function', name + ' should be a function');
  });
});

// Runner
let failures = 0;
cases.forEach(function (c) {
  try {
    c.fn();
    console.log('PASS ' + c.name);
  } catch (err) {
    failures += 1;
    console.log('FAIL ' + c.name + ' -- ' + (err && err.message ? err.message : err));
  }
});

console.log('');
console.log((cases.length - failures) + ' passed, ' + failures + ' failed, ' + cases.length + ' total');
if (failures > 0) {
  process.exit(1);
}
