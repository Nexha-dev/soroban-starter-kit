/**
 * ApproveForm — form for setting token allowances.
 * Requirements: 4.4, 4.5, 4.6
 */

import React, { useState } from 'react';
import { useTransactionQueue } from '../../context/TransactionQueueContext';
import { isValidStellarAddress } from '../../utils/tokenValidation';

const STROOPS = 10_000_000;

export interface ApproveFormProps {
  contractId: string;
  onSuccess: (txId: string) => void;
}

export function ApproveForm({ contractId, onSuccess }: ApproveFormProps): JSX.Element {
  const { createTransaction } = useTransactionQueue();

  const [spender, setSpender] = useState('');
  const [amount, setAmount] = useState('');
  const [spenderError, setSpenderError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateSpender = () => {
    if (!isValidStellarAddress(spender.trim())) {
      setSpenderError('Enter a valid Stellar address (G followed by 55 base-32 characters).');
      return false;
    }
    setSpenderError(null);
    return true;
  };

  const validateAmount = () => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) {
      setAmountError('Amount must be a positive number.');
      return false;
    }
    setAmountError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const spenderOk = validateSpender();
    const amountOk = validateAmount();
    if (!spenderOk || !amountOk) return;

    setLoading(true);
    setSubmitError(null);

    try {
      const amountStroops = Math.round(parseFloat(amount) * STROOPS);
      const tx = await createTransaction('approve', contractId, 'approve', {
        spender: spender.trim(),
        amount: String(amountStroops),
      });
      onSuccess(tx.id);
      setSpender('');
      setAmount('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to queue approval transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="tmd-approve-form" onSubmit={handleSubmit} noValidate>
      <h4>Approve Allowance</h4>

      <div className="form-group">
        <label className="form-label" htmlFor="approve-spender">Spender Address</label>
        <input
          id="approve-spender"
          className={`form-input${spenderError ? ' txf-input-error' : ''}`}
          value={spender}
          placeholder="G..."
          onChange={(e) => { setSpender(e.target.value); setSpenderError(null); }}
          onBlur={validateSpender}
          aria-invalid={!!spenderError}
          aria-describedby={spenderError ? 'approve-spender-err' : undefined}
          autoComplete="off"
        />
        {spenderError && (
          <p id="approve-spender-err" className="txf-error" role="alert">{spenderError}</p>
        )}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="approve-amount">Allowance Amount</label>
        <input
          id="approve-amount"
          className={`form-input${amountError ? ' txf-input-error' : ''}`}
          type="number"
          min="0"
          step="any"
          value={amount}
          placeholder="0.00"
          onChange={(e) => { setAmount(e.target.value); setAmountError(null); }}
          onBlur={validateAmount}
          aria-invalid={!!amountError}
          aria-describedby={amountError ? 'approve-amount-err' : undefined}
        />
        {amountError && (
          <p id="approve-amount-err" className="txf-error" role="alert">{amountError}</p>
        )}
      </div>

      {submitError && (
        <p className="txf-error" role="alert">✕ {submitError}</p>
      )}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? 'Queuing…' : 'Approve'}
      </button>
    </form>
  );
}

export default ApproveForm;
