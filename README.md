# 15° Congreso de Turismo Médico — Cumbre Internacional 2026
### Website Redesign: Premium Cinematic Editorial B2B Experience

A luxury, editorial, international B2B event website for the **15ª Edición del Congreso de Turismo Médico** (2–3 Diciembre 2026 · México).

---

## Key Features

1. **Scroll-Driven Frame-by-Frame Video Timeline**:
   - Pinned 700vh cinematic section (`#cinemaStage`).
   - The provided event video (`gemini_generated_video_d04425a4.mp4`) acts as a precise timeline.
   - Quantized to **24 FPS** with throttled seek locking to prevent frame drops or stutter.
   - Smoothed damping (lerp) via `requestAnimationFrame` for a fluid scrub feel.
   - Full backward and forward scrub control without autoplay or video controls.
   - High-DPI `<canvas>` rendering (up to 2x DPR) with non-distorting `cover` math.

2. **Synchronized 5-Scene Narrative**:
   - **Scene 01 (0%–17%) — HERO**: *El punto de encuentro del turismo médico.*
   - **Scene 02 (18%–38%) — BUSINESS**: *Donde una conversación se convierte en negocio.*
   - **Scene 03 (39%–58%) — KNOWLEDGE**: *Ideas que mueven una industria.* (Compact agenda cards)
   - **Scene 04 (59%–78%) — EXPO**: *Haz que tu marca forme parte del encuentro.*
   - **Scene 05 (79%–100%) — FINAL CTA**: *El próximo capítulo empieza aquí.*

3. **Seamless Transition into Editorial Content**:
   - **Section 01 — El Evento**: Warm ivory background, 2-column editorial layout, key participants ecosystem, oversized statistics (`15ª`, `B2B`, `2 DÍAS`).
   - **Section 02 — Matchmaking B2B**: Dark navy background, interactive 4-step process cards (`01 Regístrate`, `02 Conecta`, `03 Agenda`, `04 Haz Negocio`).
   - **Section 03 — Agenda Académica**: Interactive Day 1 & Day 2 filter tabs, large horizontal agenda rows with hover title scaling, gold arrow reveal, border highlight, and horizontal translation.
   - **Section 04 — Pabellón Expo**: Immersive destination section with coastal Mexican architecture photography overlaid with navy gradient, expo zone pillars, and CTA.
   - **Section 05 — Patrocinios**: Editorial luxury cards for `DIAMANTE`, `ORO`, and `PLATA` tiers with hover elevation, gold accents, and proposal triggers.
   - **Final CTA**: Fullscreen dark navy section, *Nos vemos en México.*, registration action.
   - **Footer**: Minimalist 3-column layout with back-to-top anchor.

4. **Interactive Registration Modal Dialog**:
   - Accessible dialog with ARIA semantics, focus trap, and Escape key handling.
   - Automatic pre-selection of sponsorship tiers or expo roles when clicked from corresponding cards.
   - Instant client validation and submission confirmation view.

5. **Accessibility & Responsive Design**:
   - Full support for `@media (prefers-reduced-motion: reduce)`.
   - Responsive breakpoints for Desktop (1440px+), Tablet (1024px), and Mobile (390px / 375px).
   - Minimal mobile hamburger menu with full-screen slide-out navigation drawer.

---

## How to Run

Because modern browsers restrict local video playback and canvas manipulation on `file://` URLs, run via any local HTTP server:

### Python
```bash
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000)

### Node.js
```bash
npx serve .
```

---

## Project Structure

```text
├── index.html                           # Semantic HTML5 structure
├── styles.css                           # Visual design system, typography, animations
├── script.js                            # Video scrubbing engine, HUD, and interactivity
├── gemini_generated_video_d04425a4.mp4  # 10s 24fps HD event video asset
├── assets/
│   └── expo_destination.jpg            # Mexican coastal pavilion destination image
├── screenshots/                         # Verification screenshots across all viewports
└── README.md
```
