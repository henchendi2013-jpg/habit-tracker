"use strict";

const STORAGE_KEY = "habit-tracker:v1";
const EXPORT_APP = "habit-checkin";
const EXPORT_VERSION = 1;
const DEFAULT_EMOJI = "🎯";

const COLORS = ["#5F8A6B", "#4F8FCB", "#E28A61", "#D9A43B", "#8B74C9", "#D66A7A"];
const COLOR_NAMES = ["鼠尾草绿", "湖水蓝", "珊瑚橙", "琥珀黄", "鸢尾紫", "莓果红"];
const EMOJI_PRESETS = ["🎯", "💧", "🏃", "📚", "😴", "🌅", "🧘", "🍎", "✍️", "🌿"];

const HABIT_TEMPLATES = [
  { name: "喝水", emoji: "💧", color: "#4F8FCB" },
  { name: "运动", emoji: "🏃", color: "#E28A61" },
  { name: "读书", emoji: "📚", color: "#5F8A6B" },
  { name: "早睡", emoji: "😴", color: "#8B74C9" },
  { name: "早起", emoji: "🌅", color: "#D9A43B" },
  { name: "冥想", emoji: "🧘", color: "#5F8A6B" },
  { name: "学英语", emoji: "🔤", color: "#D66A7A" },
  { name: "散步", emoji: "🌿", color: "#4F8FCB" },
];

const elements = {
  currentDate: document.getElementById("currentDate"),
  todayCount: document.getElementById("todayCount"),
  editModeButton: document.getElementById("editModeButton"),
  addHabitButton: document.getElementById("addHabitButton"),
  storageNotice: document.getElementById("storageNotice"),
  habitList: document.getElementById("habitList"),
  emptyState: document.getElementById("emptyState"),
  emptyAddButton: document.getElementById("emptyAddButton"),
  exportButton: document.getElementById("exportButton"),
  importButton: document.getElementById("importButton"),
  importInput: document.getElementById("importInput"),
  toast: document.getElementById("toast"),
  onboardingDialog: document.getElementById("onboardingDialog"),
  onboardingTemplates: document.getElementById("onboardingTemplates"),
  onboardingError: document.getElementById("onboardingError"),
  skipOnboardingButton: document.getElementById("skipOnboardingButton"),
  addOnboardingButton: document.getElementById("addOnboardingButton"),
  habitDialog: document.getElementById("habitDialog"),
  habitDialogKicker: document.getElementById("habitDialogKicker"),
  habitDialogTitle: document.getElementById("habitDialogTitle"),
  closeHabitDialogButton: document.getElementById("closeHabitDialogButton"),
  habitTabs: document.getElementById("habitTabs"),
  customHabitTab: document.getElementById("customHabitTab"),
  templateHabitTab: document.getElementById("templateHabitTab"),
  habitForm: document.getElementById("habitForm"),
  customHabitPanel: document.getElementById("customHabitPanel"),
  habitName: document.getElementById("habitName"),
  habitEmoji: document.getElementById("habitEmoji"),
  emojiPresets: document.getElementById("emojiPresets"),
  colorPicker: document.getElementById("colorPicker"),
  templateHabitPanel: document.getElementById("templateHabitPanel"),
  habitTemplates: document.getElementById("habitTemplates"),
  habitFormError: document.getElementById("habitFormError"),
  templateFormError: document.getElementById("templateFormError"),
  habitFormActions: document.getElementById("habitFormActions"),
  cancelHabitButton: document.getElementById("cancelHabitButton"),
  saveHabitButton: document.getElementById("saveHabitButton"),
  templateActions: document.getElementById("templateActions"),
  cancelTemplateButton: document.getElementById("cancelTemplateButton"),
  addSelectedTemplatesButton: document.getElementById("addSelectedTemplatesButton"),
  confirmDialog: document.getElementById("confirmDialog"),
  confirmDialogTitle: document.getElementById("confirmDialogTitle"),
  confirmDialogMessage: document.getElementById("confirmDialogMessage"),
  cancelConfirmButton: document.getElementById("cancelConfirmButton"),
  confirmActionButton: document.getElementById("confirmActionButton"),
};

let storageEnabled = probeStorage();
let loadWarning = "";
let state = loadState();
let todayKey = getLocalDateKey();
let isEditMode = false;
let editingHabitId = null;
let activeDialogTab = "custom";
let selectedOnboardingTemplates = new Set();
let selectedHabitTemplates = new Set();
let confirmAction = null;
let toastTimer = null;
let midnightTimer = null;

