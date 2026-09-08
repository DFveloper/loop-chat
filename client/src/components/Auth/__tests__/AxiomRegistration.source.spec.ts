import fs from 'node:fs';
import path from 'node:path';

describe('AXIOM registration integration', () => {
  const authDirectory = path.resolve(__dirname, '..');

  test('reuses Registration UI and selects the AXIOM endpoint only in AXIOM mode', () => {
    const registration = fs.readFileSync(path.join(authDirectory, 'Registration.tsx'), 'utf8');
    const axiom = fs.readFileSync(path.join(authDirectory, 'Axiom.tsx'), 'utf8');
    const dataService = fs.readFileSync(
      path.resolve(authDirectory, '../../../../packages/data-provider/src/data-service.ts'),
      'utf8',
    );

    expect(registration).toContain("queryParams.get('axiom') === '1'");
    expect(registration).toMatch(/useRegisterUserMutation\([\s\S]*isAxiom,\s*\);/);
    expect(axiom).not.toContain('confirm_password');
    expect(axiom).not.toContain('Registration form');
    expect(dataService).toContain('axiom ? endpoints.axiomRegister() : endpoints.register()');
  });
});
