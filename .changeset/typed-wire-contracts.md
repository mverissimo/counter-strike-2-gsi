---
"@counter-strike-2-gsi/types": patch
"@counter-strike-2-gsi/client": patch
"@counter-strike-2-gsi/server": patch
"@counter-strike-2-gsi/handlers": patch
---

Check browser transport envelopes and object payloads before dispatch, report malformed messages through the parse-error callback, and restore serialized errors as Error instances. Keep payload and event types derived from the canonical schema without duplicating event-specific validation in the client.

Correlate derived event names and payloads, preserve runtime-specific request types in combined factories, and make manager snapshots deeply readonly and frozen. Enable stricter workspace compiler settings and use Vite+'s integrated typechecking during readiness checks.
