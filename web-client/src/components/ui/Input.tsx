import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
};

export default function Input({ label, hint, leftIcon, className = "", ...rest }: Props) {
  return (
    <div className={`field ${className}`}>
      {label ? <div className="field-label">{label}</div> : null}
      <div className="input-wrap">
        {leftIcon ? <div className="input-ico">{leftIcon}</div> : null}
        <input className="input" {...rest} />
      </div>
      {hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}
