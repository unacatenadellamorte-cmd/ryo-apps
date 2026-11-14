/* 実画面のガイド、拡大表示、操作に結び付くガラスの光と動き。外部送信は行わない。 */
(function () {
  "use strict";
  var media = window.matchMedia("(prefers-reduced-motion: reduce)");
  var manual = false;
  try { manual = sessionStorage.getItem("ide-motion") === "reduce"; } catch (_) { /* 保存不可でも操作できる。 */ }
  var reduced = media.matches || manual;
  var running = new Set();
  var latest = new WeakMap();

  function motion(el, frames, options) {
    var old = latest.get(el);
    if (old) old.cancel();
    if (reduced || !el.animate) return null;
    var animation = el.animate(frames, Object.assign({ duration: 320, easing: "cubic-bezier(.2,.75,.25,1)" }, options));
    latest.set(el, animation);
    running.add(animation);
    function clear() { running.delete(animation); if (latest.get(el) === animation) latest.delete(el); }
    animation.finished.then(clear, clear);
    return animation;
  }
  function after(animation, done) { if (animation) animation.finished.then(done, done); else done(); }

  function updateMotion() {
    reduced = media.matches || manual;
    document.documentElement.classList.toggle("motion-reduced", reduced);
    if (reduced) running.forEach(function (a) { a.cancel(); });
    document.querySelectorAll("[data-motion-toggle]").forEach(function (button) {
      button.hidden = false;
      button.disabled = media.matches;
      button.setAttribute("aria-pressed", String(reduced));
      button.textContent = media.matches ? "端末の設定で動きを抑えています" : "動きを控えめに";
    });
  }

  function setupGuide(root) {
    var tabs = Array.from(root.querySelectorAll("[data-guide-tab]"));
    var panels = Array.from(root.querySelectorAll("[data-guide-panel]"));
    var nav = root.querySelector(".guide-nav");
    var controls = root.querySelector("[data-guide-controls]");
    var previous = root.querySelector("[data-guide-prev]");
    var next = root.querySelector("[data-guide-next]");
    var status = root.querySelector("[data-guide-status]");
    if (!tabs.length || tabs.length !== panels.length) return;
    var selected = Math.max(0, panels.findIndex(function (p) { return "#" + p.id === location.hash; }));
    nav.setAttribute("role", "tablist");
    tabs.forEach(function (tab, i) {
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panels[i].id);
      panels[i].setAttribute("role", "tabpanel");
      panels[i].setAttribute("aria-labelledby", tab.id);
      panels[i].setAttribute("tabindex", "0");
      tab.addEventListener("click", function (event) { event.preventDefault(); select(i, false); });
      tab.addEventListener("keydown", function (event) {
        var index = i;
        if (event.key === "ArrowRight") index = (i + 1) % tabs.length;
        else if (event.key === "ArrowLeft") index = (i - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") index = 0;
        else if (event.key === "End") index = tabs.length - 1;
        else if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault(); select(index, true);
      });
    });
    function indicator() {
      var box = tabs[selected].getBoundingClientRect();
      var parent = nav.getBoundingClientRect();
      nav.style.setProperty("--tab-x", box.left - parent.left + nav.scrollLeft + "px");
      nav.style.setProperty("--tab-y", box.top - parent.top + nav.scrollTop + "px");
      nav.style.setProperty("--tab-w", box.width + "px");
      nav.style.setProperty("--tab-h", box.height + "px");
    }
    function select(index, focus) {
      var direction = index >= selected ? 1 : -1;
      var changed = selected !== index;
      selected = index;
      tabs.forEach(function (tab, i) {
        tab.setAttribute("aria-selected", String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        panels[i].hidden = i !== index;
      });
      previous.disabled = index === 0;
      next.disabled = index === panels.length - 1;
      status.textContent = (index + 1) + " / " + panels.length + "　" + panels[index].dataset.guideTitle;
      indicator();
      if (changed) motion(panels[index], [{ opacity: .35, transform: "translateX(" + direction * 14 + "px)" }, { opacity: 1, transform: "translateX(0)" }]);
      if (focus) tabs[index].focus({ preventScroll: true });
    }
    previous.addEventListener("click", function () { select(Math.max(0, selected - 1), false); });
    next.addEventListener("click", function () { select(Math.min(panels.length - 1, selected + 1), false); });
    controls.hidden = false;
    select(selected, false);
    root.classList.add("is-enhanced");
    if (window.ResizeObserver) new ResizeObserver(indicator).observe(nav);
    else window.addEventListener("resize", indicator);
    window.addEventListener("hashchange", function () {
      var index = panels.findIndex(function (p) { return "#" + p.id === location.hash; });
      if (index >= 0) select(index, false);
    });
  }

  function setupViewer() {
    var dialog = document.querySelector("[data-viewer]");
    var links = Array.from(document.querySelectorAll(".shot-open"));
    if (!dialog || !dialog.showModal || !links.length) return;
    var surface = dialog.querySelector(".viewer-surface");
    var image = dialog.querySelector("[data-viewer-image]");
    var mediaBox = dialog.querySelector("[data-viewer-media]");
    var caption = dialog.querySelector("[data-viewer-caption]");
    var count = dialog.querySelector("[data-viewer-count]");
    var state = dialog.querySelector("[data-viewer-state]");
    var previous = dialog.querySelector("[data-viewer-prev]");
    var next = dialog.querySelector("[data-viewer-next]");
    var zoom = dialog.querySelector("[data-viewer-zoom]");
    var original = dialog.querySelector("[data-viewer-original]");
    var selected = 0, opener = null, closing = false;
    count.setAttribute("aria-live", "polite");
    function show(index) {
      selected = index;
      var source = links[index].closest("figure").querySelector("img");
      image.width = Number(source.getAttribute("width")) || 640;
      image.height = Number(source.getAttribute("height")) || 1391;
      image.alt = source.alt;
      image.src = links[index].href;
      original.href = links[index].href;
      caption.textContent = source.alt;
      count.textContent = (index + 1) + " / " + links.length;
      state.textContent = image.complete && image.naturalWidth ? "" : "読み込み中…";
      previous.disabled = index === 0;
      next.disabled = index === links.length - 1;
      mediaBox.classList.remove("is-zoomed");
      mediaBox.scrollTop = mediaBox.scrollLeft = 0;
      zoom.setAttribute("aria-pressed", "false"); zoom.textContent = "拡大する";
      motion(image, [{ opacity: .4, transform: "scale(.97)" }, { opacity: 1, transform: "scale(1)" }]);
    }
    image.addEventListener("load", function () { state.textContent = ""; });
    image.addEventListener("error", function () { state.textContent = "画像を表示できませんでした。「元の画像を開く」もお試しください。"; });
    links.forEach(function (link, i) {
      link.addEventListener("click", function (event) {
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); opener = link; closing = false;
        show(i); dialog.showModal(); document.documentElement.classList.add("viewer-open");
        motion(surface, [{ opacity: 0, transform: "translateY(16px) scale(.98)" }, { opacity: 1, transform: "translateY(0) scale(1)" }]);
      });
    });
    function close() {
      if (closing || !dialog.open) return;
      closing = true;
      after(motion(surface, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.98)" }], { duration: 180 }), function () { dialog.close(); });
    }
    dialog.querySelector("[data-viewer-close]").addEventListener("click", close);
    dialog.addEventListener("cancel", function (event) { event.preventDefault(); close(); });
    dialog.addEventListener("click", function (event) { if (event.target === dialog) close(); });
    dialog.addEventListener("close", function () {
      document.documentElement.classList.remove("viewer-open"); closing = false;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    });
    previous.addEventListener("click", function () { if (selected > 0) show(selected - 1); });
    next.addEventListener("click", function () { if (selected + 1 < links.length) show(selected + 1); });
    zoom.addEventListener("click", function () {
      var on = mediaBox.classList.toggle("is-zoomed");
      zoom.setAttribute("aria-pressed", String(on)); zoom.textContent = on ? "全体を表示" : "拡大する";
    });
    dialog.addEventListener("keydown", function (event) {
      // iframe内でも拡大表示の外へTabが抜けないよう、端の移動を明示する。
      if (event.key === "Tab") {
        var focusable = Array.from(dialog.querySelectorAll("button:not([disabled]),a[href]")).filter(function (el) { return el.getClientRects().length > 0; });
        var index = focusable.indexOf(document.activeElement);
        if (!focusable.length) return;
        // リンクをTabの対象にしないブラウザー設定でも、同じ順序で巡回させる。
        event.preventDefault();
        var destination = index < 0 ? (event.shiftKey ? focusable.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
        focusable[destination].focus();
        return;
      }
      if (event.key === "ArrowLeft" && selected > 0) { event.preventDefault(); show(selected - 1); }
      if (event.key === "ArrowRight" && selected + 1 < links.length) { event.preventDefault(); show(selected + 1); }
    });
  }

  function setupFaq() {
    document.querySelectorAll(".faq-item").forEach(function (details) {
      var body = details.querySelector(".faq-a");
      var summary = details.querySelector("summary");
      var desired = details.open, token = 0;
      summary.addEventListener("click", function (event) {
        if (reduced || !body.animate) return;
        event.preventDefault();
        var old = latest.get(body);
        var height = details.open ? body.getBoundingClientRect().height : 0;
        desired = old ? !desired : !details.open;
        var current = ++token;
        if (old) old.cancel();
        details.open = true;
        var target = desired ? body.scrollHeight : 0;
        body.style.overflow = "hidden";
        var animation = motion(body, [{ height: height + "px", opacity: height ? 1 : 0 }, { height: target + "px", opacity: desired ? 1 : 0 }], { duration: 240 });
        after(animation, function () {
          if (current !== token) return;
          details.open = desired; body.style.overflow = "";
        });
      });
    });
  }

  function setupGlass() {
    var panes = document.querySelectorAll(".app-card,.hero-shot,.story-media,.guide-stage,.step,.scene,.feature,.cta");
    panes.forEach(function (pane) {
      pane.classList.add("glass-reactive");
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      var frame = 0, point = null;
      pane.addEventListener("pointermove", function (event) {
        if (reduced) return;
        point = { x: event.clientX, y: event.clientY };
        if (frame) return;
        frame = requestAnimationFrame(function () {
          frame = 0; if (!point) return;
          var box = pane.getBoundingClientRect();
          pane.style.setProperty("--light-x", point.x - box.left + "px");
          pane.style.setProperty("--light-y", point.y - box.top + "px");
        });
      }, { passive: true });
      pane.addEventListener("pointerleave", function () {
        point = null; pane.style.removeProperty("--light-x"); pane.style.removeProperty("--light-y");
      });
    });
    document.querySelectorAll(".btn").forEach(function (button) {
      button.addEventListener("click", function () { motion(button, [{ transform: "scale(1)" }, { transform: "scale(.96)", offset: .35 }, { transform: "scale(1)" }], { duration: 260 }); });
    });
  }

  function setupReading() {
    var header = document.querySelector(".site-header");
    var bar = document.querySelector("[data-reading-progress]");
    var links = Array.from(document.querySelectorAll(".toc-list a"));
    var sections = links.map(function (link) { return document.getElementById(link.hash.slice(1)); });
    var queued = false;
    function update() {
      queued = false;
      var range = document.documentElement.scrollHeight - window.innerHeight;
      var fraction = range > 0 ? Math.max(0, Math.min(1, window.scrollY / range)) : 0;
      var selected = -1;
      sections.forEach(function (section, i) { if (section && section.getBoundingClientRect().top <= window.innerHeight * .4) selected = i; });
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 16);
      if (bar) bar.style.transform = "scaleX(" + fraction + ")";
      links.forEach(function (link, i) { if (i === selected) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current"); });
    }
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
  }

  function init() {
    updateMotion();
    document.querySelectorAll("[data-motion-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        manual = !manual;
        try { sessionStorage.setItem("ide-motion", manual ? "reduce" : "full"); } catch (_) { /* 保存不可ならこのページだけで適用。 */ }
        updateMotion();
      });
    });
    if (media.addEventListener) media.addEventListener("change", updateMotion);
    document.querySelectorAll("[data-screen-guide]").forEach(setupGuide);
    setupViewer(); setupFaq(); setupGlass(); setupReading();
    if (!location.hash) {
      var title = document.querySelector(".hero-text,.app-hero-text");
      if (title) motion(title, [{ opacity: .3, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 550 });
      document.querySelectorAll(".hero-shot").forEach(function (pane, i) {
        motion(pane, [{ opacity: .3, transform: "translateY(18px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 600, delay: 60 + i * 55 });
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