init();

function init() {
  renderEmojiPresets();
  renderColorPicker(COLORS[0]);
  bindEvents();
  renderApp();
  scheduleDateRefresh();

  if (!storageEnabled) {
    showStorageNotice("当前浏览器禁止本地保存，本次操作只在当前页面有效。建议通过本地服务器打开并使用现代浏览器。");
  } else if (loadWarning) {
    showStorageNotice(loadWarning);
  }

  if (!state.onboardingComplete) {
    window.requestAnimationFrame(showOnboarding);
  }
}

function bindEvents() {
  elements.addHabitButton.addEventListener("click", () => openHabitDialog());
  elements.emptyAddButton.addEventListener("click", () => openHabitDialog());
  elements.editModeButton.addEventListener("click", toggleEditMode);

  elements.habitList.addEventListener("click", handleHabitListClick);
  elements.habitForm.addEventListener("submit", handleHabitFormSubmit);
  elements.habitTabs.addEventListener("click", handleTabClick);
  elements.cancelHabitButton.addEventListener("click", closeHabitDialog);
  elements.cancelTemplateButton.addEventListener("click", closeHabitDialog);
  elements.closeHabitDialogButton.addEventListener("click", closeHabitDialog);
  elements.addSelectedTemplatesButton.addEventListener("click", addSelectedTemplates);
  elements.habitEmoji.addEventListener("input", () => hideError(elements.habitFormError));

  elements.skipOnboardingButton.addEventListener("click", () => finishOnboarding(false));
  elements.addOnboardingButton.addEventListener("click", () => finishOnboarding(true));
  elements.onboardingDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finishOnboarding(false);
  });

  elements.exportButton.addEventListener("click", exportBackup);
  elements.importButton.addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", importBackup);

  elements.cancelConfirmButton.addEventListener("click", closeConfirmDialog);
  elements.confirmActionButton.addEventListener("click", confirmPendingAction);
  elements.confirmDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeConfirmDialog();
  });

  window.addEventListener("focus", handleDateCheck);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      handleDateCheck();
    }
  });
}

function renderApp() {
  const now = new Date();
  const currentKey = getLocalDateKey(now);
  if (currentKey !== todayKey) {
    todayKey = currentKey;
  }

  if (state.habits.length === 0 && isEditMode) {
    isEditMode = false;
  }

  const completedCount = state.habits.filter((habit) => habit.completedDate === todayKey).length;
  elements.currentDate.textContent = formatDateLabel(now);
  elements.todayCount.textContent = `今日完成 ${completedCount} 项`;
  elements.editModeButton.disabled = state.habits.length === 0;
  elements.editModeButton.setAttribute("aria-pressed", String(isEditMode));
  elements.editModeButton.textContent = isEditMode ? "完成管理" : "管理习惯";
  document.body.classList.toggle("is-edit-mode", isEditMode);
  elements.emptyState.hidden = state.habits.length !== 0;
  elements.habitList.hidden = state.habits.length === 0;

  renderHabits();
}

function renderHabits() {
  const fragment = document.createDocumentFragment();

  state.habits.forEach((habit, index) => {
    const completed = habit.completedDate === todayKey;
    const card = document.createElement("article");
    card.className = `habit-card${completed ? " is-complete" : ""}`;
    card.dataset.id = habit.id;
    card.style.setProperty("--habit-color", habit.color);

    const toggle = document.createElement("button");
    toggle.className = "habit-toggle";
    toggle.type = "button";
    toggle.dataset.action = "toggle";
    toggle.disabled = isEditMode;
    toggle.setAttribute("aria-pressed", String(completed));
    toggle.setAttribute(
      "aria-label",
      `${habit.name}，${completed ? "今天已完成，点击取消" : "今天未完成，点击打卡"}`,
    );

    const icon = document.createElement("span");
    icon.className = "habit-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = habit.emoji;

    const content = document.createElement("span");
    content.className = "habit-content";

    const name = document.createElement("span");
    name.className = "habit-name";
    name.textContent = habit.name;

    const status = document.createElement("span");
    status.className = "habit-status";
    status.textContent = completed ? "今天已完成" : "点击完成";

    content.append(name, status);

    const check = document.createElement("span");
    check.className = "habit-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";

    toggle.append(icon, content, check);
    card.append(toggle);

    if (isEditMode) {
      const actions = document.createElement("div");
      actions.className = "habit-edit-actions";
      actions.append(
        createHabitActionButton("move-up", "上移", "↑", index === 0),
        createHabitActionButton("move-down", "下移", "↓", index === state.habits.length - 1),
        createHabitActionButton("edit", "编辑", "✎"),
        createHabitActionButton("delete", "删除", "删除", false, true),
      );
      card.append(actions);
    }

    fragment.append(card);
  });

  elements.habitList.replaceChildren(fragment);
}

