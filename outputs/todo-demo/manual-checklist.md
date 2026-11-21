# Todo Demo: Manual Browser Checklist

Source: `design.md`, section 7.2 (Manual, browser, open `index.html` directly).

Tester: ______________________   Date: ______________   Browser: ______________________

Open `index.html` directly in the browser before you start.

---

- [ ] **1. Page load**
  - Action: Open the page.
  - Expected: Page loads with no console errors. Empty state shows "No tasks yet". Footer shows "0 items left".

- [ ] **2. Add a task with Enter**
  - Action: Type "Buy milk" and press Enter.
  - Expected: Task appears. Footer shows "1 item left". Input is empty and focused.

- [ ] **3. Submit an empty input**
  - Action: Submit an empty input.
  - Expected: Nothing is added.

- [ ] **4. Add three tasks**
  - Action: Add three tasks.
  - Expected: Footer shows "3 items left".

- [ ] **5. Check a task**
  - Action: Check one task.
  - Expected: Its text is struck through. Footer shows "2 items left".

- [ ] **6. Filter to Active**
  - Action: Click "Active".
  - Expected: Only the two unchecked tasks show. Footer still shows "2 items left". "Active" is pressed.

- [ ] **7. Filter to Done**
  - Action: Click "Done".
  - Expected: Only the checked task shows. Footer still shows "2 items left".

- [ ] **8. "Nothing here" message**
  - Action: With "Done" selected, check that the "Nothing here" message appears when no task is done. Then check one task.
  - Expected: "Nothing here" appears when no task is done. After checking one task, the message disappears.

- [ ] **9. Delete a task**
  - Action: Click "×" on a task.
  - Expected: It disappears. Footer updates.

- [ ] **10. Markup is not rendered**
  - Action: Enter `<b>bold</b>` as a task.
  - Expected: It shows as literal text, not bold.

- [ ] **11. Reload clears tasks**
  - Action: Reload the page.
  - Expected: All tasks are gone (in-memory only, expected).

- [ ] **12. No horizontal scroll at 320px**
  - Action: Resize the window to 320px wide.
  - Expected: No horizontal scroll.

---

Result: ____ of 12 steps passed.

Notes:

______________________________________________________________

______________________________________________________________

______________________________________________________________
