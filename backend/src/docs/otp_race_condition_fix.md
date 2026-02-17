# Architecture Decision: Atomic OTP Verification

## Problem: Race Condition (Double-Submit Vulnerability)
The current flow allows replay attacks:
1. Thread A reads `consumed = false`
2. Thread B reads `consumed = false`
3. Thread A checks pass -> marks `consumed = true` -> Success
4. Thread B checks pass -> marks `consumed = true` -> Success

Result: **OTP used twice**.

## Solution: Atomic Update with Check
We combine the check and the update into a single atomic SQL operation.

Instead of:
`if (read(consumed) == false) { update(consumed=true); return success; }`

We do:
`UPDATE otps SET consumed = true WHERE id = $id AND consumed = false RETURNING id`

If the row was already consumed by another request, the WHERE clause fails, no rows are updated/returned, and we know to fail the request.

## SQL Implementation
This relies on Postgres's inherent row locking during UPDATE.
If `consumed` is already TRUE, the `WHERE` clause filters it out.
If two transactions try simultaneously, Postgres locks the row. The first one wins and sets it to true. The second one sees `consumed=true` (after wait) and updates nothing.

## TypeScript Implementation
We will replace the final `update` call with a conditional update that returns the modified row count or data.
If 0 rows modified, someone else consumed it.