function createHabitActionButton(action, label, text, disabled = false, danger = false) {
  const button = document.createElement("button");
  button.className = `icon-button${danger ? " icon-button--danger" : ""}`;
  button.type = "button";
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.disabled = disabled;
  button.textContent = text;
  return button;
}

function handleHabitListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const card = button.closest(".habit-card");
  const habit = card ? findHabitById(card.dataset.id) : null;
  if (!habit) {
    return;
  }

  switch (button.dataset.action) {
    case "toggle":
      toggleHabit(habit.id);
      break;
    case "move-up":
      moveHabit(habit.id, -1);
      break;
    case "move-down":
      moveHabit(habit.id, 1);
      break;
    case "edit":
      openHabitDialog(habit);
      break;
    case "delete":
      requestDeleteHabit(habit);
      break;
    default:
      break;
  }
}

function toggleHabit(habitId) {
  const habit = findHabitById(habitId);
  if (!habit) {
    return;
  }

  habit.completedDate = habit.completedDate === todayKey ? null : todayKey;
  saveState();
  renderApp();
}

function moveHabit(habitId, direction) {
  const currentIndex = state.habits.findIndex((habit) => habit.id === habitId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= state.habits.length) {
    return;
  }

  [state.habits[currentIndex], state.habits[targetIndex]] = [
    state.habits[targetIndex],
    state.habits[currentIndex],
  ];

  saveState();
  renderApp();

  window.requestAnimationFrame(() => {
    const card = findHabitCard(habitId);
    const action = direction < 0 ? "move-up" : "move-down";
    card?.querySelector(`button[data-action="${action}"]:not(:disabled)`)?.focus();
  });
}

function toggleEditMode() {
  if (state.habits.length === 0) {
    return;
  }

  isEditMode = !isEditMode;
  renderApp();
}

function openHabitDialog(habit = null) {
  editingHabitId = habit ? habit.id : null;
  activeDialogTab = "custom";
  selectedHabitTemplates.clear();

  elements.habitDialogKicker.textContent = habit ? "调整内容" : "新习惯";
  elements.habitDialogTitle.textContent = habit ? "编辑习惯" : "添加习惯";
  elements.saveHabitButton.textContent = habit ? "保存修改" : "保存";
  elements.habitTabs.hidden = Boolean(habit);
  elements.habitName.value = habit ? habit.name : "";
  elements.habitEmoji.value = habit ? habit.emoji : DEFAULT_EMOJI;
  hideError(elements.habitFormError);
  hideError(elements.templateFormError);

  renderColorPicker(habit ? habit.color : COLORS[0]);
  renderHabitTemplatePicker();
  switchHabitDialogTab("custom");

  if (!elements.habitDialog.open) {
    elements.habitDialog.showModal();
  }

  window.setTimeout(() => {
    if (activeDialogTab === "custom" && !editingHabitId) {
      elements.habitName.focus();
    }
  }, 0);
}

function closeHabitDialog() {
  if (elements.habitDialog.open) {
    elements.habitDialog.close();
  }
}

function handleTabClick(event) {
  const button = event.target.closest("button[data-tab]");
  if (!button) {
    return;
  }
  switchHabitDialogTab(button.dataset.tab);
}

function switchHabitDialogTab(tab) {
  const nextTab = editingHabitId ? "custom" : tab;
  activeDialogTab = nextTab;
  const isTemplateTab = nextTab === "template";

  elements.customHabitTab.classList.toggle("is-active", !isTemplateTab);
  elements.customHabitTab.setAttribute("aria-selected", String(!isTemplateTab));
  elements.templateHabitTab.classList.toggle("is-active", isTemplateTab);
  elements.templateHabitTab.setAttribute("aria-selected", String(isTemplateTab));
  elements.customHabitPanel.hidden = isTemplateTab;
  elements.templateHabitPanel.hidden = !isTemplateTab;
  elements.habitFormActions.hidden = isTemplateTab;
  elements.templateActions.hidden = !isTemplateTab;

  if (isTemplateTab) {
    renderHabitTemplatePicker();
    updateTemplateButtonState();
    window.setTimeout(() => elements.templateHabitTab.focus(), 0);
  }
}

