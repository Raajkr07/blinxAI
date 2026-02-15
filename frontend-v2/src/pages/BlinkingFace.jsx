import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";

export function BlinkingFace({ className = "w-16 h-16" }) {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let timeoutId;

    const scheduleBlink = () => {
      const interval = 2000 + Math.random() * 3000;

      timeoutId = setTimeout(() => {
        setIsBlinking(true);

        setTimeout(() => setIsBlinking(false), 150);
        scheduleBlink();
      }, interval);
    };

    scheduleBlink();

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="faceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.2)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
          </linearGradient>
        </defs>

        <circle
          cx="50"
          cy="50"
          r="45"
          fill="url(#faceGradient)"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="2"
        />

        <Motion.ellipse
          cx="35"
          cy="42"
          rx="5"
          ry="7"
          fill="white"
          animate={{ ry: isBlinking ? 1 : 7 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
        />

        <Motion.ellipse
          cx="65"
          cy="42"
          rx="5"
          ry="7"
          fill="white"
          animate={{ ry: isBlinking ? 1 : 7 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
        />

        <path
          d="M 30 60 Q 50 75 70 60"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
