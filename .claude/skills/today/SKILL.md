---
name: today
description: Daily plan for the HX 3D UAE founder. Use when the user types /today or asks "وش عندي اليوم", "خطة اليوم", "plan my day". Reads today's calendar and urgent email, cross-references the people and projects against the HX Brain wiki and the HX OS CRM, and returns a prioritised plan.
---

# /today

1. **Calendar**: if a Google Calendar connector is available, list today's events (Asia/Dubai time). Otherwise say it is not connected and skip.
2. **Email**: with the Gmail connector, search `is:unread newer_than:2d` and `is:important newer_than:2d`. Keep only what needs a reply or action today.
3. **Pipeline**: read `hx-team/pipeline/*.md` for cards whose `stage` is not `done`, and any follow-up dates that are today or overdue.
4. **Instagram**: if the Ootto connector is available, pull yesterday's numbers and the DMs or comments waiting for a reply.
5. **Context**: for each person, company or project above, search `hx-brain/wiki/` (then `hx-brain/wiki/history/`) and `hx-os/data/clients.json`, and add one line of context.
6. **Output**, in Gulf Arabic, short:

```
☀️ اليوم <date>
1. [أهم شي] ... ليش: ...
2. ...
📅 المواعيد: ...
📬 ردود لازم اليوم: ...
💼 العملاء: (from pipeline)
📸 انستا: ...
```

Never send an email or a message. Draft only.
