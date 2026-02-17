# Architecture Decision: Duplicate Version Prevention

## Problem: Race Condition in Versioning
Current logic:
1. `SELECT MAX(version) FROM invoice_versions WHERE invoice_id = X` -> returns 5
2. `INSERT INTO invoice_versions (invoice_id, version) VALUES (X, 6)`

If two users do Step 1 simultaneously, they both get 5, and both insert 6. Now we have two "Version 6" rows.

## Solution: Database Constraints (The Gold Standard)
We will enforce uniqueness at the database level.

### 1. Unique Index
We add a unique constraint on `(invoice_id, version_number)`.
```sql
CREATE UNIQUE INDEX idx_invoice_versions_unique 
ON invoice_versions (invoice_id, version_number);
```

### 2. Insert Strategy
- Attempt to insert Version N+1.
- If it fails with `23505 (unique_violation)`, it means someone else beat us.
- **Handling**:
  - **Option A (Retry)**: Re-fetch latest version and try again (Good for non-interactive updates).
  - **Option B (Reject)**: Tell user "Someone else edited this invoice. Please refresh." (Better for UI consistency).

## Why this is MVP-Safe
- **Zero Overhead**: The index is needed for lookups anyway.
- **100% Correct**: The DB kernel guarantees uniqueness.
- **Simple Code**: No locking or complex transaction levels needed in Node.js.
