(function () {
  function showToast() {
    try {
      const toast = document.createElement("div");
      toast.textContent = "Snap for Firefox — spoofing Chrome";
      Object.assign(toast.style, {
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: "2147483647",
        background: "#121214",
        color: "#fffc00",
        font: "600 12.5px -apple-system, \"Segoe UI\", Roboto, sans-serif",
        padding: "10px 14px",
        borderRadius: "9px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,252,0,0.25)",
        opacity: "0",
        transform: "translateY(-6px)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        pointerEvents: "none"
      });
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
      });
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-6px)";
        setTimeout(() => toast.remove(), 250);
      }, 2600);
      console.log("[SFF] toast.js shown");
    } catch (e) {
      console.error("[SFF] toast.js failed", e);
    }
  }
  if (document.body) showToast();
  else document.addEventListener("DOMContentLoaded", showToast, { once: true });
})();
