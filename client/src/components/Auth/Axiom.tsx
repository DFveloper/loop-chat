import React, { useContext, useState } from 'react';
import { ThemeContext, Spinner, Button } from '@librechat/client';
import { useNavigate } from 'react-router-dom';
import { useAxiomRedeemMutation } from 'librechat-data-provider/react-query';
import type { TError } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { ErrorMessage } from './ErrorMessage';

const AXIOM_KEY_PATTERN = /^[0-9a-f]{4}-[0-9a-f]{4}$/;

const Axiom: React.FC = () => {
  useContext(ThemeContext);
  const navigate = useNavigate();
  const localize = useLocalize();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const redeem = useAxiomRedeemMutation({
    onSuccess: () => navigate('/register?axiom=1', { replace: true }),
    onError: (requestError) =>
      setError(
        (requestError as TError).response?.data?.message ?? localize('com_auth_axiom_invalid'),
      ),
  });
  const valid = AXIOM_KEY_PATTERN.test(key);

  return (
    <>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <form
        className="mt-6"
        aria-label={localize('com_auth_axiom_form')}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) {
            setError('');
            redeem.mutate({ key });
          }
        }}
      >
        <div className="mb-4">
          <div className="relative">
            <input
              id="axiom-key"
              type="text"
              value={key}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={9}
              aria-label={localize('com_auth_axiom_key')}
              aria-invalid={key.length > 0 && !valid}
              onChange={(event) => setKey(event.target.value.trim().toLowerCase())}
              className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 font-mono text-text-primary duration-200 hover:border-border-light focus:border-green-500 focus:outline-none focus-visible:border-green-500"
              placeholder=" "
              data-testid="axiom-key"
            />
            <label
              htmlFor="axiom-key"
              className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500"
            >
              {localize('com_auth_axiom_key')}
            </label>
          </div>
          {key.length > 0 && !valid && (
            <span role="alert" className="mt-1 text-sm text-red-500">
              {localize('com_auth_axiom_format')}
            </span>
          )}
        </div>
        <Button
          disabled={!valid || redeem.isLoading}
          type="submit"
          aria-label={localize('com_auth_axiom_redeem')}
          variant="submit"
          className="h-12 w-full rounded-2xl"
        >
          {redeem.isLoading ? <Spinner /> : localize('com_auth_axiom_redeem')}
        </Button>
      </form>
    </>
  );
};

export default Axiom;
