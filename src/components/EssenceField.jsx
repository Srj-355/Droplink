import { useEffect, useRef } from "react";

export default function EssenceField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame;
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const isMobile = w < 768;
    const count = isMobile ? 80 : 200;
    const particles = [];
    const mouse = { x: -1000, y: -1000 };
    class Particle {
      constructor() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.size = Math.random() * (isMobile ? 2 : 3) + 1;
        this.color = ["#0ea5e9", "#8b5cf6", "#06b6d4", "#10b981"][Math.floor(Math.random() * 4)];
        this.alpha = Math.random() * 0.3 + 0.15;
        this.pulse = Math.random() * Math.PI * 2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulse += 0.05;
        if (this.x < -50) this.x = w + 50;
        if (this.x > w + 50) this.x = -50;
        if (this.y < -50) this.y = h + 50;
        if (this.y > h + 50) this.y = -50;
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.hypot(dx, dy);
        const radius = isMobile ? 100 : 150;
        if (dist < radius) {
          const force = (radius - dist) / radius;
          const ang = Math.atan2(dy, dx);
          this.x += Math.cos(ang) * force * 5;
          this.y += Math.sin(ang) * force * 5;
        }
      }
      draw() {
        const s = this.size * (0.8 + Math.sin(this.pulse) * 0.2);
        ctx.beginPath();
        ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
        ctx.shadowBlur = 4;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    for (let i = 0; i < count; i++) particles.push(new Particle());
    const render = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => { p.update(); p.draw(); });
      frame = requestAnimationFrame(render);
    };
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    const mousemove = e => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const touchmove = e => { if (e.touches[0]) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; } };
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", mousemove);
    window.addEventListener("touchmove", touchmove);
    render();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("touchmove", touchmove);
    };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", background: "transparent" }} />;
}
