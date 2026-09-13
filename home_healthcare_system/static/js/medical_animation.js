/**
 * Home Healthcare Management System - Interactive Medical Background Animation
 * Canvas-based ECG pulse waveform, connected medical nodes, floating healthcare crosses & aura particles
 */

class MedicalBackgroundAnimation {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "medicalBgCanvas";
    this.canvas.style.position = "fixed";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "-1";
    this.canvas.style.opacity = "0.75";
    document.body.prepend(this.canvas);

    this.ctx = this.canvas.getContext("2d");
    this.particles = [];
    this.crosses = [];
    this.ecgWaves = [];
    this.mouse = { x: -1000, y: -1000, radius: 120 };

    this.resize();
    this.init();
    this.setupEvents();
    this.animate();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  init() {
    this.particles = [];
    this.crosses = [];
    this.ecgWaves = [];

    // 1. Interactive Connected Nodes
    const particleCount = Math.min(45, Math.floor((this.width * this.height) / 25000));
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2.5 + 1.5,
        color: i % 2 === 0 ? "rgba(16, 185, 129, 0.6)" : "rgba(56, 189, 248, 0.6)"
      });
    }

    // 2. Floating Medical Crosses (+)
    const crossCount = 14;
    for (let i = 0; i < crossCount; i++) {
      this.crosses.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 12 + 8,
        vy: -(Math.random() * 0.35 + 0.15),
        vx: (Math.random() - 0.5) * 0.2,
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.01,
        opacity: Math.random() * 0.35 + 0.15,
        color: i % 3 === 0 ? "#10b981" : (i % 3 === 1 ? "#38bdf8" : "#f43f5e")
      });
    }

    // 3. Ambient ECG Wave Lines
    this.ecgWaves.push(new ECGWave(this.height * 0.35, "rgba(16, 185, 129, 0.35)", 1.8));
    this.ecgWaves.push(new ECGWave(this.height * 0.75, "rgba(56, 189, 248, 0.25)", 1.2));
  }

  setupEvents() {
    window.addEventListener("resize", () => {
      this.resize();
      this.init();
    });

    window.addEventListener("mousemove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener("mouseout", () => {
      this.mouse.x = -1000;
      this.mouse.y = -1000;
    });
  }

  drawMedicalCross(ctx, x, y, size, color, opacity, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;

    const barThickness = size * 0.32;
    // Horizontal bar
    ctx.fillRect(-size / 2, -barThickness / 2, size, barThickness);
    // Vertical bar
    ctx.fillRect(-barThickness / 2, -size / 2, barThickness, size);

    ctx.restore();
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw ECG Heartbeat Waves
    this.ecgWaves.forEach(wave => wave.draw(this.ctx, this.width));

    // Draw Connected Particle Grid
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;

      // Mouse gentle repulsion
      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.mouse.radius) {
        const angle = Math.atan2(dy, dx);
        const force = (this.mouse.radius - dist) / this.mouse.radius;
        p.x -= Math.cos(angle) * force * 2;
        p.y -= Math.sin(angle) * force * 2;
      }

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = p.color;
      this.ctx.fill();

      // Connect lines to nearby particles
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const distP = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (distP < 130) {
          const lineAlpha = (1 - distP / 130) * 0.22;
          this.ctx.strokeStyle = `rgba(16, 185, 129, ${lineAlpha})`;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    }

    // Draw Floating Medical Crosses
    this.crosses.forEach(c => {
      c.y += c.vy;
      c.x += c.vx;
      c.rot += c.vRot;

      if (c.y < -30) {
        c.y = this.height + 30;
        c.x = Math.random() * this.width;
      }
      if (c.x < -30) c.x = this.width + 30;
      if (c.x > this.width + 30) c.x = -30;

      this.drawMedicalCross(this.ctx, c.x, c.y, c.size, c.color, c.opacity, c.rot);
    });

    requestAnimationFrame(() => this.animate());
  }
}

// Helper Class for Electrocardiogram (ECG) Heartbeat Wave Pulse
class ECGWave {
  constructor(yBase, color, speed) {
    this.yBase = yBase;
    this.color = color;
    this.speed = speed;
    this.offset = 0;
  }

  draw(ctx, width) {
    this.offset += this.speed;
    if (this.offset > 240) this.offset = 0;

    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.beginPath();

    const wavelength = 240;
    for (let x = 0; x < width + wavelength; x += 3) {
      const relX = (x + this.offset) % wavelength;
      let y = this.yBase;

      // Generate realistic P-Q-R-S-T Heartbeat Pattern
      if (relX > 40 && relX <= 55) {
        // P Wave (small bump)
        y -= Math.sin(((relX - 40) / 15) * Math.PI) * 7;
      } else if (relX > 70 && relX <= 78) {
        // Q Dip (small downward)
        y += 6;
      } else if (relX > 78 && relX <= 88) {
        // R Spike (Sharp High upward)
        const progress = (relX - 78) / 10;
        y -= Math.sin(progress * Math.PI) * 36;
      } else if (relX > 88 && relX <= 96) {
        // S Dip (Sharp Downward)
        const progress = (relX - 88) / 8;
        y += Math.sin(progress * Math.PI) * 14;
      } else if (relX > 115 && relX <= 145) {
        // T Wave (medium rounded bump)
        y -= Math.sin(((relX - 115) / 30) * Math.PI) * 12;
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw glowing scan head pulse
    const leadX = (this.offset * 4) % width;
    ctx.fillStyle = "#34d399";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#10b981";
    ctx.beginPath();
    ctx.arc(leadX, this.yBase, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Initialize Medical Background Animation on load
document.addEventListener("DOMContentLoaded", () => {
  new MedicalBackgroundAnimation();
});
