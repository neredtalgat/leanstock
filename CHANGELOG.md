# Changelog

## 2026-04-27

### Added
- Integration test suite for authentication API: registration, login rate limit, unauthorized access, role-based denial.
- Integration test suite for transfer API contract scenarios (`create`, overselling conflict, approval requirement) with service-level mocking.
- New `CHANGELOG.md` to track deviations from the implementation blueprint.

### Changed
- Updated `tests/setup.ts` to use correct source imports and generate a valid bcrypt hash for seeded test users.
- Fixed relative import paths in existing unit/integration tests.
- Extended RBAC permissions to include `transfers:create`, `transfers:approve`, `transfers:ship`, `transfers:receive` for managerial roles.
- Updated transfer route validation to accept non-UUID string IDs (compatible with current Prisma `cuid` IDs).
- Updated auth schema `tenantId` validation to accept non-UUID string IDs (compatible with current Prisma `cuid` IDs).
- Improved global error handler to correctly read `statusCode` from custom application errors.
- Updated GitHub CI workflow to Node.js 20 + `npm ci` + migration/lint/test/build/docker sequence.

### Known Deviations From Blueprint
- Transfer and dead-stock domain logic still diverge from the original blueprint schema assumptions (the code references fields not fully aligned with the active Prisma schema).
- Full end-to-end transfer integration against a real database remains blocked until transfer service/database model alignment is completed.
