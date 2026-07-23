import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  // iOS Button Philosophy: Physical interactions, no sharp edges.
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 select-none";
  
  const variants = {
    // Primary: Deep Forest Green background, White text
    primary: "bg-[#3A5C34] text-white rounded-full hover:bg-[#2d4a29] shadow-sm",
    
    // Secondary: Soft Pink background, Deep Burgundy text
    secondary: "bg-[#FCCAE2] text-[#5F2427] rounded-full hover:bg-[#fbbad6]",
    
    // Ghost: Deep Green text, subtle pink hover
    ghost: "text-[#3A5C34] hover:bg-[#FCCAE2]/20 rounded-lg",
    
    // Icon: Deep Green text, pink hover
    icon: "text-[#3A5C34] hover:bg-[#FCCAE2]/30 rounded-full p-2"
  };

  const sizes = {
    sm: "px-3 py-1 text-[13px] leading-4",
    md: "px-5 py-2 text-[15px] leading-5",
    lg: "px-6 py-3 text-[17px] leading-6"
  };

  const finalClass = `${baseStyles} ${variants[variant]} ${variant === 'icon' ? '' : sizes[size]} ${className}`;

  return (
    <button className={finalClass} {...props}>
      {children}
    </button>
  );
};