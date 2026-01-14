import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "dark" | "soft";
  size?: "sm" | "md" | "lg";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button className={`btn ${variant} ${size} ${className}`.trim()} {...rest}>
      {leftIcon ? <span className="btn-ico">{leftIcon}</span> : null}
      <span className="btn-text">{children}</span>
      {rightIcon ? <span className="btn-ico">{rightIcon}</span> : null}
    </button>
  );
}
