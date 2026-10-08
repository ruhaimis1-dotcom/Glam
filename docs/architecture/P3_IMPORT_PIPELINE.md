# P3 — CSV/Excel Import Pipeline

Status: development architecture. No production write path yet.

Flow: Upload -> Parse -> Preview -> Validate -> Resolve errors/duplicates -> Human confirmation -> Organization-scoped commit -> Result report.

MVP imports:
- Services: name, price_sar, minutes, category, active.
- Customers: name plus email and/or phone.

Privacy rules:
- Consent is never imported or inferred.
- Passport fields are not imported into a customer's Beauty Passport.
- A spreadsheet column named consent/passport_consent/photo_consent is rejected when populated.
- Imported customer records are CRM/contact records only; they do not become authenticated users automatically.
- Every committed row is bound server-side to the manager's current organization; organization_id from the file is ignored.
- File parsing and preview must not write database rows.

Excel support should convert the first selected sheet to the same normalized row contract as CSV before validation. Parser library selection remains an implementation decision; validation is format-independent.
