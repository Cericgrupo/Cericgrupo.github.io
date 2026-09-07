/* ==========================================================================
   CERIC — Introducción cinematográfica (lógica)
   Componente independiente. No depende de main.js ni de ceric-interactivo.js.
   ========================================================================== */

(function () {
    "use strict";

    /* ----------------------------------------------------------------------
       CONFIGURACIÓN — edita aquí los textos, duración y audio de la intro.
       ---------------------------------------------------------------------- */
    var INTRO_CONFIG = {
        enabled: true,              // false = la intro nunca se muestra
        duration: 5000,             // duración total en pantalla, en ms, antes de la salida
        exitDuration: 900,          // duración de la transición de salida, en ms
        subtitle: "RECUPERANDO NUESTRA MEMORIA HISTÓRICA",
        // Alternativa sugerida: "CENTRO DE INVESTIGACIÓN"
        audioEnabled: false,        // cambia a true cuando tengas el archivo de audio
        audioSrc: "audio/intro-ceric.mp3",
        audioVolume: 0.55,          // volumen máximo del audio (0 a 1)
        showOnlyOnce: false         // true = solo se muestra una vez por navegador (usa localStorage)
    };

    // Exponer la configuración por si se quiere ajustar desde la consola o desde otro script
    window.CERIC_INTRO_CONFIG = INTRO_CONFIG;

    var STORAGE_KEY = "ceric-intro-seen";

    document.addEventListener("DOMContentLoaded", function () {
        var intro = document.getElementById("ceric-intro");
        if (!intro) return;

        var html = document.documentElement;

        // Si la intro está desactivada, o ya se mostró antes (modo "una sola vez"),
        // se retira de inmediato sin animaciones ni bloqueo de scroll.
        var alreadySeen = INTRO_CONFIG.showOnlyOnce && safeStorageGet(STORAGE_KEY) === "1";

        if (!INTRO_CONFIG.enabled || alreadySeen) {
            removeIntro(intro, html);
            return;
        }

        var reducedMotion = window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        var subtitleEl = intro.querySelector(".intro-subtitle");
        if (subtitleEl) subtitleEl.textContent = INTRO_CONFIG.subtitle;

        var skipBtn = intro.querySelector(".intro-skip");
        var audioEl = intro.querySelector(".intro-audio");
        var canvas = intro.querySelector(".intro-particles");

        var finished = false;
        var timers = [];
        var fadeInterval = null;
        var particles = null;

        // --- Partículas / polvo flotando (canvas discreto) -----------------
        if (canvas && !reducedMotion) {
            particles = initParticles(canvas);
        }

        // --- Audio opcional --------------------------------------------------
        if (INTRO_CONFIG.audioEnabled && audioEl) {
            try {
                audioEl.src = INTRO_CONFIG.audioSrc;
                audioEl.volume = 0;
                var playPromise = audioEl.play();
                if (playPromise && typeof playPromise.then === "function") {
                    playPromise.then(function () {
                        fadeAudioTo(audioEl, INTRO_CONFIG.audioVolume, 600);
                    }).catch(function () {
                        // Reproducción automática bloqueada por el navegador.
                        // La intro continúa normalmente, sin sonido.
                    });
                } else {
                    fadeAudioTo(audioEl, INTRO_CONFIG.audioVolume, 600);
                }
            } catch (err) {
                // Si el archivo de audio todavía no existe o falla, la intro
                // sigue funcionando con normalidad.
            }
        }

        // --- Secuencia de escenas -------------------------------------------
        if (reducedMotion) {
            // Secuencia simplificada: sin desenfoques ni movimiento, solo
            // apariciones directas y una pausa breve.
            intro.classList.add("ceric-scene-somos");
            timers.push(setTimeout(function () {
                intro.classList.add("ceric-scene-ceric");
            }, 150));
            timers.push(setTimeout(function () {
                intro.classList.add("ceric-scene-subtitle");
            }, 300));
            timers.push(setTimeout(exitIntro, Math.min(INTRO_CONFIG.duration, 2200)));
        } else {
            timers.push(setTimeout(function () {
                intro.classList.add("ceric-scene-somos");
            }, 500));
            timers.push(setTimeout(function () {
                intro.classList.add("ceric-scene-ceric");
            }, 1500));
            timers.push(setTimeout(function () {
                intro.classList.add("ceric-scene-subtitle");
            }, 2700));
            timers.push(setTimeout(exitIntro, INTRO_CONFIG.duration));
        }

        if (skipBtn) {
            skipBtn.addEventListener("click", function () {
                exitIntro(true);
            });
        }

        function exitIntro(skipped) {
            if (finished) return;
            finished = true;

            timers.forEach(clearTimeout);
            if (particles) particles.stop();

            if (audioEl && !audioEl.paused) {
                fadeAudioTo(audioEl, 0, skipped ? 200 : 500, function () {
                    audioEl.pause();
                });
            }

            if (skipped) intro.classList.add("ceric-intro-exit-fast");
            intro.classList.add("ceric-intro-exit");

            var wait = skipped ? 380 : INTRO_CONFIG.exitDuration;
            setTimeout(function () {
                if (INTRO_CONFIG.showOnlyOnce) safeStorageSet(STORAGE_KEY, "1");
                removeIntro(intro, html);
            }, wait);
        }

        function fadeAudioTo(el, target, duration, done) {
            if (fadeInterval) clearInterval(fadeInterval);
            var steps = 20;
            var stepTime = Math.max(duration / steps, 16);
            var start = el.volume;
            var delta = (target - start) / steps;
            var count = 0;
            fadeInterval = setInterval(function () {
                count++;
                var next = start + delta * count;
                el.volume = Math.min(1, Math.max(0, next));
                if (count >= steps) {
                    clearInterval(fadeInterval);
                    el.volume = Math.min(1, Math.max(0, target));
                    if (done) done();
                }
            }, stepTime);
        }
    });

    function removeIntro(intro, html) {
        html.classList.remove("ceric-intro-lock");
        if (intro && intro.parentNode) {
            intro.parentNode.removeChild(intro);
        }
    }

    function safeStorageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }

    function safeStorageSet(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* noop */ }
    }

    /* ------------------------------------------------------------------------
       Partículas de polvo muy discretas — canvas 2D ligero, sin dependencias.
       ------------------------------------------------------------------------ */
    function initParticles(canvas) {
        var ctx = canvas.getContext("2d");
        var running = true;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w, h, particles;

        function resize() {
            w = canvas.clientWidth;
            h = canvas.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function makeParticles() {
            var count = Math.round((w * h) / 26000);
            count = Math.max(18, Math.min(count, 60));
            particles = [];
            for (var i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.5 + Math.random() * 1.4,
                    vy: -(0.05 + Math.random() * 0.12),
                    vx: (Math.random() - 0.5) * 0.05,
                    a: 0.05 + Math.random() * 0.18
                });
            }
        }

        resize();
        makeParticles();

        var resizeHandler = function () {
            resize();
            makeParticles();
        };
        window.addEventListener("resize", resizeHandler);

        function frame() {
            if (!running) return;
            ctx.clearRect(0, 0, w, h);
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
                if (p.x < -10) p.x = w + 10;
                if (p.x > w + 10) p.x = -10;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(243, 237, 224, " + p.a + ")";
                ctx.fill();
            }
            requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);

        return {
            stop: function () {
                running = false;
                window.removeEventListener("resize", resizeHandler);
            }
        };
    }
})();
