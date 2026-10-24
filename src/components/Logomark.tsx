import { useState } from "react";

interface Props {
  size?: number;
  color?: string;
  className?: string;
}

export default function Logomark({ size = 28, color = "#018ABE", className = "" }: Props) {
  const [imgSrcIdx, setImgSrcIdx] = useState(0);
  const candidates = ["/logo.png", "/logo.svg", "/icon.png"];

  if (imgSrcIdx < candidates.length) {
    return (
      <img
        src={candidates[imgSrcIdx]}
        alt="Modular Medico Logo"
        width={size}
        height={size}
        className={`rounded-lg object-contain ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImgSrcIdx((prev) => prev + 1)}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <path d="M24 4L41 10V22C41 33 34 41 24 44C14 41 7 33 7 22V10L24 4Z" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 15V33" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M19 19C19 19 24 20 24 24C24 28 19 29 19 29M29 19C29 19 24 20 24 24C24 28 29 29 29 29" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M18 12H30V15C30 17.5 27.5 19 24 19C20.5 19 18 17.5 18 15V12Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

