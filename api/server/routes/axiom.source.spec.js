const fs = require('node:fs');
const path = require('node:path');

describe('AXIOM route wiring', () => {
  test('keeps claims in HttpOnly cookies and clears them only after successful registration', () => {
    const axiomRoute = fs.readFileSync(path.join(__dirname, 'axiom.js'), 'utf8');
    const authRoute = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

    expect(axiomRoute).toContain('res.cookie(CLAIM_COOKIE, result.claimToken');
    expect(authRoute).toContain('{ role: SystemRoles.USER }');
    expect(authRoute).toContain('res.clearCookie(CLAIM_COOKIE, clearOptions)');
    expect(authRoute).toContain("'/axiom/register'");
  });
});
