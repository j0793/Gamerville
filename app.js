(function () {
  "use strict";

  var STORAGE_KEY = "gameNightState_v1";
  var DEFAULT_VALUES = [100, 200, 300, 400, 500];

  // ---------- State ----------

  function defaultCategory(name) {
    return {
      name: name || "Category",
      clues: DEFAULT_VALUES.map(function (v) {
        return { value: v, question: "", answer: "", used: false };
      }),
    };
  }

  function defaultState() {
    return {
      eventTitle: "Friday Night Game Changer",
      contestants: [],
      categories: [
        defaultCategory("Category 1"),
        defaultCategory("Category 2"),
        defaultCategory("Category 3"),
        defaultCategory("Category 4"),
        defaultCategory("Category 5"),
      ],
      promptText: "",
    };
  }

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      // basic shape guard
      if (!parsed.categories || !parsed.contestants) return defaultState();
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — continue without persistence */
    }
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  // ---------- Elements ----------

  var el = {
    eventTitle: document.getElementById("eventTitle"),
    tabs: document.querySelectorAll(".tab-btn"),
    views: document.querySelectorAll(".view"),
    boardGrid: document.getElementById("boardGrid"),

    promptInput: document.getElementById("promptInput"),
    showPromptBtn: document.getElementById("showPromptBtn"),
    clearPromptBtn: document.getElementById("clearPromptBtn"),
    promptDisplay: document.getElementById("promptDisplay"),
    promptDisplayText: document.getElementById("promptDisplayText"),

    newContestantName: document.getElementById("newContestantName"),
    addContestantBtn: document.getElementById("addContestantBtn"),
    contestantList: document.getElementById("contestantList"),

    clueOverlay: document.getElementById("clueOverlay"),
    clueCategory: document.getElementById("clueCategory"),
    clueValue: document.getElementById("clueValue"),
    clueStageLabel: document.getElementById("clueStageLabel"),
    clueText: document.getElementById("clueText"),
    revealAnswerBtn: document.getElementById("revealAnswerBtn"),
    closeClueBtn: document.getElementById("closeClueBtn"),

    setupBtn: document.getElementById("setupBtn"),
    setupOverlay: document.getElementById("setupOverlay"),
    closeSetupBtn: document.getElementById("closeSetupBtn"),
    setupCategories: document.getElementById("setupCategories"),
    fillValuesBtn: document.getElementById("fillValuesBtn"),
    resetBoardBtn: document.getElementById("resetBoardBtn"),
    resetUsedBtn: document.getElementById("resetUsedBtn"),
  };

  var activeClue = null; // { catIndex, clueIndex, stage: 'question'|'answer' }

  // ---------- Tabs ----------

  el.tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      el.tabs.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var view = btn.getAttribute("data-view");
      el.views.forEach(function (v) { v.classList.remove("active"); });
      document.getElementById(view + "View").classList.add("active");
    });
  });

  // ---------- Event title ----------

  el.eventTitle.textContent = state.eventTitle;
  el.eventTitle.addEventListener("blur", function () {
    state.eventTitle = el.eventTitle.textContent.trim() || "Game Night";
    saveState();
  });
  el.eventTitle.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); el.eventTitle.blur(); }
  });

  // ---------- Board rendering ----------

  function renderBoard() {
    el.boardGrid.innerHTML = "";

    // header row
    state.categories.forEach(function (cat) {
      var h = document.createElement("div");
      h.className = "cat-header";
      h.textContent = cat.name || "—";
      el.boardGrid.appendChild(h);
    });

    // value rows
    for (var row = 0; row < DEFAULT_VALUES.length; row++) {
      state.categories.forEach(function (cat, catIndex) {
        var clue = cat.clues[row];
        var cell = document.createElement("div");
        cell.className = "clue-cell" + (clue.used ? " used" : "");
        cell.textContent = clue.used ? "" : "$" + clue.value;
        if (!clue.used) {
          cell.addEventListener("click", function () {
            openClue(catIndex, row);
          });
        }
        el.boardGrid.appendChild(cell);
      });
    }
  }

  function openClue(catIndex, clueIndex) {
    var cat = state.categories[catIndex];
    var clue = cat.clues[clueIndex];
    if (clue.used) return;
    activeClue = { catIndex: catIndex, clueIndex: clueIndex, stage: "question" };
    el.clueCategory.textContent = cat.name || "Category";
    el.clueValue.textContent = "$" + clue.value;
    el.clueStageLabel.textContent = "Question";
    el.clueText.textContent = clue.question || "(no question entered — add one in Setup)";
    el.revealAnswerBtn.style.display = "";
    el.clueOverlay.classList.add("active");
  }

  el.revealAnswerBtn.addEventListener("click", function () {
    if (!activeClue) return;
    var cat = state.categories[activeClue.catIndex];
    var clue = cat.clues[activeClue.clueIndex];
    activeClue.stage = "answer";
    el.clueStageLabel.textContent = "Answer";
    el.clueText.textContent = clue.answer || "(no answer entered — add one in Setup)";
    el.revealAnswerBtn.style.display = "none";
  });

  el.closeClueBtn.addEventListener("click", function () {
    if (activeClue) {
      var cat = state.categories[activeClue.catIndex];
      cat.clues[activeClue.clueIndex].used = true;
      saveState();
      renderBoard();
    }
    activeClue = null;
    el.clueOverlay.classList.remove("active");
  });

  // click outside card closes without marking used (in case opened by mistake)
  el.clueOverlay.addEventListener("click", function (e) {
    if (e.target === el.clueOverlay) {
      activeClue = null;
      el.clueOverlay.classList.remove("active");
    }
  });

  // ---------- Prompt view ----------

  el.promptInput.value = state.promptText || "";
  el.promptDisplayText.textContent = state.promptText || "Waiting for a prompt…";

  el.showPromptBtn.addEventListener("click", function () {
    state.promptText = el.promptInput.value.trim();
    el.promptDisplayText.textContent = state.promptText || "Waiting for a prompt…";
    saveState();
  });

  el.clearPromptBtn.addEventListener("click", function () {
    state.promptText = "";
    el.promptInput.value = "";
    el.promptDisplayText.textContent = "Waiting for a prompt…";
    saveState();
  });

  // ---------- Scoreboard ----------

  function renderContestants() {
    el.contestantList.innerHTML = "";
    state.contestants.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "contestant-row";

      var top = document.createElement("div");
      top.className = "contestant-row-top";

      var nameInput = document.createElement("input");
      nameInput.className = "contestant-name";
      nameInput.value = c.name;
      nameInput.addEventListener("blur", function () {
        c.name = nameInput.value.trim() || "Player";
        saveState();
      });
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); nameInput.blur(); }
      });

      var removeBtn = document.createElement("button");
      removeBtn.className = "contestant-remove";
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.title = "Remove contestant";
      removeBtn.addEventListener("click", function () {
        state.contestants = state.contestants.filter(function (x) { return x.id !== c.id; });
        saveState();
        renderContestants();
      });

      top.appendChild(nameInput);
      top.appendChild(removeBtn);

      var scoreInput = document.createElement("input");
      scoreInput.className = "contestant-score";
      scoreInput.value = c.score;
      scoreInput.inputMode = "numeric";
      scoreInput.addEventListener("blur", function () {
        var n = parseInt(scoreInput.value, 10);
        c.score = isNaN(n) ? 0 : n;
        scoreInput.value = c.score;
        saveState();
      });
      scoreInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); scoreInput.blur(); }
      });

      var controls = document.createElement("div");
      controls.className = "contestant-controls";

      var amountInput = document.createElement("input");
      amountInput.className = "score-amount";
      amountInput.type = "number";
      amountInput.value = 100;

      var minusBtn = document.createElement("button");
      minusBtn.className = "score-btn minus";
      minusBtn.type = "button";
      minusBtn.textContent = "−";
      minusBtn.addEventListener("click", function () {
        var amt = parseInt(amountInput.value, 10) || 0;
        c.score -= amt;
        scoreInput.value = c.score;
        saveState();
      });

      var plusBtn = document.createElement("button");
      plusBtn.className = "score-btn plus";
      plusBtn.type = "button";
      plusBtn.textContent = "+";
      plusBtn.addEventListener("click", function () {
        var amt = parseInt(amountInput.value, 10) || 0;
        c.score += amt;
        scoreInput.value = c.score;
        saveState();
      });

      controls.appendChild(minusBtn);
      controls.appendChild(amountInput);
      controls.appendChild(plusBtn);

      li.appendChild(top);
      li.appendChild(scoreInput);
      li.appendChild(controls);
      el.contestantList.appendChild(li);
    });
  }

  el.addContestantBtn.addEventListener("click", addContestant);
  el.newContestantName.addEventListener("keydown", function (e) {
    if (e.key === "Enter") addContestant();
  });

  function addContestant() {
    var name = el.newContestantName.value.trim();
    if (!name) return;
    state.contestants.push({ id: uid(), name: name, score: 0 });
    el.newContestantName.value = "";
    saveState();
    renderContestants();
  }

  // ---------- Setup overlay ----------

  el.setupBtn.addEventListener("click", function () {
    renderSetup();
    el.setupOverlay.classList.add("active");
  });
  el.closeSetupBtn.addEventListener("click", function () {
    el.setupOverlay.classList.remove("active");
    renderBoard();
  });
  el.setupOverlay.addEventListener("click", function (e) {
    if (e.target === el.setupOverlay) {
      el.setupOverlay.classList.remove("active");
      renderBoard();
    }
  });

  el.fillValuesBtn.addEventListener("click", function () {
    state.categories.forEach(function (cat) {
      cat.clues.forEach(function (clue, i) { clue.value = DEFAULT_VALUES[i]; });
    });
    saveState();
    renderSetup();
  });

  el.resetBoardBtn.addEventListener("click", function () {
    if (!confirm("Reset the entire board (categories, clues, and used status)? This can't be undone.")) return;
    state.categories = [
      defaultCategory("Category 1"),
      defaultCategory("Category 2"),
      defaultCategory("Category 3"),
      defaultCategory("Category 4"),
      defaultCategory("Category 5"),
    ];
    saveState();
    renderSetup();
    renderBoard();
  });

  el.resetUsedBtn.addEventListener("click", function () {
    state.categories.forEach(function (cat) {
      cat.clues.forEach(function (clue) { clue.used = false; });
    });
    saveState();
    renderSetup();
    renderBoard();
  });

  function renderSetup() {
    el.setupCategories.innerHTML = "";
    state.categories.forEach(function (cat, catIndex) {
      var wrap = document.createElement("div");
      wrap.className = "setup-category";

      var nameInput = document.createElement("input");
      nameInput.className = "cat-name-input";
      nameInput.value = cat.name;
      nameInput.addEventListener("input", function () {
        cat.name = nameInput.value;
      });
      nameInput.addEventListener("blur", function () {
        saveState();
        renderBoard();
      });
      wrap.appendChild(nameInput);

      cat.clues.forEach(function (clue, clueIndex) {
        var clueWrap = document.createElement("div");
        clueWrap.className = "setup-clue";

        var row1 = document.createElement("div");
        row1.className = "setup-clue-row";

        var valueField = document.createElement("div");
        valueField.style.width = "64px";
        var valueLabel = document.createElement("span");
        valueLabel.className = "setup-clue-label";
        valueLabel.textContent = "Value";
        var valueInput = document.createElement("input");
        valueInput.className = "value-input";
        valueInput.type = "number";
        valueInput.value = clue.value;
        valueInput.addEventListener("change", function () {
          var n = parseInt(valueInput.value, 10);
          clue.value = isNaN(n) ? 0 : n;
          saveState();
          renderBoard();
        });
        valueField.appendChild(valueLabel);
        valueField.appendChild(valueInput);

        var questionField = document.createElement("div");
        questionField.style.flex = "1";
        var qLabel = document.createElement("span");
        qLabel.className = "setup-clue-label";
        qLabel.textContent = "Question";
        var qInput = document.createElement("input");
        qInput.value = clue.question;
        qInput.placeholder = "What the host reads aloud";
        qInput.addEventListener("input", function () {
          clue.question = qInput.value;
        });
        qInput.addEventListener("blur", saveState);
        questionField.appendChild(qLabel);
        questionField.appendChild(qInput);

        row1.appendChild(valueField);
        row1.appendChild(questionField);

        var row2 = document.createElement("div");
        row2.className = "setup-clue-row";
        var aLabel = document.createElement("span");
        aLabel.className = "setup-clue-label";
        aLabel.textContent = "Answer";
        var aInput = document.createElement("input");
        aInput.value = clue.answer;
        aInput.placeholder = "Revealed after the question";
        aInput.addEventListener("input", function () {
          clue.answer = aInput.value;
        });
        aInput.addEventListener("blur", saveState);

        var aWrap = document.createElement("div");
        aWrap.style.width = "100%";
        aWrap.appendChild(aLabel);
        aWrap.appendChild(aInput);
        row2.appendChild(aWrap);

        clueWrap.appendChild(row1);
        clueWrap.appendChild(row2);
        wrap.appendChild(clueWrap);
      });

      el.setupCategories.appendChild(wrap);
    });
  }

  // ---------- Init ----------

  renderBoard();
  renderContestants();
})();
