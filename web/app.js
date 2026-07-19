const toast = document.getElementById("toast");

document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const value = btn.getAttribute("data-copy") || "";
    try {
      await navigator.clipboard.writeText(value);
      if (toast) {
        toast.hidden = false;
        toast.textContent = "Copied";
        clearTimeout(toast._t);
        toast._t = setTimeout(() => {
          toast.hidden = true;
        }, 1600);
      }
    } catch {
      // ignore
    }
  });
});
