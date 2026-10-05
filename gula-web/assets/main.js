/* Gula Restaurant: interacción de la web (sin dependencias). */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dataEl = $("#gula-data");
  const DATA = dataEl ? JSON.parse(dataEl.textContent) : {};

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  // ---------------------------------------------------------------- intro: retirar del DOM al acabar
  const intro = $("[data-intro]");
  if (intro) {
    const done = () => intro.remove();
    if (document.documentElement.classList.contains("no-intro")) done();
    else intro.addEventListener("animationend", (e) => e.target === intro && done());
  }

  // ---------------------------------------------------------------- día y hora en Cadaqués
  const madridDay = () => {
    const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Madrid" }).format(new Date());
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  };
  const today = madridDay();

  // Horario de hoy en la portada
  const todayEl = $("[data-today-hours]");
  if (todayEl && DATA.week) {
    const services = DATA.week[today] || [];
    todayEl.textContent = services.length
      ? `${DATA.hero.today}: ${services
          .map((s) => `${DATA.wa[s].toLowerCase()} ${DATA.services[s].from}-${DATA.services[s].to}`)
          .join(", ")}`
      : DATA.hero.closedToday;
  }

  // Tabla de horarios: marcar hoy
  $$("[data-hours] [data-days]").forEach((row) => {
    if (row.dataset.days.split(",").map(Number).includes(today)) row.classList.add("is-today");
  });

  // ---------------------------------------------------------------- header: sólido fuera del hero y oculto al bajar
  const header = $("[data-header]");
  const hero = $("[data-hero]");
  const drawer = $("[data-drawer]");
  if (header) {
    if (hero) {
      new IntersectionObserver(([entry]) => header.classList.toggle("is-solid", !entry.isIntersecting), {
        rootMargin: `-${header.offsetHeight}px 0px 0px 0px`,
      }).observe(hero);
    } else {
      header.classList.add("is-solid");
    }

    let lastY = scrollY;
    let ticking = false;
    const setHidden = (hide) => {
      header.classList.toggle("is-hidden", hide);
      document.body.classList.toggle("header-hidden", hide);
    };
    addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = scrollY;
          if (Math.abs(y - lastY) > 6) {
            setHidden(y > lastY && y > header.offsetHeight * 2 && !(drawer && drawer.open));
            lastY = y;
          }
          ticking = false;
        });
      },
      { passive: true }
    );
    header.addEventListener("focusin", () => setHidden(false));
  }

  // ---------------------------------------------------------------- lámpara: se apaga lentamente al bajar y se enciende al subir
  if (hero) {
    let target = 1;
    let level = 1;
    let raf = 0;
    const step = () => {
      level += (target - level) * 0.07;
      if (Math.abs(target - level) < 0.003) level = target;
      hero.style.setProperty("--lamp", level.toFixed(3));
      raf = level === target ? 0 : requestAnimationFrame(step);
    };
    const update = () => {
      target = 1 - Math.min(1, Math.max(0, scrollY / (hero.offsetHeight * 0.8)));
      if (!raf) raf = requestAnimationFrame(step);
    };
    addEventListener("scroll", update, { passive: true });
    update();
  }

  // ---------------------------------------------------------------- drawer
  const opener = $("[data-nav-open]");
  if (drawer && opener && typeof drawer.showModal === "function") {
    const CLOSE_MS = reduceMotion ? 0 : 450;
    let closing = null;

    const open = () => {
      drawer.showModal();
      opener.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add("is-open")));
    };
    const close = () =>
      new Promise((resolve) => {
        if (!drawer.open) return resolve();
        if (closing) return closing.then(resolve);
        drawer.classList.remove("is-open");
        opener.setAttribute("aria-expanded", "false");
        closing = new Promise((done) =>
          setTimeout(() => {
            drawer.close();
            closing = null;
            done();
          }, CLOSE_MS)
        );
        closing.then(resolve);
      });

    opener.addEventListener("click", open);
    $$("[data-nav-close]", drawer).forEach((b) => b.addEventListener("click", close));
    $("[data-nav-close-area]", drawer)?.addEventListener("click", close);
    drawer.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });

    // Enlaces internos: cerrar primero y después desplazarse a la sección.
    $$("[data-nav-link]", drawer).forEach((link) =>
      link.addEventListener("click", (e) => {
        if (link.target === "_blank") return void close();
        const url = new URL(link.href, location.href);
        const samePage = url.pathname === location.pathname && url.hash;
        if (!samePage) return;
        e.preventDefault();
        close().then(() => {
          const target = document.getElementById(url.hash.slice(1));
          target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
          history.pushState(null, "", url.hash);
        });
      })
    );

    // Vista previa de la sección al pasar por cada opción del menú.
    const shots = $$("[data-shot]", drawer);
    $$("[data-preview]", drawer).forEach((link) => {
      const activate = () => {
        shots.forEach((s) => s.classList.toggle("is-active", s.dataset.shot === link.dataset.preview));
        $$("[data-preview]", drawer).forEach((l) => l.classList.toggle("is-hot", l === link));
      };
      link.addEventListener("mouseenter", activate);
      link.addEventListener("focus", activate);
    });
  }

  // ---------------------------------------------------------------- titular: letras que se iluminan bajo el cursor
  const glowEl = $("[data-glow]");
  if (glowEl && matchMedia("(hover: hover)").matches) {
    const lines = $$("[data-glow-line]", glowEl);
    const measure = () => lines.forEach((l) => l.style.setProperty("--oy", `${l.offsetTop}px`));
    measure();
    addEventListener("resize", measure);
    document.fonts?.ready.then(measure);

    let frame = 0;
    let sweeping = false;
    const setPos = (x, y) => {
      glowEl.style.setProperty("--gx", `${x}px`);
      glowEl.style.setProperty("--gy", `${y}px`);
    };
    glowEl.addEventListener("pointermove", (e) => {
      if (sweeping) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = glowEl.getBoundingClientRect();
        setPos(e.clientX - r.left, e.clientY - r.top);
      });
    });
    glowEl.addEventListener("pointerenter", () => glowEl.classList.add("is-lit"));
    glowEl.addEventListener("pointerleave", () => !sweeping && glowEl.classList.remove("is-lit"));

    // Barrido de luz una vez, cuando la lámpara se enciende, para descubrir el efecto
    // (es un cambio de luz, no desplaza nada: se mantiene también con "reducir movimiento")
    {
      const delay = document.documentElement.classList.contains("no-intro") ? 600 : 2600;
      setTimeout(() => {
        const r = glowEl.getBoundingClientRect();
        const first = lines[0];
        const last = lines[lines.length - 1];
        const y = first && last ? (first.offsetTop + last.offsetTop + last.offsetHeight) / 2 : r.height / 2;
        const start = performance.now();
        const dur = 1700;
        sweeping = true;
        glowEl.style.setProperty("--glow-r", "220px");
        glowEl.classList.add("is-lit");
        const step = (now) => {
          const k = Math.min(1, (now - start) / dur);
          const ease = 1 - Math.pow(1 - k, 3);
          setPos(-150 + ease * (r.width + 300), y);
          if (k < 1) requestAnimationFrame(step);
          else {
            sweeping = false;
            glowEl.style.removeProperty("--glow-r");
            if (!glowEl.matches(":hover")) glowEl.classList.remove("is-lit");
          }
        };
        requestAnimationFrame(step);
      }, delay);
    }
  }

  // ---------------------------------------------------------------- CUINA fija: activar fondo cuando la foto ya ha pasado
  const cuinaSticky = $("[data-cuina-sticky]");
  const cuinaBand = $("[data-cuina-band]");
  if (cuinaSticky && cuinaBand) {
    let io;
    const watch = () => {
      io?.disconnect();
      // margen = palabra + cabecera: el fondo puede aparecer un poco antes, cuando la foto ya es negra abajo
      const h = Math.round(cuinaSticky.offsetHeight + (header ? header.offsetHeight : 0));
      io = new IntersectionObserver(
        ([e]) => cuinaSticky.classList.toggle("is-stuck", !e.isIntersecting && e.boundingClientRect.top < 0),
        { rootMargin: `-${h}px 0px 0px 0px` }
      );
      io.observe(cuinaBand);
    };
    watch();
    let t;
    addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(watch, 200);
    });
  }

  // ---------------------------------------------------------------- reveal on scroll
  const revealEls = $$("[data-reveal], [data-fx]");
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-in"));
    } else {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }),
        { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
      );
      revealEls.forEach((el) => io.observe(el));
    }
  }

  // ---------------------------------------------------------------- restoo iframe (carga diferida)
  const restoo = $("[data-restoo]");
  const loadRestoo = () => {
    const frame = restoo && $("iframe", restoo);
    if (!frame || frame.src) return;
    frame.addEventListener("load", () => restoo.classList.add("is-loaded"), { once: true });
    frame.src = frame.dataset.src;
  };
  const reserva = $("[data-reserva]");
  if (reserva && restoo) {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (!$("#panel-online").hidden) loadRestoo();
        io.disconnect();
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(reserva);
  }

  // ---------------------------------------------------------------- tabs
  $$("[data-tabs]").forEach((tabs) => {
    const list = $$('[role="tab"]', tabs);
    const select = (tab, focus = true) => {
      list.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
      if (tab.id === "tab-online") loadRestoo();
    };
    list.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (e) => {
        const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        select(list[(map[e.key] + list.length) % list.length]);
      });
    });
  });

  // ---------------------------------------------------------------- formulario WhatsApp
  const form = $("[data-wa-form]");
  if (form && DATA.wa) {
    const T = DATA.wa;
    const name = form.elements.name;
    const date = form.elements.date;
    const time = form.elements.time;
    const people = form.elements.people;
    const notes = form.elements.notes;
    const status = $(".wa-form__status", form);

    const pad = (n) => String(n).padStart(2, "0");
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parseYmd = (v) => {
      const [y, m, d] = v.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    const toMin = (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    const fromMin = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

    const now = new Date();
    date.min = ymd(now);
    const max = new Date(now);
    max.setMonth(max.getMonth() + 6);
    date.max = ymd(max);

    const setError = (input, msg) => {
      const err = document.getElementById(input.getAttribute("aria-describedby"));
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) {
        err.textContent = msg || "";
        err.hidden = !msg;
      }
      return !msg;
    };

    const slotsFor = (d) => {
      const services = DATA.week[d.getDay()] || [];
      const isToday = ymd(d) === ymd(new Date());
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes() + 30;
      return services
        .map((svc) => {
          const { from, to } = DATA.services[svc];
          const out = [];
          for (let m = toMin(from); m <= toMin(to); m += DATA.slotMinutes) out.push(m);
          if (out[out.length - 1] !== toMin(to)) out.push(toMin(to));
          return { svc, times: out.filter((m) => !isToday || m >= nowMin).map(fromMin) };
        })
        .filter((g) => g.times.length);
    };

    const dateProblem = () => {
      if (!date.value) return T.errDate;
      if (date.value < ymd(new Date())) return T.errPast;
      const d = parseYmd(date.value);
      if (!(DATA.week[d.getDay()] || []).length) return T.errMonday;
      if (!slotsFor(d).length) return T.errNoSlots;
      return "";
    };

    // Rellena las horas según el día elegido (comida y/o cena).
    const fillTimes = () => {
      time.innerHTML = "";
      time.disabled = true;
      const problem = dateProblem();
      time.add(new Option(problem ? T.timePick : T.timeChoose, ""));
      setError(date, problem);
      setError(time, "");
      if (problem) return;
      slotsFor(parseYmd(date.value)).forEach(({ svc, times }) => {
        const og = document.createElement("optgroup");
        og.label = T[svc];
        times.forEach((tm) => og.append(new Option(tm, tm)));
        time.append(og);
      });
      time.disabled = false;
    };

    date.addEventListener("change", fillTimes);
    name.addEventListener("input", () => name.value.trim() && setError(name, ""));
    time.addEventListener("change", () => time.value && setError(time, ""));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      status.textContent = "";
      const okName = setError(name, name.value.trim() ? "" : T.errName);
      const okDate = setError(date, dateProblem());
      const okTime = okDate ? setError(time, time.value ? "" : T.errTime) : false;
      if (!(okName && okDate && okTime)) {
        form.querySelector('[aria-invalid="true"]')?.focus();
        return;
      }
      const dateLabel = new Intl.DateTimeFormat(DATA.lang, { weekday: "long", day: "numeric", month: "long" }).format(
        parseYmd(date.value)
      );
      const lines = [
        T.msgHello,
        "",
        `${T.msgName}: ${name.value.trim()}`,
        `${T.msgDate}: ${dateLabel}`,
        `${T.msgTime}: ${time.value}`,
        `${T.msgPeople}: ${people.options[people.selectedIndex].text}`,
      ];
      if (notes.value.trim()) lines.push(`${T.msgNotes}: ${notes.value.trim()}`);
      const url = `https://wa.me/${DATA.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
      window.open(url, "_blank", "noopener");
      status.textContent = T.sent;
    });
  }

  // ---------------------------------------------------------------- botón flotante de WhatsApp
  const fab = $("[data-fab]");
  if (fab) {
    const state = { hero: !!hero, reserva: false };
    const sync = () => fab.classList.toggle("is-visible", !state.hero && !state.reserva);
    if (hero)
      new IntersectionObserver(([e]) => {
        state.hero = e.isIntersecting;
        sync();
      }, { threshold: 0.35 }).observe(hero);
    if (reserva)
      new IntersectionObserver(([e]) => {
        state.reserva = e.isIntersecting;
        sync();
      }).observe(reserva);
    sync();
  }

})();