function handleHabitFormSubmit(event) {
  event.preventDefault();
  hideError(elements.habitFormError);

  const name = elements.habitName.value.trim();
  const nameLength = Array.from(name).length;
  if (!name) {
    showError(elements.habitFormError, "请先填写习惯名称。");
    elements.habitName.focus();
    return;
  }

  if (nameLength > 20) {
    showError(elements.habitFormError, "习惯名称最多 20 个字。");
    elements.habitName.focus();
    return;
  }

  const selectedColor = elements.habitForm.querySelector('input[name="habitColor"]:checked')?.value;
  const color = COLORS.includes(selectedColor) ? selectedColor : COLORS[0];
  const emoji = getFirstGrapheme(elements.habitEmoji.value.trim()) || DEFAULT_EMOJI;

  if (editingHabitId) {
    const habit = findHabitById(editingHabitId);
    if (!habit) {
      closeHabitDialog();
      return;
    }

    habit.name = name;
    habit.emoji = emoji;
    habit.color = color;
    saveState();
    renderApp();
    closeHabitDialog();
    showToast("习惯已更新");
    return;
  }

  state.habits.push({
    id: createId(),
    name,
    emoji,
    color,
    completedDate: null,
  });

  saveState();
  renderApp();
  closeHabitDialog();
  showToast("已添加新习惯");
}

function addSelectedTemplates() {
  const indexes = [...selectedHabitTemplates].sort((a, b) => a - b);
  const existingNames = new Set(state.habits.map((habit) => habit.name));
  const templates = indexes
    .map((index) => HABIT_TEMPLATES[index])
    .filter((template) => template && !existingNames.has(template.name));

  if (templates.length === 0) {
    showError(elements.templateFormError, "请至少选择一个尚未添加的模板。");
    return;
  }

  templates.forEach((template) => state.habits.push(createHabitFromTemplate(template)));
  selectedHabitTemplates.clear();
  saveState();
  renderApp();
  closeHabitDialog();
  showToast(`已添加 ${templates.length} 个习惯`);
}

function showOnboarding() {
  selectedOnboardingTemplates.clear();
  renderTemplatePicker(elements.onboardingTemplates, selectedOnboardingTemplates, {
    onSelectionChange: updateOnboardingButtonState,
  });
  hideError(elements.onboardingError);
  updateOnboardingButtonState();
  if (!elements.onboardingDialog.open) {
    elements.onboardingDialog.showModal();
  }
}

function finishOnboarding(addSelected) {
  hideError(elements.onboardingError);

  if (addSelected && selectedOnboardingTemplates.size === 0) {
    showError(elements.onboardingError, "请至少选择一个习惯，或点击“先不添加”。");
    return;
  }

  if (addSelected) {
    [...selectedOnboardingTemplates]
      .sort((a, b) => a - b)
      .map((index) => HABIT_TEMPLATES[index])
      .filter(Boolean)
      .forEach((template) => state.habits.push(createHabitFromTemplate(template)));
  }

  state.onboardingComplete = true;
  selectedOnboardingTemplates.clear();
  saveState();
  renderApp();

  if (elements.onboardingDialog.open) {
    elements.onboardingDialog.close();
  }

  if (addSelected) {
    showToast("习惯计划已准备好");
  }
}

function updateOnboardingButtonState() {
  elements.addOnboardingButton.disabled = selectedOnboardingTemplates.size === 0;
  if (selectedOnboardingTemplates.size > 0) {
    hideError(elements.onboardingError);
  }
}

function updateTemplateButtonState() {
  elements.addSelectedTemplatesButton.disabled = selectedHabitTemplates.size === 0;
  if (selectedHabitTemplates.size > 0) {
    hideError(elements.templateFormError);
  }
}

function renderEmojiPresets() {
  const fragment = document.createDocumentFragment();
  EMOJI_PRESETS.forEach((emoji) => {
    const button = document.createElement("button");
    button.className = "emoji-option";
    button.type = "button";
    button.textContent = emoji;
    button.setAttribute("aria-label", `选择 ${emoji}`);
    button.addEventListener("click", () => {
      elements.habitEmoji.value = emoji;
      hideError(elements.habitFormError);
    });
    fragment.append(button);
  });
  elements.emojiPresets.replaceChildren(fragment);
}

