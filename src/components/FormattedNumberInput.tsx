import React, { useState, useEffect } from 'react';

interface FormattedNumberInputProps {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  placeholder = '0.00',
  className = '',
  required = false,
  disabled = false,
  id,
}) => {
  // Helper to format a number into xx,xxx,xxx.xx string
  const formatToStandard = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) return '';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const [displayValue, setDisplayValue] = useState<string>(() => formatToStandard(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync with value prop if updated externally and user isn't currently focused
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatToStandard(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;

    // Remove all commas first
    const clean = inputVal.replace(/,/g, '');

    // Split by decimal point
    const parts = clean.split('.');
    if (parts.length > 2) {
      // More than one dot entered, ignore
      return;
    }

    const intPart = parts[0].replace(/[^0-9]/g, '');
    let decPart = parts.length > 1 ? parts[1].replace(/[^0-9]/g, '').slice(0, 2) : null;

    // Format integer part with commas
    const formattedInt = intPart ? parseInt(intPart, 10).toLocaleString('en-US') : '';

    let newDisplay = '';
    if (intPart === '' && decPart !== null) {
      newDisplay = `0.${decPart}`;
    } else if (decPart !== null) {
      newDisplay = `${formattedInt}.${decPart}`;
    } else {
      newDisplay = formattedInt;
    }

    setDisplayValue(newDisplay);

    // Calculate numeric value for state
    if (intPart === '' && decPart === null) {
      onChange(null);
    } else {
      const numericString = `${intPart || '0'}${decPart !== null ? '.' + decPart : ''}`;
      const parsed = parseFloat(numericString);
      onChange(isNaN(parsed) ? null : parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!displayValue || displayValue.trim() === '') {
      setDisplayValue('');
      onChange(null);
      return;
    }

    const numeric = parseFloat(displayValue.replace(/,/g, ''));
    if (!isNaN(numeric)) {
      setDisplayValue(formatToStandard(numeric));
      onChange(numeric);
    } else {
      setDisplayValue('');
      onChange(null);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      required={required}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};
