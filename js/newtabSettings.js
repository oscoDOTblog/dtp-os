export function initNewtabSettings({
  sections,
  toggleButton,
  modal,
  listView,
  panelView,
  listContainer,
  panelTitle,
  panelContent,
  closeButton,
  backdrop,
}) {
  let activeCleanup = null;

  function runCleanup() {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  }

  function showListView() {
    runCleanup();
    panelView.hidden = true;
    listView.hidden = false;
  }

  function showPanel(sectionId) {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) {
      return;
    }

    runCleanup();
    listView.hidden = true;
    panelView.hidden = false;
    panelTitle.textContent = section.label;
    panelContent.replaceChildren();

    activeCleanup = section.mount(panelContent, { showListView }) ?? null;
  }

  function renderSectionList() {
    listContainer.replaceChildren();

    for (const section of sections) {
      const item = document.createElement("li");
      item.className = "settings-list-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "settings-list-button";

      const label = document.createElement("span");
      label.className = "settings-list-label";
      label.textContent = section.label;

      const description = document.createElement("span");
      description.className = "settings-list-description";
      description.textContent = section.description;

      button.append(label, description);
      button.addEventListener("click", () => {
        showPanel(section.id);
      });

      item.appendChild(button);
      listContainer.appendChild(item);
    }
  }

  function openModal() {
    modal.hidden = false;
    toggleButton.setAttribute("aria-expanded", "true");
    showListView();
  }

  function closeModal() {
    modal.hidden = true;
    toggleButton.setAttribute("aria-expanded", "false");
    showListView();
  }

  toggleButton.addEventListener("click", () => {
    if (modal.hidden) {
      openModal();
    } else {
      closeModal();
    }
  });

  closeButton.addEventListener("click", closeModal);

  backdrop.addEventListener("click", closeModal);

  document.getElementById("settingsBackBtn")?.addEventListener("click", showListView);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      if (!panelView.hidden) {
        showListView();
      } else {
        closeModal();
      }
    }
  });

  renderSectionList();

  return {
    openModal,
    closeModal,
    showListView,
  };
}
