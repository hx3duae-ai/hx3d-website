'use strict';

// Pure logic for the todo demo. No DOM access. Every mutating function
// returns a new state and never modifies its input.

const MAX_TEXT_LENGTH = 200;

function createState() {
  return { tasks: [], nextId: 1 };
}

function addTask(state, text) {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }
  const trimmed = text.trim();
  if (trimmed === '') {
    return state;
  }
  // Truncation can leave a trailing space at the cut point, so trim again to
  // keep the Task.text invariant (trimmed, non-empty, max 200).
  const value = trimmed.length > MAX_TEXT_LENGTH
    ? trimmed.slice(0, MAX_TEXT_LENGTH).trim()
    : trimmed;
  const task = { id: state.nextId, text: value, done: false };
  return {
    tasks: state.tasks.concat([task]),
    nextId: state.nextId + 1,
  };
}

function toggleTask(state, id) {
  const found = state.tasks.some(function (t) { return t.id === id; });
  if (!found) {
    return state;
  }
  return {
    tasks: state.tasks.map(function (t) {
      return t.id === id ? Object.assign({}, t, { done: !t.done }) : Object.assign({}, t);
    }),
    nextId: state.nextId,
  };
}

function deleteTask(state, id) {
  const found = state.tasks.some(function (t) { return t.id === id; });
  if (!found) {
    return state;
  }
  return {
    tasks: state.tasks.filter(function (t) { return t.id !== id; }),
    nextId: state.nextId,
  };
}

function visibleTasks(state, filter) {
  if (filter === 'all') {
    return state.tasks.slice();
  }
  if (filter === 'active') {
    return state.tasks.filter(function (t) { return t.done === false; });
  }
  if (filter === 'done') {
    return state.tasks.filter(function (t) { return t.done === true; });
  }
  throw new Error('Unknown filter: ' + String(filter));
}

function countLeft(state) {
  return state.tasks.filter(function (t) { return t.done === false; }).length;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createState, addTask, toggleTask, deleteTask, visibleTasks, countLeft };
} else {
  window.Todo = { createState, addTask, toggleTask, deleteTask, visibleTasks, countLeft };
}