function renderColorPicker(selectedColor) {
  const fragment = document.createDocumentFragment();
  COLORS.forEach((color, index) => {
    const label = document.createElement("label");
    label.className = "color-option";
    label.title = COLOR_NAMES[index];

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "habitColor";
    input.value = color;
    input.checked = color === selectedColor;
    input.setAttribute("aria-label", COLOR_NAMES[index]);

    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    swatch.style.setProperty("--swatch", color);

    label.append(input, swatch);
    fragment.append(label);
  });
  elements.colorPicker.replaceChildren(fragment);
}

function renderHabitTemplatePicker() {
  const existingNames = new Set(state.habits.map((habit) => habit.name));
  renderTemplatePicker(elements.habitTemplates, selectedHabitTemplates, {
    disabledNames: existingNames,
    onSelectionChange: updateTemplateButtonState,
  });
}

function renderTemplatePicker(container, selectionSet, options = {}) {
  const disabledNames = options.disabledNames || new Set();
  const fragment = document.createDocumentFragment();

  HABIT_TEMPLATES.forEach((template, index) => {
    const isExisting = disabledNames.has(template.name);
    if (isExisting) {
      selectionSet.delete(index);
    }

    const label = document.createElement("label");
    label.className = `template-option${isExisting ? " is-existing" : ""}`;
    label.style.setProperty("--template-color", template.color);

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(index);
    input.checked = selectionSet.has(index);
    input.disabled = isExisting;
    input.addEventListener("change", () => {
      if (input.checked) {
        selectionSet.add(index);
      } else {
        selectionSet.delete(index);
      }
      options.onSelectionChange?.();
    });

    const emoji = document.createElement("span");
    emoji.className = "template-option__emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = template.emoji;

    const name = document.createElement("span");
    name.className = "template-option__name";
    name.textContent = template.name;

    const status = document.createElement("span");
    status.className = "template-option__status";
    status.textContent = isExisting ? "已添加" : "";

    label.append(input, emoji, name, status);
    fragment.append(label);
  });

  container.replaceChildren(fragment);
}

function requestDeleteHabit(habit) {
  openConfirmDialog({
    title: "删除这个习惯？",
    message: `“${habit.name}”及其打卡状态会被永久删除，此操作无法撤销。`,
    confirmLabel: "确认删除",
    onConfirm: () => {
      state.habits = state.habits.filter((item) => item.id !== habit.id);
      if (state.habits.length === 0) {
        isEditMode = false;
      }
      saveState();
      renderApp();
      showToast("习惯已删除");
    },
  });
}

function openConfirmDialog({ title, message, confirmLabel, onConfirm }) {
  confirmAction = onConfirm;
  elements.confirmDialogTitle.textContent = title;
  elements.confirmDialogMessage.textContent = message;
  elements.confirmActionButton.textContent = confirmLabel;
  elements.confirmActionButton.disabled = false;

  if (!elements.confirmDialog.open) {
    elements.confirmDialog.showModal();
  }
}

function closeConfirmDialog() {
  if (elements.confirmDialog.open) {
    elements.confirmDialog.close();
  }
}

function confirmPendingAction() {
  const action = confirmAction;
  closeConfirmDialog();
  if (typeof action === "function") {
    action();
  }
}

function exportBackup() {
  const payload = {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    habits: state.habits.map((habit) => ({ ...habit })),
  };

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `habit-tracker-backup-${todayKey}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("备份文件已导出");
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) {
    return;
  }

  if (file.size > 1024 * 1024) {
    showToast("备份文件过大，无法导入");
    return;
  }

  let payload;
  try {
    const text = await file.text();
    payload = JSON.parse(text);
  } catch {
    showToast("无法读取该文件，请选择有效的 JSON 备份");
    return;
  }

  if (!isValidExportPayload(payload)) {
    showToast("备份格式不正确，当前数据没有被修改");
    return;
  }

  openConfirmDialog({
    title: "导入并覆盖当前数据？",
    message: `备份中有 ${payload.habits.length} 个习惯，当前 ${state.habits.length} 个习惯将被完整替换。此操作无法撤销。`,
    confirmLabel: "导入并覆盖",
    onConfirm: () => {
      state = {
        version: EXPORT_VERSION,
        onboardingComplete: true,
        habits: payload.habits.map((habit) => ({ ...habit })),
      };
      isEditMode = false;
      saveState();
      renderApp();
      showToast("备份已成功导入");
    },
  });
}

function createHabitFromTemplate(template) {
  return {
    id: createId(),
    name: template.name,
    emoji: template.emoji,
    color: template.color,
    completedDate: null,
  };
}

function findHabitById(habitId) {
  return state.habits.find((habit) => habit.id === habitId) || null;
}

function findHabitCard(habitId) {
  return [...elements.habitList.children].find((card) => card.dataset.id === habitId) || null;
}

function getFirstGrapheme(value) {
  if (!value) {
    return "";
  }

  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return segmenter.segment(value)[Symbol.iterator]().next().value?.segment || "";
  } catch {
    return Array.from(value)[0] || "";
  }
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `habit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function scheduleDateRefresh() {
  if (midnightTimer) {
    window.clearTimeout(midnightTimer);
  }

  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 1, 0);
  const delay = Math.min(nextMidnight.getTime() - now.getTime(), 2147483647);

  midnightTimer = window.setTimeout(() => {
    handleDateCheck();
    scheduleDateRefresh();
  }, delay);
}

