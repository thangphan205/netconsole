## Summary

<!-- What does this PR do and why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Security fix
- [ ] Refactor
- [ ] Docs / config

## Security checklist

- [ ] No credentials, tokens, or keys committed (detect-secrets baseline updated if needed)
- [ ] User input touching device CLI commands is validated/sanitized
- [ ] New endpoints restricted to appropriate role (superuser vs regular user)
- [ ] Passwords/credentials not returned in API responses
- [ ] No new plaintext storage of secrets (use `core/crypto.py` for device credentials)

## Test plan

- [ ] Existing tests pass (`docker compose exec backend bash /app/tests-start.sh`)
- [ ] New logic covered by tests
- [ ] Manually tested on device or with mock

## Related issues

<!-- Closes # -->
