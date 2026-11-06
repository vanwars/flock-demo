// Pop-up windows. Any button with data-modal="name" opens content/name.html in the pop-up.
import { render } from "./template.js";

const modal = document.getElementById("modal");
const body = document.getElementById("modal-body");

document.addEventListener("click", async (e) => {
  const opener = e.target.closest("[data-modal]");
  if (opener) {
    body.innerHTML = await render(opener.dataset.modal);
    modal.setAttribute("aria-label", opener.textContent.trim());
    modal.showModal();
  } else if (e.target === modal || e.target.closest("[data-close-modal]")) {
    modal.close(); // clicking the dark backdrop or the \u00d7 closes it
  }
});