function handleDateCheck() {
  const nextKey = getLocalDateKey();
  if (nextKey === todayKey) {
    return;
  }

  const hadCompletedHabits = state.habits.some((habit) => habit.completedDate === todayKey);
  todayKey = nextKey;
  renderApp();

  if (hadCompletedHabits) {
    showToast("新的一天开始啦，打卡已重置");
  }
}

function probeStorage() {
  try {
    const testKey = "__habit_tracker_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function loadState() {
  const initialState = {
    version: EXPORT_VERSION,
    onboardingComplete: false,
    habits: [],
  };

  if (!storageEnabled) {
    return initialState;
  }

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
      return initialState;
    }

    const parsedState = JSON.parse(rawState);
    if (!isValidStoredState(parsedState)) {
      loadWarning = "本地习惯数据格式异常，当前已使用空白数据。你仍可导入之前的 JSON 备份。";
      return initialState;
    }

    return parsedState;
  } catch {
    loadWarning = "本地习惯数据无法读取，当前已使用空白数据。你仍可导入之前的 JSON 备份。";
    return initialState;
  }
}

function saveState() {
  if (!storageEnabled) {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: EXPORT_VERSION,
        onboardingComplete: state.onboardingComplete,
        habits: state.habits,
      }),
    );
  } catch {
    storageEnabled = false;
    showStorageNotice("浏览器未能保存数据，本次操作只在当前页面有效；请尽快导出备份。");
  }
}

function isValidStoredState(value) {
  return (
    isPlainObject(value) &&
    value.version === EXPORT_VERSION &&
    typeof value.onboardingComplete === "boolean" &&
    areValidHabits(value.habits)
  );
}

function isValidExportPayload(value) {
  return (
    isPlainObject(value) &&
    value.app === EXPORT_APP &&
    value.version === EXPORT_VERSION &&
    typeof value.exportedAt === "string" &&
    !Number.isNaN(Date.parse(value.exportedAt)) &&
    areValidHabits(value.habits)
  );
}

function areValidHabits(habits) {
  if (!Array.isArray(habits)) {
    return false;
  }

  const ids = new Set();
  return habits.every((habit) => {
    if (!isPlainObject(habit)) {
      return false;
    }

    const validName =
      typeof habit.name === "string" &&
      habit.name.trim() === habit.name &&
      Array.from(habit.name).length > 0 &&
      Array.from(habit.name).length <= 20;
    const validId = typeof habit.id === "string" && habit.id.length > 0 && !ids.has(habit.id);
    const validEmoji = typeof habit.emoji === "string" && Array.from(habit.emoji).length > 0;
    const validColor = typeof habit.color === "string" && COLORS.includes(habit.color);
    const validCompletedDate =
      habit.completedDate === null ||
      (typeof habit.completedDate === "string" && isValidDateKey(habit.completedDate));

    if (validId) {
      ids.add(habit.id);
    }

    return validId && validName && validEmoji && validColor && validCompletedDate;
  });
}

function isValidDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hideError(element) {
  element.hidden = true;
  element.textContent = "";
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function showStorageNotice(message) {
  elements.storageNotice.textContent = message;
  elements.storageNotice.hidden = false;
}

function showToast(message) {
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.requestAnimationFrame(() => elements.toast.classList.add("is-visible"));

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 180);
  }, 2400);
}

elements.habitDialog.addEventListener("close", () => {
  editingHabitId = null;
  selectedHabitTemplates.clear();
  hideError(elements.habitFormError);
  hideError(elements.templateFormError);
});

elements.confirmDialog.addEventListener("close", () => {
  confirmAction = null;
});