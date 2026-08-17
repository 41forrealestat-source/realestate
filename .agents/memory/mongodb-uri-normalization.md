---
name: MongoDB URI handling
description: Environment-specific constraints for the external MongoDB Atlas connection used by this project.
---

The MongoDB secret may be pasted with code fences or surrounding text, so the server extracts the URI without logging the secret. Atlas SRV connection strings must not contain an explicit port, and passwords with reserved URI characters must be URL-encoded.

**Why:** Startup failures were caused by copied formatting and an invalid SRV port before the driver could make a network request.

**How to apply:** Keep connection-string cleanup local to the server bootstrap, never print the value, and ask for a corrected secret when the value is still a placeholder or malformed.