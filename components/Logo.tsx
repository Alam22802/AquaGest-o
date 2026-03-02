import React from 'react';
import { Fish } from 'lucide-react';

interface LogoProps {
  className?: string;
  variant?: 'large' | 'small';
}

const Logo: React.FC<LogoProps> = ({ className, variant = 'large' }) => {
  const isLarge = variant === 'large';
  
  return (
    <div className={`flex flex-col items-center ${isLarge ? 'gap-3' : 'gap-2'} ${className}`}>
      {/* Main Brand: Icon + AquaGestão */}
      <div className="flex items-center gap-2">
        <Fish className={isLarge ? 'w-10 h-10' : 'w-6 h-6'} />
        <h1 className={`${isLarge ? 'text-4xl' : 'text-xl'} font-black tracking-tighter uppercase leading-none`}>
          AquaGestão
        </h1>
      </div>
      
      {/* Sub Brand: CostaFoods Brasil */}
      <div className="flex flex-col items-center">
        <span className={`${isLarge ? 'text-xl' : 'text-sm'} font-black tracking-tighter leading-none`}>
          CostaFoods
        </span>
        <span className={`${isLarge ? 'text-[10px]' : 'text-[8px]'} font-bold tracking-[0.3em] uppercase opacity-70`}>
          Brasil
        </span>
      </div>
    </div>
  );
};

export default Logo;
