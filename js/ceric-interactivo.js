/* =====================================================================
   CERIC - SCRIPT DE INTERACTIVIDAD PARA LAS NUEVAS SECCIONES
   No modifica ni reemplaza js/main.js: este archivo es independiente
   y solo controla las secciones agregadas (timeline, encuesta, quiz,
   comparador antes/ahora, mapa, videos, partículas y acciones finales).
   ===================================================================== */
(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        initTimeline();
        initStatsCounters();
        initQuiz();
        initCompareSlider();
        initHistoricMap();

        initMemorialParticles();
        initShareActions();
    });

    /* ===================================================================
       1. LÍNEA DE TIEMPO INTERACTIVA
       =================================================================== */
    function initTimeline() {
        var track = document.querySelector(".cvp-timeline");
        if (!track) return;

        var items = track.querySelectorAll(".cvp-timeline-item");
        var fill = track.querySelector(".cvp-timeline-track-fill");

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                }
            });
        }, { threshold: 0.35 });

        items.forEach(function (item) {
            observer.observe(item);
        });

        // Rellena la línea vertical según el progreso de scroll dentro de la sección
        function updateFill() {
            if (!fill) return;
            var rect = track.getBoundingClientRect();
            var viewportH = window.innerHeight;
            var total = rect.height;
            var scrolled = viewportH * 0.75 - rect.top;
            var pct = Math.max(0, Math.min(1, scrolled / total));
            fill.style.height = (pct * 100) + "%";
        }

        window.addEventListener("scroll", updateFill, { passive: true });
        window.addEventListener("resize", updateFill);
        updateFill();
    }

    /* ===================================================================
       2. CONTADORES Y ANILLOS ANIMADOS DE LA ENCUESTA
       =================================================================== */
    function initStatsCounters() {
        var cards = document.querySelectorAll(".cvp-stat-card");
        if (!cards.length) return;

        var CIRCUMFERENCE = 345; // 2 * PI * r(=54.9) aprox, coincide con stroke-dasharray del CSS

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var card = entry.target;
                if (card.dataset.animated === "true") return;
                card.dataset.animated = "true";

                var target = parseFloat(card.getAttribute("data-value")) || 0;
                var ring = card.querySelector(".cvp-ring-fill");
                var valueEl = card.querySelector(".cvp-stat-value");

                if (ring) {
                    var offset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(target, 100)) / 100;
                    // Pequeño delay para asegurar la transición CSS
                    requestAnimationFrame(function () {
                        ring.style.strokeDashoffset = offset;
                    });
                }

                if (valueEl) {
                    animateNumber(valueEl, target);
                }

                observer.unobserve(card);
            });
        }, { threshold: 0.4 });

        cards.forEach(function (card) {
            observer.observe(card);
        });
    }

    function animateNumber(el, target) {
        var duration = 1400;
        var startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var current = (progress * target).toFixed(2);
            el.textContent = Number(current) + "%";
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = target + "%";
            }
        }
        requestAnimationFrame(step);
    }

    /* ===================================================================
       3. QUIZ INTERACTIVO
       ===================================================================================
       Para editar las preguntas más adelante, modifica el arreglo QUIZ_DATA.
       Cada pregunta necesita: "pregunta", un arreglo "opciones" y el índice
       "correcta" (empieza en 0). "explicacion" es opcional y se muestra
       como retroalimentación tras responder.
       =================================================================== */
    var QUIZ_DATA = [
        {
            pregunta: "¿Cómo se llamaba anteriormente el Cerro Viva el Perú?",
            opciones: ["Cerro San Juan", "Cerro Chorrillos", "Cerro Tacalá", "Cerro Miraflores"],
            correcta: 0,
            explicacion: "Antes de llamarse Cerro Viva el Perú, el lugar era conocido como Cerro San Juan."
        },
        {
            pregunta: "¿En qué contexto histórico tuvo importancia el cerro?",
            opciones: ["La Guerra del Pacífico", "La Independencia del Perú", "La Guerra con Ecuador", "La Revolución Industrial"],
            correcta: 0,
            explicacion: "El cerro formó parte de la línea de defensa peruana durante la Guerra del Pacífico."
        },
        {
            pregunta: "¿Qué existe dentro o relacionado históricamente con el cerro?",
            opciones: ["Una fosa común histórica", "Un fuerte colonial", "Un palacio", "Un puerto"],
            correcta: 0,
            explicacion: "En el lugar se conserva una fosa común vinculada a la Batalla de San Juan y Chorrillos."
        },
        {
            pregunta: "¿En qué año se realizó la romería relacionada con la fosa común?",
            opciones: ["1889", "1879", "1921", "1992"],
            correcta: 0,
            explicacion: "La romería al campo de batalla, donde se reunieron los restos de los soldados, se realizó en 1889."
        },
        {
            pregunta: "¿Por qué es importante conservar la memoria del Cerro Viva el Perú?",
            opciones: [
                "Porque forma parte de la identidad histórica de Surco y del Perú",
                "Porque es un lugar sin ningún valor histórico",
                "Porque solo interesa a un grupo reducido de personas",
                "Porque no tiene relación con la historia del país"
            ],
            correcta: 0,
            explicacion: "Conservar su memoria fortalece la identidad histórica y patrimonial de Surco y del Perú."
        }
    ];

    function initQuiz() {
        var wrapper = document.getElementById("cvp-quiz");
        if (!wrapper) return;

        var state = {
            current: 0,
            score: 0,
            answered: false
        };

        var els = {
            counter: wrapper.querySelector(".cvp-quiz-counter"),
            progressFill: wrapper.querySelector(".cvp-quiz-progress-fill"),
            question: wrapper.querySelector(".cvp-quiz-question"),
            options: wrapper.querySelector(".cvp-quiz-options"),
            feedback: wrapper.querySelector(".cvp-quiz-feedback"),
            nextBtn: wrapper.querySelector(".cvp-quiz-next"),
            quizBody: wrapper.querySelector(".cvp-quiz-body"),
            resultBody: wrapper.querySelector(".cvp-quiz-result"),
            resultScore: wrapper.querySelector(".cvp-quiz-result-score"),
            resultMessage: wrapper.querySelector(".cvp-quiz-result-message"),
            restartBtn: wrapper.querySelector(".cvp-quiz-restart")
        };

        function renderQuestion() {
            var data = QUIZ_DATA[state.current];
            state.answered = false;

            els.counter.textContent = "Pregunta " + (state.current + 1) + " de " + QUIZ_DATA.length;
            els.progressFill.style.width = ((state.current) / QUIZ_DATA.length * 100) + "%";
            els.question.textContent = data.pregunta;
            els.feedback.textContent = "";
            els.nextBtn.classList.add("cvp-quiz-hidden");
            els.options.innerHTML = "";

            data.opciones.forEach(function (opcion, idx) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "cvp-quiz-option";
                btn.textContent = opcion;
                btn.addEventListener("click", function () {
                    handleAnswer(idx, btn);
                });
                els.options.appendChild(btn);
            });
        }

        function handleAnswer(selectedIdx, btnEl) {
            if (state.answered) return;
            state.answered = true;

            var data = QUIZ_DATA[state.current];
            var allButtons = els.options.querySelectorAll(".cvp-quiz-option");
            allButtons.forEach(function (b) { b.disabled = true; });

            if (selectedIdx === data.correcta) {
                state.score++;
                btnEl.classList.add("is-correct");
                els.feedback.textContent = "¡Correcto! " + (data.explicacion || "");
            } else {
                btnEl.classList.add("is-incorrect");
                allButtons[data.correcta].classList.add("is-correct");
                els.feedback.textContent = "No es correcto. " + (data.explicacion || "");
            }

            els.nextBtn.classList.remove("cvp-quiz-hidden");
        }

        function nextQuestion() {
            state.current++;
            if (state.current >= QUIZ_DATA.length) {
                showResult();
            } else {
                renderQuestion();
            }
        }

        function showResult() {
            els.progressFill.style.width = "100%";
            els.quizBody.classList.add("cvp-quiz-hidden");
            els.resultBody.classList.remove("cvp-quiz-hidden");
            els.resultScore.textContent = state.score + " / " + QUIZ_DATA.length;

            var mensaje;
            if (state.score === QUIZ_DATA.length) {
                mensaje = "¡Excelente! Conoces a fondo la historia del Cerro Viva el Perú. Ayúdanos a compartirla para que más personas la descubran.";
            } else if (state.score >= QUIZ_DATA.length - 2) {
                mensaje = "Muy bien. Ahora conoces una historia que miles de personas pasan cerca sin saber que existe.";
            } else {
                mensaje = "Todavía hay mucho por descubrir. Revisa la línea de tiempo y vuelve a intentarlo: esta historia merece ser conocida.";
            }
            els.resultMessage.textContent = mensaje;
        }

        function restartQuiz() {
            state.current = 0;
            state.score = 0;
            els.quizBody.classList.remove("cvp-quiz-hidden");
            els.resultBody.classList.add("cvp-quiz-hidden");
            renderQuestion();
        }

        els.nextBtn.addEventListener("click", nextQuestion);
        els.restartBtn.addEventListener("click", restartQuiz);

        renderQuestion();
    }

    /* ===================================================================
       4. COMPARADOR "ANTES Y AHORA"
       =================================================================== */
    function initCompareSlider() {
        var compareEls = document.querySelectorAll(".cvp-compare");
        compareEls.forEach(function (compare) {
            var range = compare.querySelector(".cvp-compare-range");
            var beforeWrap = compare.querySelector(".cvp-compare-before-wrap");
            var handle = compare.querySelector(".cvp-compare-handle");
            if (!range || !beforeWrap) return;

            function setWidth(val) {
                beforeWrap.style.width = val + "%";
                if (handle) handle.style.left = val + "%";
                // Tanto la imagen real (.cvp-compare-img) como el bloque
                // de reemplazo temporal (.cvp-compare-placeholder) deben
                // mantener el ancho total del comparador para que el
                // efecto de "revelar" funcione correctamente al deslizar.
                var innerContent = beforeWrap.querySelector(".cvp-compare-img, .cvp-compare-placeholder");
                if (innerContent) {
                    innerContent.style.width = compare.offsetWidth + "px";
                    innerContent.style.maxWidth = "none";
                }
            }

            range.addEventListener("input", function () {
                setWidth(range.value);
            });

            window.addEventListener("resize", function () {
                setWidth(range.value);
            });

            setWidth(range.value || 50);
        });
    }

    /* ===================================================================
       5. MAPA HISTÓRICO INTERACTIVO
       =================================================================== */
    function initHistoricMap() {
        var map = document.querySelector(".cvp-map-wrapper");
        var infoBox = document.querySelector(".cvp-map-info");
        if (!map || !infoBox) return;

        var points = map.querySelectorAll(".cvp-map-point");

        points.forEach(function (point) {
            point.addEventListener("click", function () {
                var title = point.getAttribute("data-title") || "";
                var desc = point.getAttribute("data-desc") || "";

                infoBox.querySelector("h4").textContent = title;
                infoBox.querySelector("p").textContent = desc;
                infoBox.classList.add("is-active");

                points.forEach(function (p) { p.classList.remove("is-selected"); });
                point.classList.add("is-selected");
            });
        });
    }

    /* ===================================================================
       7. PARTÍCULAS SUTILES DE LA SECCIÓN CONMEMORATIVA
       =================================================================== */
    function initMemorialParticles() {
        var container = document.querySelector(".cvp-memorial-particles");
        if (!container) return;

        var totalParticles = 22;
        for (var i = 0; i < totalParticles; i++) {
            var p = document.createElement("span");
            p.className = "cvp-memorial-particle";
            p.style.left = (Math.random() * 100) + "%";
            p.style.animationDuration = (8 + Math.random() * 10) + "s";
            p.style.animationDelay = (Math.random() * 10) + "s";
            p.style.opacity = (0.3 + Math.random() * 0.5).toFixed(2);
            container.appendChild(p);
        }
    }

    /* ===================================================================
       8. ACCIONES DE "LA HISTORIA CONTINÚA CONTIGO"
       =================================================================== */
    function initShareActions() {
        var shareBtn = document.querySelector("[data-cvp-action='compartir']");
        var learnBtn = document.querySelector("[data-cvp-action='aprender']");
        var toast = document.querySelector(".cvp-toast");

        if (shareBtn) {
            shareBtn.addEventListener("click", function () {
                var shareData = {
                    title: "Cerro Viva el Perú",
                    text: "Descubre la historia olvidada del Cerro Viva el Perú y su fosa común en Santiago de Surco.",
                    url: window.location.href
                };

                if (navigator.share) {
                    navigator.share(shareData).catch(function () { /* usuario canceló */ });
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareData.url).then(function () {
                        showToast("Enlace copiado. ¡Compártelo con alguien más!");
                    });
                } else {
                    showToast("Copia el enlace desde la barra de direcciones para compartirlo.");
                }
            });
        }

        if (learnBtn) {
            learnBtn.addEventListener("click", function () {
                var timelineSection = document.getElementById("cvp-linea-tiempo");
                if (timelineSection) {
                    timelineSection.scrollIntoView({ behavior: "smooth" });
                }
            });
        }

        function showToast(message) {
            if (!toast) return;
            toast.textContent = message;
            toast.classList.add("is-active");
            setTimeout(function () {
                toast.classList.remove("is-active");
            }, 3200);
        }
    }

})();