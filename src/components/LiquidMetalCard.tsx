import React, { useEffect, useRef } from "react";
import { liquidMetalFragmentShader, ShaderMount } from "@paper-design/shaders";
import { LiquidMetalProps } from "@paper-design/shaders-react";

type ShaderProps = Omit<LiquidMetalProps, 'className' | 'style' | 'shape'>;

interface LiquidMetalCardProps extends React.HTMLAttributes<HTMLDivElement>, Partial<ShaderProps> {
  radius?: number;
  glassEffect?: boolean;
}

export function LiquidMetalCard({
  children,
  className = "",
  speed = 1,
  repetition = 1,
  softness = 2,
  shiftRed = 0.3,
  shiftBlue = 0.3,
  distortion = 0,
  contour = 2,
  angle = 45,
  scale = 8,
  offsetX = 0.1,
  offsetY = -0.1,
  radius = 24,
  glassEffect = false,
  style,
  ...props
}: LiquidMetalCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shaderRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const uniforms = {
      u_repetition: repetition,
      u_softness: softness,
      u_shiftRed: shiftRed,
      u_shiftBlue: shiftBlue,
      u_distortion: distortion,
      u_contour: contour,
      u_angle: angle,
      u_scale: scale,
      u_offsetX: offsetX,
      u_offsetY: offsetY,
    };

    if (!shaderRef.current) {
      // 3rd arg: uniforms, 4th arg: webGlContextAttributes, 5th arg: speed
      shaderRef.current = new ShaderMount(containerRef.current, liquidMetalFragmentShader, uniforms, undefined, speed);
    } else {
      shaderRef.current.setUniforms(uniforms);
      shaderRef.current.setSpeed(speed);
    }

    return () => {
      // Clean up on unmount if needed, though ShaderMount might not have a destroy method
      // shaderRef.current?.destroy?.();
    };
  }, [speed, repetition, softness, shiftRed, shiftBlue, distortion, contour, angle, scale, offsetX, offsetY]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        position: 'relative',
        borderRadius: radius,
        overflow: 'hidden',
        ...style
      }}
      {...props}
    >
      {/* Background Liquid Metal Shader */}
      <div 
        ref={containerRef}
        style={{ 
          position: 'absolute', 
          inset: 0, 
          borderRadius: radius, 
          pointerEvents: 'none',
          // Froiden UI liquid metal shader needs some specific blending
        }} 
      />
      {/* Inner Container Overlay (iOS Volumetric Glass) */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 2, 
          left: 2, 
          right: 2, 
          bottom: 2, 
          borderRadius: radius - 2, 
          backgroundColor: glassEffect ? 'rgba(5, 5, 5, 0.8)' : '#0a0a0a', 
          backdropFilter: glassEffect ? 'blur(40px) saturate(150%)' : 'none',
          WebkitBackdropFilter: glassEffect ? 'blur(40px) saturate(150%)' : 'none',
          boxShadow: glassEffect 
            ? 'inset 0 -4px 8px rgba(0,0,0,0.6)' 
            : 'inset 0 2px 4px rgba(0,0,0,0.5)', 
          pointerEvents: 'none',
          transition: 'all 0.3s ease'
        }} 
      />
      {/* Foreground Content */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
}
