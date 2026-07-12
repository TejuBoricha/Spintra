"use client";

import { useEffect, useRef } from "react";

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      time += 0.003;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Large blobs
      const blobs = [
        { x: canvas.width * 0.3, y: canvas.height * 0.3, radius: 300, color: "rgba(109, 62, 224, 0.08)", speed: 1 },
        { x: canvas.width * 0.7, y: canvas.height * 0.4, radius: 250, color: "rgba(61, 218, 238, 0.06)", speed: 0.7 },
        { x: canvas.width * 0.5, y: canvas.height * 0.6, radius: 350, color: "rgba(226, 247, 42, 0.05)", speed: 0.5 },
        { x: canvas.width * 0.6, y: canvas.height * 0.2, radius: 200, color: "rgba(228, 60, 32, 0.04)", speed: 0.8 },
      ];

      blobs.forEach((blob) => {
        const x = blob.x + Math.sin(time * blob.speed) * 100;
        const y = blob.y + Math.cos(time * blob.speed * 0.7) * 80;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, blob.radius);
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(x, y, blob.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
