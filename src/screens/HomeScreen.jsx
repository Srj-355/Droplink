import { useEffect, useRef } from "react";

export default function HomeScreen({ onHost, onJoin, onLogoClick, peerError, libsReady }) {
  return (
    <div style={s.page}>
      <EssenceField />
      <div style={s.hero}>
        {/* Logo mark */}
        <div style={s.logoWrap} onClick={onLogoClick}>
          <div style={s.logoRing} />
          <div style={s.logoIcon}>⚡</div>
        </div>

        <h1 style={s.title}>DROPLINK</h1>
        <p style={s.sub}>Peer-to-peer · Zero servers · End-to-end encrypted</p>

        {/* Action cards */}
        <div style={s.grid}>
          <ActionCard
            icon={<SendIcon />} label="Send files"
            desc="Start a transfer and share your code"
            accent="#0ea5e9" onClick={onHost}
            direction="up"
          />
          <ActionCard
            icon={<ReceiveIcon />} label="Receive files"
            desc="Enter a code to connect and download"
            accent="#8b5cf6" onClick={onJoin}
            direction="down"
          />
        </div>

        {/* Feature pills */}
        <div style={s.pills}>
          {FEATURES.map((f) => (
            <span key={f} style={s.pill}>{f}</span>
          ))}
        </div>

        {!libsReady && (
          <div style={s.loading}>
            <span className="dot-pulse" style={{ marginRight: 8 }} />
            Loading libraries…
          </div>
        )}
        {peerError && <div className="err" style={{ maxWidth: 400 }}>{peerError}</div>}
      </div>
    </div>
  );
}

function ActionCard({ icon, label, desc, accent, onClick, direction }) {
  const clickedRef = useRef(false);

  const handleClick = (e) => {
    if (clickedRef.current) return;
    clickedRef.current = true;
    onClick(e);
    // Cool-down of 2 seconds to prevent rapid double-triggering
    setTimeout(() => {
      clickedRef.current = false;
    }, 3000);
  };

  return (
    <div
      className="action-card"
      style={{
        "--accent": accent,
        "--accent-glow": `${accent}25`,
        "--accent-border": `${accent}60`,
        "--accent-bg-icon": `${accent}18`,
      }}
      onClick={handleClick}
    >
      <div className={`card-blob ${direction}`}>
        <div className="card-blob-inner" />
      </div>
      <div className="card-content">
        <div className="card-icon-wrap">{icon}</div>
        <div className="card-label">{label}</div>
        <div className="card-desc">{desc}</div>
        <div className="card-arrow">→</div>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'float 3s ease-in-out infinite' }}>
      <path d="M12 4V20M12 4L7 9M12 4L17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="essence-particle" cx="12" cy="18" r="1.8" style={{ animation: 'essence-up 2.2s infinite 0s' }} />
      <circle className="essence-particle" cx="8" cy="16" r="1.2" style={{ animation: 'essence-up 2.2s infinite 0.5s' }} />
      <circle className="essence-particle" cx="16" cy="16" r="1.2" style={{ animation: 'essence-up 2.2s infinite 1.0s' }} />
      <circle className="essence-particle" cx="12" cy="14" r="1.5" style={{ animation: 'essence-up 2.2s infinite 1.5s' }} />
    </svg>
  );
}

function ReceiveIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'float 3s ease-in-out infinite' }}>
      <path d="M12 20V4M12 20L7 15M12 20L17 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="essence-particle" cx="12" cy="6" r="1.8" style={{ animation: 'essence-down 2.2s infinite 0s' }} />
      <circle className="essence-particle" cx="8" cy="8" r="1.2" style={{ animation: 'essence-down 2.2s infinite 0.5s' }} />
      <circle className="essence-particle" cx="16" cy="8" r="1.2" style={{ animation: 'essence-down 2.2s infinite 1.0s' }} />
      <circle className="essence-particle" cx="12" cy="10" r="1.5" style={{ animation: 'essence-down 2.2s infinite 1.5s' }} />
    </svg>
  );
}

