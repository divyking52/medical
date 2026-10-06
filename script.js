/**
 * Congreso de Turismo Médico — 15ª Edición · México 2026
 * Core Script: Cinematic Video Scroll scrubbing, Lenis Smooth Scroll, HUD, Navigation, and Interactive Features
 */

(() => {
  'use strict';

  // --- DOM Elements ---
  const cinemaStage = document.getElementById('cinemaStage');
  const canvas = document.getElementById('scrollCanvas');
  const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
  const video = document.getElementById('sourceVideo');
  const mainNav = document.getElementById('mainNav');
  const progressBar = document.getElementById('progressBar');
  const sceneCounter = document.getElementById('sceneCounter');
  const timeCode = document.getElementById('timeCode');
  const cinematicShade = document.querySelector('.cinematic-shade');
  const sceneBlocks = [...document.querySelectorAll('.scene-block')];

  // Mobile Drawer Elements
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const drawerLinks = [...document.querySelectorAll('.drawer-link')];

  // Modal Dialog Elements
  const registerModal = document.getElementById('registerModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const registrationForm = document.getElementById('registrationForm');
  const modalSuccessState = document.getElementById('modalSuccessState');
  const successCloseBtn = document.getElementById('successCloseBtn');
  const regRoleSelect = document.getElementById('regRole');
  const registerTriggers = [...document.querySelectorAll('.btn-register-trigger')];
  const sponsorTriggers = [...document.querySelectorAll('.btn-sponsor-trigger')];

  // Interactive Agenda Elements
  const dayTabs = [...document.querySelectorAll('.day-tab')];
  const agendaRows = [...document.querySelectorAll('.agenda-row')];

  // Interactive Process Elements
  const processCards = [...document.querySelectorAll('.process-card')];

  // --- Video & Animation Engine State (Ultra-smooth 60 FPS Engine) ---
  const FPS = 60;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let duration = 10.0;
  let videoReady = false;
  let isSeeking = false;
  let pendingSeekTime = null;
  let lastAssignedTime = -1;

  let scrollProgress = 0;
  let smoothProgress = 0;
  let rafId = 0;
  let isGsapActive = false;
  let heroTimeline = null;

  // --- GSAP & ScrollTrigger Initialization ---
  const hasGSAP = typeof window.gsap !== 'undefined';
  const hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';

  if (hasGSAP && hasScrollTrigger) {
    try {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.ScrollTrigger.config({ ignoreMobileResize: true });
    } catch (e) {
      console.warn('ScrollTrigger registration:', e);
    }
  }

  // --- Mobile / Touch Device Hardware Detection ---
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 991);

  // --- Lenis Smooth Scroll Engine Initialization (Desktop Only) ---
  // On mobile touchscreens, native 120Hz/60Hz OS momentum scrolling is kept 100% untouched for zero lag!
  let lenis = null;
  if (!isTouchDevice && typeof window.Lenis !== 'undefined' && !prefersReducedMotion) {
    try {
      lenis = new window.Lenis({
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.85,
        infinite: false,
      });

      window.lenis = lenis;

      if (hasGSAP && hasScrollTrigger) {
        lenis.on('scroll', window.ScrollTrigger.update);
        window.gsap.ticker.add((time) => {
          lenis.raf(time * 1000);
        });
        window.gsap.ticker.lagSmoothing(0);
      } else {
        lenis.on('scroll', () => {
          onScroll();
        });
      }
    } catch (err) {
      console.warn('Lenis could not be initialized:', err);
      lenis = null;
      window.lenis = null;
    }
  } else {
    // Mobile: native 120Hz hardware scroll listener
    window.addEventListener('scroll', () => {
      if (window.ScrollTrigger) window.ScrollTrigger.update();
    }, { passive: true });
  }

  // --- Helper: Clamp values ---
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  // --- Format Timecode (mm:ss.f) ---
  function formatTime(seconds) {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const tenths = Math.floor((s % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  }

  // --- Pin Contact Us Button Precisely Over Gemini Star Watermark (Desktop Only) ---
  function positionStarOverlay() {
    if (isTouchDevice) return; // Star watermark is cropped off-screen on mobile portrait viewports
    const btn = document.getElementById('contactStarBtn') || document.getElementById('translateBtn');
    if (!btn || !canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw === 0 || ch === 0) return;

    const vw = 1280;
    const vh = 720;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    // The Gemini star watermark in the 1280x720 video is centered at (1164, 590)
    const starX = dx + 1164 * scale;
    const starY = dy + 590 * scale;

    btn.style.left = `${starX}px`;
    btn.style.top = `${starY}px`;
  }

  // --- Resize Canvas with High-DPI Support (Desktop Only) ---
  let lastCanvasW = 0;
  let lastCanvasH = 0;

  function resizeCanvas() {
    if (isTouchDevice || !canvas) return; // Native video element is used directly on mobile
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    const widthChanged = Math.abs(w - lastCanvasW) > 4;
    const heightChanged = Math.abs(h - lastCanvasH) > 40;

    if (widthChanged || heightChanged || lastCanvasW === 0) {
      lastCanvasW = w;
      lastCanvasH = h;
      canvas.width = w;
      canvas.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCanvasFrame();
    }
    positionStarOverlay();
  }

  // --- Cover Draw: Maintain Aspect Ratio (Desktop Only) ---
  let hasDrawnFirstFrame = false;

  function drawCanvasFrame() {
    if (isTouchDevice || !canvas || !video) return; // Zero canvas CPU/GPU draw on mobile!
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw === 0 || ch === 0) return;

    if (video.readyState >= 2) {
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const scale = Math.max(cw / vw, ch / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

      ctx.drawImage(video, dx, dy, dw, dh);
      hasDrawnFirstFrame = true;
    } else if (!hasDrawnFirstFrame) {
      // ONLY draw dark fallback fill ONCE before the very first video frame is ready!
      // Once a frame has been rendered, NEVER clear the canvas during seeking!
      ctx.fillStyle = '#061a2b';
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  // --- Adaptive Video Frame Seeking (Desktop Profile) ---
  const minSeekInterval = 16;
  let lastSeekTimestamp = 0;

  function seekVideoTo(time) {
    // On mobile touch devices, NEVER seek video on scroll - seeking stalls the mobile GPU decoder!
    if (isTouchDevice || !videoReady || prefersReducedMotion) return;

    // Quantize target timestamp
    const frame = Math.round(time * FPS);
    const frameTime = clamp(frame / FPS, 0, Math.max(0, duration - 0.02));

    // Avoid redundant seeking if already at the target frame
    if (Math.abs(frameTime - lastAssignedTime) < 0.02) {
      return;
    }

    const now = performance.now();
    // If decoder is currently processing a seek or called faster than decoder throttle, queue next frame
    if (isSeeking || (now - lastSeekTimestamp < minSeekInterval)) {
      pendingSeekTime = frameTime;
      return;
    }

    isSeeking = true;
    lastAssignedTime = frameTime;
    lastSeekTimestamp = now;

    try {
      video.currentTime = frameTime;
    } catch (err) {
      isSeeking = false;
    }
  }

  // Seek event listener (Desktop Only)
  if (video && !isTouchDevice) {
    video.addEventListener('seeked', () => {
      isSeeking = false;
      drawCanvasFrame();

      if (pendingSeekTime !== null) {
        const nextTime = pendingSeekTime;
        pendingSeekTime = null;
        const now = performance.now();
        const elapsed = now - lastSeekTimestamp;
        if (elapsed >= minSeekInterval) {
          seekVideoTo(nextTime);
        } else {
          setTimeout(() => {
            seekVideoTo(nextTime);
          }, minSeekInterval - elapsed);
        }
      }
    });

    video.addEventListener('timeupdate', drawCanvasFrame);

    // Hook requestVideoFrameCallback if available for native refresh presentation
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      const onVideoFrame = () => {
        drawCanvasFrame();
        video.requestVideoFrameCallback(onVideoFrame);
      };
      video.requestVideoFrameCallback(onVideoFrame);
    }
  }

  // --- Calculate Current Scroll Progress inside Cinematic Section ---
  function getProgress() {
    if (!cinemaStage) return 0;
    const rect = cinemaStage.getBoundingClientRect();
    const maxScroll = cinemaStage.offsetHeight - window.innerHeight;
    if (maxScroll <= 0) return 0;
    return clamp(-rect.top / maxScroll, 0, 1);
  }

  // --- Update Chapter Rail & Counter ---
  function updateChapterRail(progress) {
    let activeSceneIndex = 1;
    if (progress >= 0.78) activeSceneIndex = 5;
    else if (progress >= 0.58) activeSceneIndex = 4;
    else if (progress >= 0.38) activeSceneIndex = 3;
    else if (progress >= 0.18) activeSceneIndex = 2;
    else activeSceneIndex = 1;

    if (sceneCounter) {
      sceneCounter.textContent = `0${activeSceneIndex} / 05`;
    }
    const railItems = document.querySelectorAll('.index-rail li');
    if (railItems && railItems.length) {
      railItems.forEach((li, idx) => {
        const isActive = idx === activeSceneIndex - 1;
        li.classList.toggle('on', isActive);
        const link = li.querySelector('a');
        if (link) {
          if (isActive) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        }
      });
    }
  }

  // --- Initialize GSAP Hero Cinematic Scroller ---
  function initHeroScroller() {
    if (!cinemaStage || sceneBlocks.length === 0) return false;
    if (!hasGSAP || !hasScrollTrigger || prefersReducedMotion) return false;

    try {
      // 1. Prime initial block positions
      sceneBlocks.forEach((block, idx) => {
        if (idx === 0) {
          window.gsap.set(block, { opacity: 1, y: 0 });
          block.style.pointerEvents = 'auto';
          block.classList.add('active');
        } else {
          window.gsap.set(block, { opacity: 0, y: 26 });
          block.style.pointerEvents = 'none';
          block.classList.remove('active');
        }
      });

      // 2. Build Master Scrub Timeline with slow, buttery inertia damping
      let lastActiveSceneIdx = -1;
      const tl = window.gsap.timeline({
        scrollTrigger: {
          trigger: cinemaStage,
          start: 'top top',
          end: 'bottom bottom',
          scrub: isTouchDevice ? 0.2 : 1.2, // Snappy 0.2s on mobile (zero lag!), 1.2s luxurious inertia on desktop
          fastScrollEnd: isTouchDevice,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            updateHUD(p);
            updateChapterRail(p);
            // On desktop: seek video frame-by-frame. On mobile: NEVER seek video on scroll - native video plays smoothly in background!
            if (!isTouchDevice && !prefersReducedMotion) {
              seekVideoTo(p * duration);
            }
            if (cinematicShade) {
              if (p > 0.85) {
                const exitFade = clamp(1 - (p - 0.85) * 4, 0.25, 1);
                cinematicShade.style.opacity = exitFade.toFixed(2);
              } else {
                cinematicShade.style.opacity = '1';
              }
            }
            // High-efficiency scene activation: only touch DOM when active scene changes
            let currentSceneIdx = 0;
            if (p >= 0.78) currentSceneIdx = 4;
            else if (p >= 0.58) currentSceneIdx = 3;
            else if (p >= 0.38) currentSceneIdx = 2;
            else if (p >= 0.18) currentSceneIdx = 1;

            if (currentSceneIdx !== lastActiveSceneIdx) {
              lastActiveSceneIdx = currentSceneIdx;
              sceneBlocks.forEach((b, idx) => {
                const isAct = idx === currentSceneIdx;
                b.classList.toggle('active', isAct);
                b.style.pointerEvents = isAct ? 'auto' : 'none';
              });
            }
          }
        }
      });

      // 3. Slow, cinematic cross-dissolve choreography with spacious reading plateaus
      // Total Timeline Duration: 10 units (spread across 600vh scroll stage)
      // Each transition spans 1.0 unit (~50vh) with gentle sine easing
      const transitions = [
        { outIdx: 0, inIdx: 1, at: 1.30 }, // Transition 1 -> 2 (Midpoint: 1.80 = 18%)
        { outIdx: 1, inIdx: 2, at: 3.30 }, // Transition 2 -> 3 (Midpoint: 3.80 = 38%)
        { outIdx: 2, inIdx: 3, at: 5.30 }, // Transition 3 -> 4 (Midpoint: 5.80 = 58%)
        { outIdx: 3, inIdx: 4, at: 7.30 }  // Transition 4 -> 5 (Midpoint: 7.80 = 78%)
      ];

      transitions.forEach(({ outIdx, inIdx, at }) => {
        const outBlock = sceneBlocks[outIdx];
        const inBlock = sceneBlocks[inIdx];

        // Outgoing block: soft, slow fade out with gentle upward float
        tl.to(outBlock, {
          opacity: 0,
          y: -22,
          duration: 1.0,
          ease: 'sine.inOut'
        }, at);

        // Incoming block: soft, slow fade in from below, overlapping for seamless cross-dissolve
        tl.fromTo(inBlock, {
          opacity: 0,
          y: 26
        }, {
          opacity: 1,
          y: 0,
          duration: 1.0,
          ease: 'sine.inOut'
        }, at + 0.10);
      });

      // Pad timeline tail so Scene 05 remains solid and readable through final scroll
      tl.to({}, { duration: 1.6 }, 8.4);

      // 4. Hook GSAP ticker for 60fps canvas drawing (Desktop Only)
      if (!isTouchDevice) {
        window.gsap.ticker.add(() => {
          drawCanvasFrame();
        });
      }

      heroTimeline = tl;
      return true;
    } catch (err) {
      console.warn('GSAP Hero Scroller initialization failed, using fallback:', err);
      return false;
    }
  }

  // --- Fallback Update Scenes with Seamless Cosine Cross-Fade ---
  function updateScenes(progress) {
    const centers = [0.08, 0.28, 0.48, 0.68, 0.88];
    const halfWidth = 0.13;

    sceneBlocks.forEach((block, index) => {
      const center = centers[index];
      const dist = Math.abs(progress - center);

      if (dist < halfWidth) {
        const t = dist / halfWidth;
        const opacity = Math.cos(t * Math.PI * 0.5);
        const dir = progress > center ? -1 : 1;
        const translateY = dir * (1 - opacity) * 20;

        block.style.opacity = opacity.toFixed(3);
        block.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;
        block.style.pointerEvents = opacity > 0.35 ? 'auto' : 'none';
        block.classList.toggle('active', opacity > 0.35);
      } else {
        block.style.opacity = '0';
        block.style.transform = `translate3d(0, ${progress > center ? '-24px' : '24px'}, 0)`;
        block.style.pointerEvents = 'none';
        block.classList.remove('active');
      }
    });

    updateChapterRail(progress);

    if (cinematicShade) {
      if (progress > 0.85) {
        const exitFade = clamp(1 - (progress - 0.85) * 4, 0.25, 1);
        cinematicShade.style.opacity = exitFade.toFixed(2);
      } else {
        cinematicShade.style.opacity = '1';
      }
    }
  }

  // --- Update HUD Bar & Timecode ---
  function updateHUD(progress) {
    if (progressBar) {
      progressBar.style.width = `${(progress * 100).toFixed(2)}%`;
    }
    if (timeCode) {
      timeCode.textContent = formatTime(progress * duration);
    }
  }

  // --- Animation Loop with Damped Interpolation (Fallback) ---
  function renderLoop(time) {
    if (lenis) {
      lenis.raf(time);
    }

    // Smooth lerp toward target scroll progress for silky scrub feel
    const delta = scrollProgress - smoothProgress;
    if (Math.abs(delta) > 0.00005) {
      smoothProgress += delta * 0.45;
      if (Math.abs(delta) < 0.0002) {
        smoothProgress = scrollProgress;
      }
    } else {
      smoothProgress = scrollProgress;
    }

    updateScenes(smoothProgress);
    updateHUD(smoothProgress);

    if (!prefersReducedMotion) {
      seekVideoTo(smoothProgress * duration);
    }

    drawCanvasFrame();

    rafId = requestAnimationFrame(renderLoop);
  }

  // --- Scroll Handler ---
  let lastNavScrolled = null;
  function onScroll() {
    if (!isGsapActive) {
      scrollProgress = getProgress();
    }

    // Toggle navigation background when scrolled past initial hero
    if (mainNav) {
      const isScrolled = window.scrollY > 40;
      if (isScrolled !== lastNavScrolled) {
        lastNavScrolled = isScrolled;
        mainNav.classList.toggle('scrolled', isScrolled);
      }
    }
  }

  // --- Video Initialization & Adaptive Playback Engine ---
  function initVideo() {
    duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10.006;
    videoReady = true;
    resizeCanvas();
    drawCanvasFrame();
    onScroll();

    if (isTouchDevice) {
      // Mobile Profile: Native video element handles hardware decoding with 0 CPU overhead!
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.play().catch(() => {});
    } else {
      // Desktop Profile: prime hardware video decoder for frame-by-frame scroll scrub
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          video.pause();
          drawCanvasFrame();
        }).catch(() => {
          drawCanvasFrame();
        });
      }
    }
  }

  if (video) {
    video.addEventListener('loadedmetadata', initVideo);
    video.addEventListener('loadeddata', () => {
      videoReady = true;
      if (!isTouchDevice) {
        drawCanvasFrame();
      } else {
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.play().catch(() => {});
      }
      onScroll();
    });
  }

  // Mobile first interaction unlock for video playback
  if (isTouchDevice && video) {
    const startMobileVideo = () => {
      if (video.paused) {
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.play().catch(() => {});
      }
    };
    window.addEventListener('touchstart', startMobileVideo, { passive: true, once: true });
    window.addEventListener('touchend', startMobileVideo, { passive: true, once: true });
    window.addEventListener('scroll', startMobileVideo, { passive: true, once: true });
  }

  // Auto-pause video when scrolled out of view to preserve 100% GPU for the rest of the site
  if (video && 'IntersectionObserver' in window && cinemaStage) {
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (isTouchDevice && video.paused) {
            video.play().catch(() => {});
          }
        } else {
          if (!video.paused) {
            video.pause();
          }
        }
      });
    }, { threshold: 0.05 });
    heroObserver.observe(cinemaStage);
  }

  // --- Standalone Video Fallback Loader (Enables Running Anywhere as a Single File) ---
  let embeddedBlobLoaded = false;
  function loadEmbeddedVideoBlob() {
    if (embeddedBlobLoaded || videoReady) return;
    if (typeof window.__EMBEDDED_VIDEO_BASE64__ === 'string' && window.__EMBEDDED_VIDEO_BASE64__.length > 1000) {
      embeddedBlobLoaded = true;
      try {
        const binary = atob(window.__EMBEDDED_VIDEO_BASE64__);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        video.load();
      } catch (err) {
        console.warn('Could not decode embedded standalone video:', err);
      }
    }
  }

  const videoSourceEl = video ? video.querySelector('source') : null;
  if (videoSourceEl) {
    videoSourceEl.addEventListener('error', loadEmbeddedVideoBlob);
  }
  if (video) {
    video.addEventListener('error', loadEmbeddedVideoBlob);
  }

  // Fallback: If video metadata hasn't loaded after 400ms (e.g. standalone file on another computer)
  setTimeout(() => {
    if (video && video.readyState === 0 && !videoReady) {
      loadEmbeddedVideoBlob();
    }
  }, 400);

  // If already loaded from cache
  if (video && video.readyState >= 1) {
    initVideo();
  }

  // --- Keyboard Accessibility for Scrolling ---
  window.addEventListener('keydown', (e) => {
    // Only intercept when not inside a modal or input field
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }
    if (registerModal && registerModal.classList.contains('open')) {
      return;
    }

    if (e.key === 'ArrowDown') {
      if (lenis) {
        lenis.scrollTo(window.scrollY + window.innerHeight * 0.45, { duration: 0.6 });
      } else {
        window.scrollBy({ top: window.innerHeight * 0.45, behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowUp') {
      if (lenis) {
        lenis.scrollTo(window.scrollY - window.innerHeight * 0.45, { duration: 0.6 });
      } else {
        window.scrollBy({ top: -window.innerHeight * 0.45, behavior: 'smooth' });
      }
    }
  });

  // --- Mobile Drawer Controls ---
  function openMobileMenu() {
    if (!mobileDrawer) return;
    mobileDrawer.classList.add('open');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
  }

  function closeMobileMenu() {
    if (!mobileDrawer) return;
    mobileDrawer.classList.remove('open');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', openMobileMenu);
  }
  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', closeMobileMenu);
  }
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeMobileMenu);
  }

  drawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // --- Interactive Registration Modal Dialog ---
  function openRegisterModal(preferredTier = '') {
    if (!registerModal) return;
    registerModal.classList.add('open');
    registerModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();

    // Auto-select role dropdown if triggered from tier card
    if (preferredTier && regRoleSelect) {
      const matchOpt = [...regRoleSelect.options].find(opt =>
        opt.value.toLowerCase().includes(preferredTier.toLowerCase())
      );
      if (matchOpt) {
        regRoleSelect.value = matchOpt.value;
      }
    }

    // Focus first input field
    const firstInput = registerModal.querySelector('input');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  function closeRegisterModal() {
    if (!registerModal) return;
    registerModal.classList.remove('open');
    registerModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lenis) lenis.start();

    // Reset success state after closing
    setTimeout(() => {
      if (modalSuccessState && registrationForm) {
        modalSuccessState.style.display = 'none';
        registrationForm.style.display = 'flex';
        registrationForm.reset();
      }
    }, 400);
  }

  registerTriggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileMenu();
      const type = btn.getAttribute('data-type');
      if (type) {
        openRegisterModal(type);
      } else {
        openRegisterModal();
      }
    });
  });

  sponsorTriggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tier = btn.getAttribute('data-tier') || '';
      openRegisterModal(`Patrocinador ${tier}`);
    });
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeRegisterModal);
  }

  if (registerModal) {
    registerModal.addEventListener('click', (e) => {
      if (e.target === registerModal) {
        closeRegisterModal();
      }
    });
  }

  if (successCloseBtn) {
    successCloseBtn.addEventListener('click', closeRegisterModal);
  }

  // --- Floor Plan Lightbox Modal ---
  const floorplanLightbox = document.getElementById('floorplanLightbox');
  const floorplanTrigger = document.getElementById('floorplanTrigger');
  const floorplanLightboxClose = document.getElementById('floorplanLightboxClose');
  const floorplanLightboxBackdrop = document.getElementById('floorplanLightboxBackdrop');

  function openFloorplanLightbox() {
    if (!floorplanLightbox) return;
    floorplanLightbox.classList.add('open');
    floorplanLightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
  }

  function closeFloorplanLightbox() {
    if (!floorplanLightbox) return;
    floorplanLightbox.classList.remove('open');
    floorplanLightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
  }

  if (floorplanTrigger) {
    floorplanTrigger.addEventListener('click', openFloorplanLightbox);
    floorplanTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFloorplanLightbox();
      }
    });
  }
  if (floorplanLightboxClose) {
    floorplanLightboxClose.addEventListener('click', closeFloorplanLightbox);
  }
  if (floorplanLightboxBackdrop) {
    floorplanLightboxBackdrop.addEventListener('click', closeFloorplanLightbox);
  }

  // Handle Form Submission with Feedback
  if (registrationForm) {
    registrationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = registrationForm.querySelector('.submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>PROCESANDO REGISTRO...</span>';
      }

      // Simulate quick secure API dispatch
      setTimeout(() => {
        if (registrationForm && modalSuccessState) {
          registrationForm.style.display = 'none';
          modalSuccessState.style.display = 'block';
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>ENVIAR SOLICITUD DE REGISTRO</span><span class="btn-arrow">→</span>';
          }
        }
      }, 700);
    });
  }

  // ESC key listener for modals and mobile menu
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (floorplanLightbox && floorplanLightbox.classList.contains('open')) {
        closeFloorplanLightbox();
      } else if (registerModal && registerModal.classList.contains('open')) {
        closeRegisterModal();
      } else if (mobileDrawer && mobileDrawer.classList.contains('open')) {
        closeMobileMenu();
      }
    }
  });

  // --- Interactive 4-Step Matchmaking Cards ---
  processCards.forEach(card => {
    card.addEventListener('click', () => {
      processCards.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-selected', 'true');
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  // --- Interactive Day 1 / Day 2 Agenda Tabs ---
  dayTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const selectedDay = tab.getAttribute('data-day');

      dayTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Filter rows with fade transition
      agendaRows.forEach(row => {
        const rowDay = row.getAttribute('data-day');
        if (rowDay === selectedDay) {
          row.style.display = 'grid';
          row.style.opacity = '0';
          setTimeout(() => {
            row.style.transition = 'opacity 0.35s ease';
            row.style.opacity = '1';
          }, 30);
        } else {
          row.style.display = 'none';
        }
      });
    });
  });

  // Initialize Day 1 as active filter if tabs exist
  const initialDayTab = document.querySelector('.day-tab.active');
  if (initialDayTab) {
    initialDayTab.click();
  }

  // --- Bilingual Language Toggle Engine (Spanish <-> English) ---
  const translateBtn = document.getElementById('translateBtn');
  const translateBtnLabel = document.getElementById('translateBtnLabel');
  let currentLang = 'es';

  const i18nData = {
    es: {
      btnLabel: 'Translate to English',
      nav: ['Negocios B2B', 'Agenda', 'Expo', 'Sede Oficial', 'Contacto'],
      navRegister: 'REGISTRARME',
      hudScroll: 'DESPLÁZATE PARA EXPLORAR',
      scene01Eyebrow: '15ª EDICIÓN · 2 & 3 DE DICIEMBRE 2026 · MÉXICO',
      scene01Title: 'El punto de encuentro<br /><em class="title-italic">del turismo médico.</em>',
      scene01Lead: 'El punto de encuentro más importante de Latinoamérica. Conecta con líderes, compradores, instituciones y profesionales que están transformando el futuro de la salud internacional.',
      scene01Cta1: 'REGÍSTRATE AHORA',
      scene01Cta2: 'DESCUBRIR EL CONGRESO',
      scene02Eyebrow: 'NEGOCIOS · CONEXIONES · OPORTUNIDADES',
      scene02Title: 'Donde una conversación<br /><em class="title-italic">se convierte en negocio.</em>',
      scene02Desc: 'Reuniones B2B preagendadas de 15 minutos para conectar oferta médica con compradores, facilitadores, aseguradoras y aliados internacionales de Canadá, EE.UU. y México.',
      scene02Cta: 'CONOCE EL PROGRAMA B2B',
      scene03Eyebrow: 'CONOCIMIENTO',
      scene03Title: 'Ideas que mueven<br /><em class="title-italic">una industria.</em>',
      scene03Cta: 'VER AGENDA COMPLETA',
      scene04Eyebrow: 'EXPO · VISIBILIDAD · MARCA',
      scene04Title: 'Haz que tu marca<br /><em class="title-italic">forme parte del encuentro.</em>',
      scene04Desc: 'Muestra tu competitividad médica o turística y haz negocios frente a una comunidad profesional que busca nuevas soluciones y alianzas.',
      scene04Cta: 'EXPLORAR EXPO',
      scene05Eyebrow: '2 & 3 DE DICIEMBRE · MÉXICO',
      scene05Title: 'El próximo capítulo<br /><em class="title-italic">empieza aquí.</em>',
      scene05Desc: 'Regístrate al mejor congreso de turismo médico de América Latina. Reserva tu lugar en la 15ª edición.',
      scene05Cta1: 'QUIERO PARTICIPAR',
      scene05Cta2: 'REGISTRO & CONTACTO',
      sec1Eyebrow: 'SISTEMA DE CITAS PRE-ESTABLECIDAS',
      sec1Title: 'Conoce a las personas<br /><em class="headline-accent gold-accent">correctas.</em>',
      sec2Eyebrow: 'CONFERENCIAS · PANELES · EXPERTOS',
      sec2Title: 'Dos días de<br /><em class="headline-accent">ideas accionables.</em>',
      sec3Eyebrow: 'PARTICIPA COMO EXPOSITOR',
      sec3Title: 'Tu marca.<br /><em class="headline-accent gold-accent">En el centro.</em>',
      sec4Eyebrow: 'RESPALDO INSTITUCIONAL',
      sec4Title: 'Aliados que impulsan<br /><em class="headline-accent">el turismo médico.</em>',
      sec5Eyebrow: 'PARTICIPA Y HAZ NEGOCIOS CON EL TURISMO MÉDICO',
      sec5Title: 'Regístrate al mejor congreso<br /><em class="headline-accent gold-accent">de turismo médico de América Latina.</em>',
      sec5Desc: 'Todo lo que debes saber sobre el 15° Congreso de Turismo Médico: descarga los formatos oficiales de inscripción o ponte en contacto directo con el comité organizador.',
    },
    en: {
      btnLabel: 'Traducir a Español',
      nav: ['B2B Business', 'Agenda', 'Expo', 'Official Venue', 'Contact'],
      navRegister: 'REGISTER',
      hudScroll: 'SCROLL TO EXPLORE',
      scene01Eyebrow: '15th EDITION · DEC 2–3, 2026 · MEXICO',
      scene01Title: 'The meeting point<br /><em class="title-italic">for medical tourism.</em>',
      scene01Lead: "Latin America's premier medical tourism summit. Connect with leaders, buyers, institutions, and professionals shaping the future of international healthcare.",
      scene01Cta1: 'REGISTER NOW',
      scene01Cta2: 'DISCOVER THE CONGRESS',
      scene02Eyebrow: 'BUSINESS · CONNECTIONS · OPPORTUNITIES',
      scene02Title: 'Where a conversation<br /><em class="title-italic">turns into business.</em>',
      scene02Desc: 'Pre-scheduled 15-minute B2B meetings connecting medical providers with buyers, facilitators, insurers, and international partners from Canada, the USA, and Mexico.',
      scene02Cta: 'EXPLORE B2B PROGRAM',
      scene03Eyebrow: 'KNOWLEDGE',
      scene03Title: 'Ideas that move<br /><em class="title-italic">an industry forward.</em>',
      scene03Cta: 'VIEW FULL AGENDA',
      scene04Eyebrow: 'EXPO · VISIBILITY · BRANDING',
      scene04Title: 'Make your brand<br /><em class="title-italic">part of the gathering.</em>',
      scene04Desc: 'Showcase your medical and tourism competitiveness and build partnerships before a premier community of healthcare leaders seeking cross-border solutions.',
      scene04Cta: 'EXPLORE EXPO',
      scene05Eyebrow: 'DECEMBER 2–3, 2026 · MEXICO',
      scene05Title: 'The next chapter<br /><em class="title-italic">starts here.</em>',
      scene05Desc: "Reserve your seat at Latin America's leading medical tourism congress. Shape the next frontier of cross-border health and travel.",
      scene05Cta1: 'JOIN THE CONGRESS',
      scene05Cta2: 'REGISTER & CONTACT',
      sec1Eyebrow: 'PRE-SCHEDULED APPOINTMENT SYSTEM',
      sec1Title: 'Meet the right<br /><em class="headline-accent gold-accent">people.</em>',
      sec2Eyebrow: 'KEYNOTES · PANELS · EXPERTS',
      sec2Title: 'Two days of<br /><em class="headline-accent">actionable insights.</em>',
      sec3Eyebrow: 'PARTICIPATE AS AN EXHIBITOR',
      sec3Title: 'Your brand.<br /><em class="headline-accent gold-accent">Front and center.</em>',
      sec4Eyebrow: 'INSTITUTIONAL ENDORSEMENT',
      sec4Title: 'Allies driving<br /><em class="headline-accent">medical tourism.</em>',
      sec5Eyebrow: 'PARTICIPATE AND DO BUSINESS IN MEDICAL TOURISM',
      sec5Title: 'Register for the premier<br /><em class="headline-accent gold-accent">medical tourism congress in Latin America.</em>',
      sec5Desc: 'Everything you need to know about the 15th Medical Tourism Congress: download official registration forms or contact the organizing committee directly.',
    }
  };

  function toggleLanguage() {
    currentLang = currentLang === 'es' ? 'en' : 'es';
    const dict = i18nData[currentLang];
    document.documentElement.lang = currentLang;

    const setHtml = (selector, html) => {
      const el = document.querySelector(selector);
      if (el) el.innerHTML = html;
    };
    const setText = (selector, text) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = text;
    };

    // Nav Links
    const navLinks = document.querySelectorAll('.nav-links .nav-link');
    dict.nav.forEach((label, idx) => {
      if (navLinks[idx]) navLinks[idx].textContent = label;
    });

    const drawerNavLinks = document.querySelectorAll('.drawer-nav .drawer-link');
    dict.nav.forEach((label, idx) => {
      if (drawerNavLinks[idx]) {
        const numSpan = drawerNavLinks[idx].querySelector('span');
        const numText = numSpan ? numSpan.outerHTML : '';
        drawerNavLinks[idx].innerHTML = `${numText} ${label}`;
      }
    });

    const navCta = document.querySelector('.nav-cta span');
    if (navCta) navCta.textContent = dict.navRegister;

    // HUD
    setText('.hud-text', dict.hudScroll);

    // Scenes
    setText('.scene-hero .eyebrow', dict.scene01Eyebrow);
    setHtml('.scene-hero .hero-title', dict.scene01Title);
    setText('.scene-hero .scene-desc', dict.scene01Lead);
    setText('.scene-hero .btn-register-trigger span', dict.scene01Cta1);
    setText('.scene-hero .button.ghost span', dict.scene01Cta2);

    setText('.scene-business .eyebrow', dict.scene02Eyebrow);
    setHtml('.scene-business .scene-title', dict.scene02Title);
    setText('.scene-business .scene-desc', dict.scene02Desc);
    setText('.scene-business .editorial-link span', dict.scene02Cta);

    setText('.scene-agenda .eyebrow', dict.scene03Eyebrow);
    setHtml('.scene-agenda .scene-title', dict.scene03Title);
    setText('.scene-agenda .editorial-link span', dict.scene03Cta);

    setText('.scene-expo .eyebrow', dict.scene04Eyebrow);
    setHtml('.scene-expo .scene-title', dict.scene04Title);
    setText('.scene-expo .scene-desc', dict.scene04Desc);
    setText('.scene-expo .button.primary span', dict.scene04Cta);

    setText('.scene-final .eyebrow', dict.scene05Eyebrow);
    setHtml('.scene-final .scene-title', dict.scene05Title);
    setText('.scene-final .scene-desc', dict.scene05Desc);
    setText('.scene-final .button.primary span', dict.scene05Cta1);
    setText('.scene-final .button.ghost span', dict.scene05Cta2);

    // Sections
    setText('.section-business .eyebrow', dict.sec1Eyebrow);
    setHtml('.section-business .editorial-headline', dict.sec1Title);

    setText('.section-agenda .eyebrow', dict.sec2Eyebrow);
    setHtml('.section-agenda .editorial-headline', dict.sec2Title);

    setText('.section-expo .eyebrow', dict.sec3Eyebrow);
    setHtml('.section-expo .editorial-headline', dict.sec3Title);

    setText('.section-allies .eyebrow', dict.sec4Eyebrow);
    setHtml('.section-allies .editorial-headline', dict.sec4Title);

    setText('.section-contacto .eyebrow', dict.sec5Eyebrow);
    setHtml('.section-contacto .editorial-headline', dict.sec5Title);
    setText('.section-contacto .header-desc', dict.sec5Desc);

    if (translateBtnLabel) {
      translateBtnLabel.textContent = dict.btnLabel;
    }
  }

  if (translateBtn) {
    translateBtn.addEventListener('click', toggleLanguage);
  }

  // --- Smooth Scroll Anchor Click Handler with Lenis Support ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href) return;
      if (href === '#' || href === '#top') {
        e.preventDefault();
        closeMobileMenu();
        if (lenis) {
          lenis.scrollTo(0, { duration: 1.2 });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      const targetElem = document.querySelector(href);
      if (targetElem) {
        e.preventDefault();
        closeMobileMenu();
        if (lenis) {
          lenis.scrollTo(targetElem, { offset: -60, duration: 1.2 });
        } else {
          targetElem.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // --- Back to Top Buttons (Desktop Footer & Floating Mobile) ---
  const backToTopBtn = document.getElementById('backToTopBtn');
  const mobileBackToTop = document.getElementById('mobileBackToTop');

  function handleScrollToTop(e) {
    if (e) e.preventDefault();
    if (lenis) {
      lenis.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', handleScrollToTop);
  }

  if (mobileBackToTop) {
    mobileBackToTop.addEventListener('click', handleScrollToTop);
    let lastShowMobileBtn = null;
    window.addEventListener('scroll', () => {
      const show = window.scrollY > 350;
      if (show !== lastShowMobileBtn) {
        lastShowMobileBtn = show;
        mobileBackToTop.classList.toggle('visible', show);
      }
    }, { passive: true });
  }

  /* ============================================================
     STRATUM INTERACTIVE ENGINES: DECODE, PARALLAX & RAIL
     ============================================================ */

  // --- 1. Real-Time Text Decode Scramble Engine ---
  const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const DECODE_DUR = 400;

  function initDecodeLabels() {
    const labels = [].slice.call(document.querySelectorAll('.t'));
    labels.forEach(el => {
      if (!el.dataset.text) el.dataset.text = el.textContent.trim();
    });

    function reserveWidths() {
      const widths = [];
      labels.forEach(el => { el.style.width = ''; });
      labels.forEach(el => { widths.push(el.getBoundingClientRect().width); });
      labels.forEach((el, i) => {
        if (widths[i] > 0) el.style.width = (Math.ceil(widths[i] * 100) / 100) + 'px';
      });
    }

    function settleLabel(el) {
      if (el._raf) { cancelAnimationFrame(el._raf); el._raf = 0; }
      if (el._t) { clearTimeout(el._t); el._t = 0; }
      el.textContent = el.dataset.text || '';
    }

    function decodeLabel(el, dur) {
      const text = el.dataset.text || el.textContent.trim();
      const n = text.length;
      if (prefersReducedMotion || !n) {
        settleLabel(el);
        return;
      }
      settleLabel(el);
      const D = dur || DECODE_DUR;
      const t0 = performance.now();
      let lastRoll = 0;
      const rand = new Array(n);
      function roll() {
        for (let i = 0; i < n; i++) rand[i] = CH.charAt((Math.random() * 26) | 0);
      }
      roll();

      function step(now) {
        const p = Math.min(1, (now - t0) / D);
        const front = p * n;
        let out = '';
        if (now - lastRoll > 45) {
          roll();
          lastRoll = now;
        }
        for (let i = 0; i < n; i++) {
          const c = text.charAt(i);
          if (i < front) out += c;
          else if (i < front + 3.6) out += (c === ' ' ? ' ' : rand[i]);
          else break;
        }
        el.textContent = out;
        if (p < 1) {
          el._raf = requestAnimationFrame(step);
        } else {
          settleLabel(el);
        }
      }
      el._raf = requestAnimationFrame(step);
      el._t = setTimeout(() => { settleLabel(el); }, D + 500);
    }

    // Attach hover listener to all parent interactive links/buttons
    document.querySelectorAll('a, button, .index-rail li').forEach(el => {
      const t = el.querySelector('.t');
      if (!t) return;
      el.addEventListener('pointerenter', () => { decodeLabel(t); });
    });

    reserveWidths();

    // Staggered initial boot decode
    function bootDecode() {
      reserveWidths();
      if (prefersReducedMotion) return;
      function at(sel, t0, step) {
        [].slice.call(document.querySelectorAll(sel)).forEach((el, i) => {
          setTimeout(() => { decodeLabel(el); }, t0 + i * (step || 0));
        });
      }
      at('.enter-pill .t', 330);
      at('.menu-pill .t', 390);
      at('.nav-link .t', 360, 45);
      at('.index-rail li.on .t', 660);
      at('.index-rail li:not(.on) .t', 720, 55);
      at('.cta-oct .t', 900);
      at('.dock-btn .t', 1000, 60);

      setTimeout(() => { labels.forEach(settleLabel); }, 2600);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(bootDecode);
    } else {
      setTimeout(bootDecode, 300);
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(reserveWidths, 160);
    }, { passive: true });
  }

  // --- 2. Stratum Subtle Inertia Mouse Parallax (Desktop Only) ---
  function initStratumParallax() {
    if (isTouchDevice || prefersReducedMotion) return;
    const stageWrap = document.querySelector('.canvas-wrap');
    if (!stageWrap) return;

    let tx = 0, ty = 0, cx = 0, cy = 0;
    let running = false;

    function tickParallax() {
      cx += (tx - cx) * 0.045;
      cy += (ty - cy) * 0.045;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dx = -cx * w * 0.012;
      const dy = -cy * h * 0.01;
      const cover = 2 * Math.max(Math.abs(dx) / w, Math.abs(dy) / h);
      const sc = 1 + cover;

      stageWrap.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;

      if (Math.abs(tx - cx) < 0.0004 && Math.abs(ty - cy) < 0.0004) {
        running = false;
        return;
      }
      requestAnimationFrame(tickParallax);
    }

    function wakeParallax() {
      if (!running && !prefersReducedMotion) {
        running = true;
        requestAnimationFrame(tickParallax);
      }
    }

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      wakeParallax();
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      tx = 0;
      ty = 0;
      wakeParallax();
    });
  }

  // --- 3. Chapter Index Rail Navigation ---
  function initChapterRail() {
    const railLinks = document.querySelectorAll('.index-rail li');
    railLinks.forEach(li => {
      li.addEventListener('click', (e) => {
        e.preventDefault();
        const targetRatio = parseFloat(li.dataset.target) || 0;
        if (!cinemaStage) return;
        const maxScroll = cinemaStage.offsetHeight - window.innerHeight;
        const targetScrollY = cinemaStage.offsetTop + maxScroll * targetRatio;

        if (lenis) {
          lenis.scrollTo(targetScrollY, { duration: 1.0 });
        } else {
          window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
        }
      });
    });
  }

  // --- 4. Contact Star Button Smooth Navigation ---
  function initContactStarBtn() {
    const contactStarBtn = document.getElementById('contactStarBtn');
    if (!contactStarBtn) return;
    contactStarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('contacto');
      if (target) {
        if (lenis) {
          lenis.scrollTo(target, { duration: 1.2 });
        } else {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  // --- 5. Interactive YouTube Facade Players (Zero 404s, High Performance) ---
  function initYouTubeFacades() {
    const facades = document.querySelectorAll('.yt-facade');
    facades.forEach(facade => {
      facade.addEventListener('click', (e) => {
        if (e.target.closest('.yt-direct-pill')) return;

        const videoId = facade.getAttribute('data-video-id');
        const title = facade.getAttribute('data-title') || 'Video Oficial del Congreso';
        if (!videoId) return;

        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`);
        iframe.setAttribute('title', title);
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        iframe.setAttribute('allowfullscreen', 'true');
        if (facade.classList.contains('footer-yt-facade')) {
          iframe.className = 'footer-yt-iframe';
        }
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.position = 'absolute';
        iframe.style.inset = '0';
        iframe.style.border = '0';

        facade.replaceWith(iframe);
      });
    });
  }

  // --- 6. Ambient Smoke Background & Card Mouse Hover Tracking (Desktop Only) ---
  function initSmokeHoverEffects() {
    if (isTouchDevice) return;
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let currentX = mouseX;
    let currentY = mouseY;
    let isTracking = false;

    // Track global mouse position with smooth lerp
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isTracking) {
        isTracking = true;
        requestAnimationFrame(updateSmokeLoop);
      }
    }, { passive: true });

    function updateSmokeLoop() {
      // Linear interpolation (smooth damping)
      currentX += (mouseX - currentX) * 0.08;
      currentY += (mouseY - currentY) * 0.08;

      const normX = (currentX / window.innerWidth) * 100;
      const normY = (currentY / window.innerHeight) * 100;

      // Subtle parallax shift (-24px to +24px)
      const shiftX = ((currentX / window.innerWidth) - 0.5) * 40;
      const shiftY = ((currentY / window.innerHeight) - 0.5) * 40;

      document.documentElement.style.setProperty('--mouse-x', `${normX.toFixed(2)}%`);
      document.documentElement.style.setProperty('--mouse-y', `${normY.toFixed(2)}%`);
      document.documentElement.style.setProperty('--smoke-shift-x', `${(-shiftX).toFixed(1)}px`);
      document.documentElement.style.setProperty('--smoke-shift-y', `${(-shiftY).toFixed(1)}px`);

      if (Math.abs(mouseX - currentX) > 0.1 || Math.abs(mouseY - currentY) > 0.1) {
        requestAnimationFrame(updateSmokeLoop);
      } else {
        isTracking = false;
      }
    }

    // Per-card local mouse coordinate tracking for dynamic smoke illumination
    const interactiveCards = document.querySelectorAll(
      '.video-card, .business-card, .photo-card, .rec-card, .contact-box, .venue-feature-card, .stat-hero-card, .process-card, .portal-card, .speaker-mini-card, .matchmaking-banner, .expo-venue-teaser-card, .ally-item'
    );
    interactiveCards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const shiftX = ((x / rect.width) - 0.5) * 26;
        const shiftY = ((y / rect.height) - 0.5) * 26;

        card.style.setProperty('--card-local-x', `${x.toFixed(1)}px`);
        card.style.setProperty('--card-local-y', `${y.toFixed(1)}px`);
        card.style.setProperty('--card-smoke-x', `${shiftX.toFixed(1)}px`);
        card.style.setProperty('--card-smoke-y', `${shiftY.toFixed(1)}px`);
      }, { passive: true });
    });
  }

  // Initialize Stratum Enhancements
  initDecodeLabels();
  initStratumParallax();
  initChapterRail();
  initContactStarBtn();
  initYouTubeFacades();
  initSmokeHoverEffects();

  // --- Event Listeners for Resize & Scroll ---
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    if (!isTouchDevice) {
      resizeCanvas();
    }
    if (hasScrollTrigger && window.ScrollTrigger) {
      window.ScrollTrigger.refresh();
    }
  }, { passive: true });

  // Initialize on page load
  resizeCanvas();
  onScroll();
  isGsapActive = initHeroScroller();
  if (!isGsapActive) {
    rafId = requestAnimationFrame(renderLoop);
  }

})();
