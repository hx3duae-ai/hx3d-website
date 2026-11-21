# Worker 3: Security review (reviewer)

Summary: No innerHTML, eval, or network calls. User text is set with textContent. Two minor items: a surrogate-pair split at the 200-character cut, and no Content-Security-Policy.

| # | Severity | Where | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | minor | todo.js:22-23 | slice(0, 200) can split a surrogate pair (emoji at index 199/200), leaving a lone high surrogate. Not an injection risk; stored value is malformed. | After slicing, drop a trailing high surrogate (0xD800-0xDBFF). Add a boundary emoji test. |
| 2 | minor | index.html:7-50 | No CSP. A future innerHTML regression would not be blocked by the browser. | Add a CSP meta tag: default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'. |

Checked and clean: no innerHTML/outerHTML/insertAdjacentHTML/eval/new Function; textContent used for task text; maxlength=200 plus trim and truncate; no fetch/XHR/WebSocket; no localStorage or cookies; favicon is data: (no request).

Verdict: pass with fixes

Note: the reviewer returned these findings without writing this file. Saved by the parent agent.
