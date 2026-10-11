/*
 * art.js — hand-drawn style SVG posters, one per project "art" key.
 *
 * Posters are inline SVG rather than image files so they stay crisp at any
 * size, weigh almost nothing, and pick up each project's colours through CSS
 * classes (.s-a = accent stroke, .s-b = accent2 stroke, .s-c = chalk stroke,
 * .f-a / .f-b / .f-c = fills). Presentation attributes can't read CSS custom
 * properties, which is why colour lives in classes instead of attributes.
 * Small looping animations (scan lines, blinking cursors, pulses) are tagged
 * with .anim-* classes and defined in styles.css.
 */
window.POSTER_ART = {
  // Neural network feeding a rising revenue chart.
  ott: `
    <svg viewBox="0 0 400 300" class="art" aria-hidden="true">
      <g class="s-c" stroke-width="1.2" opacity=".35">
        <line x1="50" y1="80" x2="120" y2="60"/><line x1="50" y1="80" x2="120" y2="120"/>
        <line x1="50" y1="80" x2="120" y2="180"/><line x1="50" y1="150" x2="120" y2="60"/>
        <line x1="50" y1="150" x2="120" y2="120"/><line x1="50" y1="150" x2="120" y2="180"/>
        <line x1="50" y1="220" x2="120" y2="120"/><line x1="50" y1="220" x2="120" y2="180"/>
        <line x1="120" y1="60" x2="180" y2="120"/><line x1="120" y1="120" x2="180" y2="120"/>
        <line x1="120" y1="180" x2="180" y2="120"/>
      </g>
      <g class="f-a anim-pulse">
        <circle cx="50" cy="80" r="9"/><circle cx="50" cy="150" r="9"/><circle cx="50" cy="220" r="9"/>
      </g>
      <g class="f-b"><circle cx="120" cy="60" r="8"/><circle cx="120" cy="120" r="8"/><circle cx="120" cy="180" r="8"/></g>
      <circle cx="180" cy="120" r="12" class="f-a"/>
      <path d="M195 120 C 215 120, 215 120, 228 120" class="s-c" stroke-width="2" stroke-dasharray="4 4" fill="none"/>
      <g class="f-a" opacity=".85">
        <rect x="240" y="200" width="22" height="50" rx="2"/><rect x="270" y="170" width="22" height="80" rx="2"/>
        <rect x="300" y="135" width="22" height="115" rx="2"/><rect x="330" y="90" width="22" height="160" rx="2"/>
      </g>
      <path d="M236 205 L 281 165 L 311 135 L 362 72" class="s-b anim-draw" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M352 70 L 364 70 L 364 84" class="s-b" stroke-width="3" fill="none" stroke-linecap="round"/>
      <text x="320" y="50" class="f-b" font-size="34" font-family="Bebas Neue">$</text>
      <line x1="230" y1="252" x2="370" y2="252" class="s-c" stroke-width="1.5" opacity=".6"/>
    </svg>`,

  // Cinema marquee with bulbs, a film reel and a search lens.
  cine: `
    <svg viewBox="0 0 400 300" class="art" aria-hidden="true">
      <rect x="60" y="40" width="280" height="110" rx="10" class="s-a" stroke-width="3" fill="none"/>
      <g class="f-a anim-bulbs">
        ${Array.from({ length: 13 }, (_, i) => `<circle cx="${72 + i * 21.3}" cy="52" r="4"/>`).join("")}
        ${Array.from({ length: 13 }, (_, i) => `<circle cx="${72 + i * 21.3}" cy="138" r="4"/>`).join("")}
      </g>
      <text x="200" y="108" text-anchor="middle" class="f-c" font-size="34" font-family="Permanent Marker">NOW SHOWING</text>
      <g transform="translate(110 215)">
        <circle r="48" class="s-c" stroke-width="3" fill="none"/>
        <g class="anim-spin">
          <circle r="10" class="f-a"/>
          <circle cx="0" cy="-27" r="11" class="s-a" stroke-width="2.5" fill="none"/>
          <circle cx="26" cy="9" r="11" class="s-a" stroke-width="2.5" fill="none"/>
          <circle cx="-26" cy="9" r="11" class="s-a" stroke-width="2.5" fill="none"/>
        </g>
      </g>
      <path d="M158 248 C 210 270, 240 230, 300 250" class="s-c" stroke-width="10" fill="none" opacity=".25" stroke-dasharray="10 6"/>
      <g transform="translate(290 210)">
        <circle r="30" class="s-b" stroke-width="5" fill="none"/>
        <line x1="22" y1="22" x2="48" y2="48" class="s-b" stroke-width="8" stroke-linecap="round"/>
        <text x="0" y="8" text-anchor="middle" class="f-c" font-size="20" font-family="JetBrains Mono">RAG</text>
      </g>
    </svg>`,

  // Four-agent pipeline flowing into a winner's star.
  tools: `
    <svg viewBox="0 0 400 300" class="art" aria-hidden="true">
      ${["INTENT", "SEARCH", "RAG", "RANK"].map((t, i) => `
        <g transform="translate(${30 + i * 88} ${i % 2 ? 150 : 100})">
          <rect width="70" height="54" rx="12" class="${i === 3 ? "s-b" : "s-a"}" stroke-width="2.5" fill="none"/>
          <circle cx="35" cy="20" r="7" class="${i === 3 ? "f-b" : "f-a"} anim-pulse" style="animation-delay:${i * 0.4}s"/>
          <text x="35" y="44" text-anchor="middle" class="f-c" font-size="11" font-family="JetBrains Mono">${t}</text>
        </g>`).join("")}
      <path d="M100 127 L118 177 M188 177 L206 127 M276 127 L294 177" class="s-c anim-dash" stroke-width="2" stroke-dasharray="5 5" fill="none"/>
      <g transform="translate(329 250)">
        <path d="M0 -26 L7 -8 L26 -8 L11 4 L17 23 L0 12 L-17 23 L-11 4 L-26 -8 L-7 -8 Z" class="f-b anim-pulse"/>
      </g>
      <path d="M329 205 L329 222" class="s-b" stroke-width="2.5"/>
      <text x="40" y="60" class="f-c" font-size="13" font-family="JetBrains Mono" opacity=".7">"I need a tool that..."</text>
      <text x="40" y="262" class="f-a" font-size="13" font-family="JetBrains Mono" opacity=".8">500+ tools · FAISS ⨁ BM25</text>
    </svg>`,

  // Terminal window with code + an AST tree.
  coder: `
    <svg viewBox="0 0 400 300" class="art" aria-hidden="true">
      <rect x="30" y="35" width="210" height="160" rx="10" class="s-a" stroke-width="2.5" fill="none"/>
      <line x1="30" y1="60" x2="240" y2="60" class="s-a" stroke-width="2"/>
      <g class="f-a"><circle cx="46" cy="48" r="4"/><circle cx="60" cy="48" r="4" opacity=".6"/><circle cx="74" cy="48" r="4" opacity=".3"/></g>
      <g font-family="VT323" font-size="17">
        <text x="44" y="84" class="f-b">def</text><text x="74" y="84" class="f-c">review(code):</text>
        <text x="60" y="104" class="f-c" opacity=".7">ast = parse(code)</text>
        <text x="60" y="124" class="f-c" opacity=".7">ctx = retrieve(ast)</text>
        <text x="60" y="144" class="f-a">return agents.run(ctx)</text>
        <text x="44" y="172" class="f-a">&gt;</text><rect x="58" y="160" width="10" height="16" class="f-a anim-blink"/>
      </g>
      <g class="s-c" stroke-width="2" opacity=".75">
        <line x1="310" y1="80" x2="275" y2="140"/><line x1="310" y1="80" x2="345" y2="140"/>
        <line x1="275" y1="140" x2="255" y2="200"/><line x1="275" y1="140" x2="295" y2="200"/>
        <line x1="345" y1="140" x2="345" y2="200"/>
      </g>
      <g><circle cx="310" cy="80" r="11" class="f-b"/>
        <circle cx="275" cy="140" r="9" class="f-a"/><circle cx="345" cy="140" r="9" class="f-a"/>
        <circle cx="255" cy="200" r="7" class="f-c anim-pulse"/><circle cx="295" cy="200" r="7" class="f-c anim-pulse" style="animation-delay:.5s"/><circle cx="345" cy="200" r="7" class="f-c anim-pulse" style="animation-delay:1s"/></g>
      <text x="40" y="250" class="f-a" font-family="VT323" font-size="22">// local · private · LangGraph</text>
      <text x="300" y="60" class="f-c" font-family="VT323" font-size="16" opacity=".6">AST</text>
    </svg>`,

  // Envelope sorting itself into a calendar.
  email: `
    <svg viewBox="0 0 400 300" class="art" aria-hidden="true">
      <g transform="translate(40 70)" class="anim-float">
        <rect width="140" height="95" rx="8" class="s-a" stroke-width="3" fill="none"/>
        <path d="M0 6 L70 56 L140 6" class="s-a" stroke-width="3" fill="none" stroke-linejoin="round"/>
      </g>
      <g font-family="Caveat" font-size="22">
        <text x="40" y="210" class="f-a">meeting ✓</text>
        <text x="40" y="236" class="f-c" opacity=".7">task · reminder</text>
        <text x="40" y="262" class="f-c" opacity=".35" text-decoration="line-through">noise</text>
      </g>
      <path d="M195 120 C 215 100, 225 100, 240 112" class="s-c" stroke-width="2.5" fill="none" stroke-dasharray="5 5"/>
      <path d="M232 104 L242 113 L230 118" class="s-c" stroke-width="2.5" fill="none"/>
      <g transform="translate(250 60)">
        <rect width="120" height="130" rx="8" class="s-b" stroke-width="3" fill="none"/>
        <rect width="120" height="28" rx="8" class="f-b" opacity=".9"/>
        <line x1="30" y1="-8" x2="30" y2="8" class="s-c" stroke-width="4" stroke-linecap="round"/>
        <line x1="90" y1="-8" x2="90" y2="8" class="s-c" stroke-width="4" stroke-linecap="round"/>
        ${Array.from({ length: 12 }, (_, i) => `<rect x="${12 + (i % 4) * 26}" y="${40 + Math.floor(i / 4) * 28}" width="18" height="18" rx="3" class="${i === 6 ? "f-a anim-pulse" : "s-c"}" ${i === 6 ? "" : 'stroke-width="1.5" fill="none" opacity=".5"'}/>`).join("")}
      </g>
    </svg>`,

  // Video frame being scanned, with a compliance shield.
  brand: `
    <svg viewBox="0 0 400 300" class="art" aria-hidden="true">
      <rect x="30" y="50" width="230" height="150" rx="6" class="s-c" stroke-width="2.5" fill="none"/>
      <g class="f-c" opacity=".35">
        ${Array.from({ length: 8 }, (_, i) => `<rect x="${40 + i * 28}" y="36" width="14" height="8" rx="1"/><rect x="${40 + i * 28}" y="206" width="14" height="8" rx="1"/>`).join("")}
      </g>
      <path d="M128 95 L128 155 L178 125 Z" class="f-a" opacity=".9"/>
      <rect x="32" y="52" width="226" height="4" class="f-b anim-scan" opacity=".8"/>
      <circle cx="52" cy="72" r="6" class="f-a anim-blink"/>
      <text x="64" y="78" class="f-a" font-size="16" font-family="Bebas Neue">REC · AUDIT</text>
      <g transform="translate(320 125)">
        <path d="M0 -62 L50 -42 L50 5 C 50 40, 25 58, 0 68 C -25 58, -50 40, -50 5 L-50 -42 Z" class="s-b" stroke-width="3.5" fill="none"/>
        <path d="M-20 2 L-4 18 L24 -16" class="s-a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <text x="30" y="250" class="f-c" font-size="18" font-family="JetBrains Mono" opacity=".75">transcript · OCR · rules</text>
    </svg>`,

  // Scales of justice + a stopwatch for "milliseconds, on CPU".
  judge: `
    <svg viewBox="0 0 400 300" class="art" aria-hidden="true">
      <line x1="170" y1="50" x2="170" y2="240" class="s-a" stroke-width="4"/>
      <path d="M130 245 L210 245" class="s-a" stroke-width="6" stroke-linecap="round"/>
      <circle cx="170" cy="46" r="7" class="f-a"/>
      <g class="anim-sway" style="transform-origin:170px 70px">
        <line x1="80" y1="70" x2="260" y2="70" class="s-a" stroke-width="4" stroke-linecap="round"/>
        <path d="M80 70 L55 140 M80 70 L105 140" class="s-c" stroke-width="1.5" opacity=".7"/>
        <path d="M50 140 Q80 170 110 140 Z" class="f-a" opacity=".9"/>
        <path d="M260 70 L235 140 M260 70 L285 140" class="s-c" stroke-width="1.5" opacity=".7"/>
        <path d="M230 140 Q260 170 290 140 Z" class="f-b" opacity=".9"/>
        <text x="80" y="128" text-anchor="middle" class="f-c" font-size="12" font-family="JetBrains Mono">grounded</text>
        <text x="260" y="128" text-anchor="middle" class="f-c" font-size="12" font-family="JetBrains Mono">halluc.</text>
      </g>
      <g transform="translate(320 210)">
        <circle r="36" class="s-c" stroke-width="3" fill="none"/>
        <line x1="0" y1="-36" x2="0" y2="-46" class="s-c" stroke-width="4"/>
        <line x1="0" y1="0" x2="0" y2="-24" class="s-b anim-spin" stroke-width="3" stroke-linecap="round"/>
        <text x="0" y="22" text-anchor="middle" class="f-b" font-size="12" font-family="JetBrains Mono">~ms</text>
      </g>
    </svg>`,

  // A cited document, quote marks and the ReAct reason→act loop.
  react: `
    <svg viewBox="0 0 400 300" class="art" aria-hidden="true">
      <g transform="translate(40 40)">
        <path d="M0 0 H130 L160 30 V210 H0 Z" class="s-c" stroke-width="2.5" fill="none"/>
        <path d="M130 0 V30 H160" class="s-c" stroke-width="2" fill="none"/>
        ${[50, 70, 90, 150, 170, 190].map((y) => `<line x1="16" y1="${y}" x2="${y % 40 ? 140 : 110}" y2="${y}" class="s-c" stroke-width="2" opacity=".35"/>`).join("")}
        <rect x="10" y="108" width="140" height="26" rx="3" class="f-a anim-pulse" opacity=".3"/>
        <text x="16" y="127" class="f-a" font-size="15" font-family="JetBrains Mono">"verbatim quote"</text>
      </g>
      <text x="230" y="80" class="f-b" font-size="80" font-family="Playfair Display">“</text>
      <text x="222" y="150" class="f-a" font-size="20" font-family="JetBrains Mono">[file:p3]</text>
      <g transform="translate(300 220)" class="s-b" stroke-width="3" fill="none">
        <g class="anim-spin-slow">
          <path d="M-34 0 A34 34 0 0 1 30 -16"/><path d="M30 -16 L32 -2 M30 -16 L17 -10"/>
          <path d="M34 0 A34 34 0 0 1 -30 16"/><path d="M-30 16 L-32 2 M-30 16 L-17 10"/>
        </g>
      </g>
      <text x="300" y="225" text-anchor="middle" class="f-c" font-size="12" font-family="JetBrains Mono">ReAct</text>
    </svg>`,
};