function EssenceField(){
  const canvasRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const ctx=canvas.getContext("2d");
    let frame;
    let w=canvas.width=window.innerWidth;
    let h=canvas.height=window.innerHeight;
    const isMobile=w<768;
    const count=isMobile?80:200;
    const particles=[];
    const mouse={x:-1000,y:-1000};
    class Particle{
      constructor(){
        this.x=Math.random()*w;
        this.y=Math.random()*h;
        this.vx=(Math.random()-0.5)*1.5;
        this.vy=(Math.random()-0.5)*1.5;
        this.size=Math.random()*(isMobile?2:3)+1;
        this.color=["#0ea5e9","#8b5cf6","#06b6d4","#10b981"][Math.floor(Math.random()*4)];
        this.alpha=Math.random()*0.3+0.15;
        this.pulse=Math.random()*Math.PI*2;
      }
      update(){
        this.x+=this.vx;
        this.y+=this.vy;
        this.pulse+=0.05;
        if(this.x<-50)this.x=w+50;
        if(this.x>w+50)this.x=-50;
        if(this.y<-50)this.y=h+50;
        if(this.y>h+50)this.y=-50;
        const dx=mouse.x-this.x;
        const dy=mouse.y-this.y;
        const dist=Math.hypot(dx,dy);
        const radius=isMobile?150:250;
        if(dist<radius){
          const force=(radius-dist)/radius;
          const ang=Math.atan2(dy,dx);
          this.x-=Math.cos(ang)*force*8;
          this.y-=Math.sin(ang)*force*8;
        }
      }
      draw(){
        const s=this.size*(0.8+Math.sin(this.pulse)*0.2);
        ctx.beginPath();
        ctx.arc(this.x,this.y,s,0,Math.PI*2);
        ctx.shadowBlur=4;
        ctx.shadowColor=this.color;
        ctx.fillStyle=this.color;
        ctx.globalAlpha=this.alpha;
        ctx.fill();
        ctx.shadowBlur=0;
      }
    }
    for(let i=0;i<count;i++)particles.push(new Particle());
    const render=()=>{
      ctx.clearRect(0,0,w,h);
      particles.forEach(p=>{p.update();p.draw();});
      frame=requestAnimationFrame(render);
    };
    const resize=()=>{w=canvas.width=window.innerWidth;h=canvas.height=window.innerHeight;};
    const mousemove=e=>{mouse.x=e.clientX;mouse.y=e.clientY;};
    const touchmove=e=>{if(e.touches[0]){mouse.x=e.touches[0].clientX;mouse.y=e.touches[0].clientY;}};
    window.addEventListener("resize",resize);
    window.addEventListener("mousemove",mousemove);
    window.addEventListener("touchmove",touchmove);
    render();
    return()=>{
      cancelAnimationFrame(frame);
      window.removeEventListener("resize",resize);
      window.removeEventListener("mousemove",mousemove);
      window.removeEventListener("touchmove",touchmove);
    };
  },[]);
  return<canvas ref={canvasRef}style={{position:"fixed",inset:0,zIndex:-1,pointerEvents:"none",background:"transparent"}}/>;
}
const FEATURES = [
  "📁 Any File Type", "💬 Live Chat",
  "📱 QR Pairing", "🚫 No Limits",
  "📊 Adaptive Chunks", "📜 History",
  "⏸ Pause & Cancel", "📦 File Queue",
];

const s = {
  page: {
    minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center", padding: "2rem",
  },
  hero: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "2rem", maxWidth: 520, width: "100%",
    animation: "card-enter 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
  },
  logoWrap: { position: "relative", width: 84, height: 84, cursor: "pointer" },
  logoRing: {
    position: "absolute", inset: 0, borderRadius: "50%",
    background: "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(139,92,246,0.25))",
    border: "1px solid rgba(255,255,255,0.7)",
    backdropFilter: "blur(10px)",
    animation: "orb-drift 4s ease-in-out infinite alternate",
  },
  logoIcon: {
    position: "absolute", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "2.4rem",
  },
  title: {
    fontSize: "clamp(2.4rem,8vw,4.2rem)", fontWeight: 800,
    letterSpacing: "-0.04em", lineHeight: 1,
    background: "linear-gradient(135deg, #0f172a 0%, #0ea5e9 50%, #8b5cf6 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
  },
  sub: { fontSize: "0.8rem", color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem", width: "100%" },
  pills: { display: "flex", flexWrap: "wrap", gap: "0.35rem", justifyContent: "center" },
  pill: {
    background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.75)",
    borderRadius: 20, padding: "0.22rem 0.7rem",
    fontSize: "0.64rem", color: "#475569", backdropFilter: "blur(8px)",
  },
  loading: { fontSize: "0.72rem", color: "#64748b", display: "flex", alignItems: "center" },
};