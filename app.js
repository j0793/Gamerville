(function () {
  "use strict";

  var STORAGE_KEY = "gameNightState_v2";
  var DEFAULT_VALUES = [100, 200, 300, 400, 500];
  var ROUND_LABELS = {
    round2: "Round 2 · SIT, SPEAK, ROLL OVER",
    round3: "Round 3 · BARK BARK, BITCH",
  };

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
      eventTitle: "Are You Smarter Than A Shiba Inu",
      contestants: [],
      categories: [
        defaultCategory("Category 1"),
        defaultCategory("Category 2"),
        defaultCategory("Category 3"),
        defaultCategory("Category 4"),
        defaultCategory("Category 5"),
      ],
      activeRound: "round1",
      onTheSpotId: "",
      judgedBy: "",
      timerSeconds: 60,
      rounds: {
        round2: { queue: [], currentIndex: -1 },
        round3: { queue: [], currentIndex: -1 },
      },
    };
  }

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed.categories || !parsed.contestants || !parsed.rounds) return defaultState();
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
    roundPills: document.querySelectorAll(".round-pill"),
    views: document.querySelectorAll(".view"),
    boardView: document.getElementById("boardView"),
    promptView: document.getElementById("promptView"),
    boardGrid: document.getElementById("boardGrid"),
    roundBannerTitle: document.getElementById("roundBannerTitle"),

    promptDisplayText: document.getElementById("promptDisplayText"),
    onTheSpotDisplay: document.getElementById("onTheSpotDisplay"),
    judgedByDisplay: document.getElementById("judgedByDisplay"),

    prevPromptBtn: document.getElementById("prevPromptBtn"),
    nextPromptBtn: document.getElementById("nextPromptBtn"),
    queuePosition: document.getElementById("queuePosition"),

    promptQueueInput: document.getElementById("promptQueueInput"),
    addToQueueBtn: document.getElementById("addToQueueBtn"),
    queueList: document.getElementById("queueList"),

    onTheSpotSelect: document.getElementById("onTheSpotSelect"),
    judgedByInput: document.getElementById("judgedByInput"),

    timerDisplay: document.getElementById("timerDisplay"),
    timerSecondsInput: document.getElementById("timerSecondsInput"),
    timerStartBtn: document.getElementById("timerStartBtn"),
    timerResetBtn: document.getElementById("timerResetBtn"),

    awardAmount: document.getElementById("awardAmount"),
    awardPointsBtn: document.getElementById("awardPointsBtn"),

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
    exportBoardBtn: document.getElementById("exportBoardBtn"),
    importBoardBtn: document.getElementById("importBoardBtn"),
    importBoardInput: document.getElementById("importBoardInput"),
  };

  var activeClue = null; // { catIndex, clueIndex, stage: 'question'|'answer' }

  // ---------- Round navigation ----------

  el.roundPills.forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.activeRound = btn.getAttribute("data-round");
      saveState();
      updateRoundUI();
    });
  });

  function updateRoundUI() {
    el.roundPills.forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-round") === state.activeRound);
    });

    if (state.activeRound === "round1") {
      el.boardView.classList.add("active");
      el.promptView.classList.remove("active");
    } else {
      el.boardView.classList.remove("active");
      el.promptView.classList.add("active");
      el.roundBannerTitle.textContent = ROUND_LABELS[state.activeRound];
      renderPromptConsole();
    }
  }

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

    state.categories.forEach(function (cat) {
      var h = document.createElement("div");
      h.className = "cat-header";
      h.textContent = cat.name || "—";
      el.boardGrid.appendChild(h);
    });

    for (var row = 0; row < DEFAULT_VALUES.length; row++) {
      state.categories.forEach(function (cat, catIndex) {
        var clue = cat.clues[row];
        var cell = document.createElement("div");
        cell.className = "clue-cell" + (clue.used ? " used" : "");
        cell.textContent = clue.used ? "" : "$" + clue.value;
        if (!clue.used) {
          // capture row/catIndex per-cell via a bound closure argument (not the loop var)
          cell.addEventListener("click", (function (fixedCat, fixedRow) {
            return function () { openClue(fixedCat, fixedRow); };
          })(catIndex, row));
        }
        el.boardGrid.appendChild(cell);
      });
    }
  }

  function openClue(catIndex, clueIndex) {
    var cat = state.categories[catIndex];
    var clue = cat.clues[clueIndex];
    if (!clue || clue.used) return;
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

  el.clueOverlay.addEventListener("click", function (e) {
    if (e.target === el.clueOverlay) {
      activeClue = null;
      el.clueOverlay.classList.remove("active");
    }
  });

  // ---------- Prompt console (Rounds 2 & 3) ----------

  function currentRoundData() {
    return state.rounds[state.activeRound];
  }

  function renderPromptConsole() {
    var round = currentRoundData();
    if (!round) return;

    // now playing text
    var current = round.currentIndex >= 0 ? round.queue[round.currentIndex] : null;
    el.promptDisplayText.textContent = current || "Add prompts to the queue to get started…";
    el.queuePosition.textContent = round.queue.length
      ? (round.currentIndex + 1) + " / " + round.queue.length
      : "0 / 0";

    // queue list
    el.queueList.innerHTML = "";
    round.queue.forEach(function (text, idx) {
      var li = document.createElement("li");
      li.className = "queue-item" + (idx === round.currentIndex ? " current" : "");

      var span = document.createElement("span");
      span.className = "queue-item-text";
      span.textContent = (idx + 1) + ". " + text;
      span.title = "Jump to this prompt";
      span.addEventListener("click", function () {
        round.currentIndex = idx;
        saveState();
        renderPromptConsole();
      });

      var removeBtn = document.createElement("button");
      removeBtn.className = "queue-item-remove";
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", function () {
        round.queue.splice(idx, 1);
        if (round.currentIndex >= round.queue.length) {
          round.currentIndex = round.queue.length - 1;
        }
        saveState();
        renderPromptConsole();
      });

      li.appendChild(span);
      li.appendChild(removeBtn);
      el.queueList.appendChild(li);
    });

    // on the spot / judged by
    el.onTheSpotSelect.innerHTML = '<option value="">— none —</option>';
    state.contestants.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === state.onTheSpotId) opt.selected = true;
      el.onTheSpotSelect.appendChild(opt);
    });
    var onSpot = state.contestants.filter(function (c) { return c.id === state.onTheSpotId; })[0];
    el.onTheSpotDisplay.textContent = onSpot ? onSpot.name : "—";

    el.judgedByInput.value = state.judgedBy || "";
    el.judgedByDisplay.textContent = state.judgedBy || "—";
  }

  el.addToQueueBtn.addEventListener("click", function () {
    var round = currentRoundData();
    var lines = el.promptQueueInput.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return;
    var wasEmpty = round.queue.length === 0;
    round.queue = round.queue.concat(lines);
    if (wasEmpty) round.currentIndex = 0;
    el.promptQueueInput.value = "";
    saveState();
    renderPromptConsole();
  });

  el.prevPromptBtn.addEventListener("click", function () {
    var round = currentRoundData();
    if (round.currentIndex > 0) {
      round.currentIndex -= 1;
      saveState();
      renderPromptConsole();
    }
  });

  el.nextPromptBtn.addEventListener("click", function () {
    var round = currentRoundData();
    if (round.currentIndex < round.queue.length - 1) {
      round.currentIndex += 1;
      saveState();
      renderPromptConsole();
    }
  });

  el.onTheSpotSelect.addEventListener("change", function () {
    state.onTheSpotId = el.onTheSpotSelect.value;
    saveState();
    renderPromptConsole();
  });

  el.judgedByInput.addEventListener("input", function () {
    state.judgedBy = el.judgedByInput.value;
    el.judgedByDisplay.textContent = state.judgedBy || "—";
  });
  el.judgedByInput.addEventListener("blur", saveState);

  // ---------- Timer ----------

  var timerInterval = null;
  var timerRemaining = state.timerSeconds || 60;
  var timerRunning = false;

  function formatTime(secs) {
    secs = Math.max(0, secs);
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function renderTimer() {
    el.timerDisplay.textContent = formatTime(timerRemaining);
    el.timerDisplay.classList.toggle("time-up", timerRemaining === 0);
  }

  el.timerSecondsInput.value = state.timerSeconds || 60;
  renderTimer();

  el.timerStartBtn.addEventListener("click", function () {
    if (timerRunning) {
      // pause
      clearInterval(timerInterval);
      timerRunning = false;
      el.timerStartBtn.textContent = "Start";
      return;
    }
    if (timerRemaining <= 0) {
      timerRemaining = parseInt(el.timerSecondsInput.value, 10) || 60;
    }
    timerRunning = true;
    el.timerStartBtn.textContent = "Pause";
    timerInterval = setInterval(function () {
      timerRemaining -= 1;
      if (timerRemaining <= 0) {
        timerRemaining = 0;
        clearInterval(timerInterval);
        timerRunning = false;
        el.timerStartBtn.textContent = "Start";
      }
      renderTimer();
    }, 1000);
  });

  el.timerResetBtn.addEventListener("click", function () {
    clearInterval(timerInterval);
    timerRunning = false;
    el.timerStartBtn.textContent = "Start";
    timerRemaining = parseInt(el.timerSecondsInput.value, 10) || 60;
    renderTimer();
  });

  el.timerSecondsInput.addEventListener("change", function () {
    var n = parseInt(el.timerSecondsInput.value, 10);
    state.timerSeconds = isNaN(n) ? 60 : n;
    saveState();
    if (!timerRunning) {
      timerRemaining = state.timerSeconds;
      renderTimer();
    }
  });

  // ---------- Award points ----------

  el.awardPointsBtn.addEventListener("click", function () {
    var contestant = state.contestants.filter(function (c) { return c.id === state.onTheSpotId; })[0];
    if (!contestant) return;
    var amt = parseInt(el.awardAmount.value, 10) || 0;
    contestant.score += amt;
    saveState();
    renderContestants();
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
        if (state.activeRound !== "round1") renderPromptConsole();
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
        if (state.onTheSpotId === c.id) state.onTheSpotId = "";
        saveState();
        renderContestants();
        if (state.activeRound !== "round1") renderPromptConsole();
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
    if (state.activeRound !== "round1") renderPromptConsole();
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

  // ---- Board export / import (reusable templates) ----

  el.exportBoardBtn.addEventListener("click", function () {
    var payload = {
      boardTemplate: true,
      categories: state.categories.map(function (cat) {
        return {
          name: cat.name,
          clues: cat.clues.map(function (cl) {
            return { value: cl.value, question: cl.question, answer: cl.answer };
          }),
        };
      }),
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var fileName = (state.eventTitle || "board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    a.href = url;
    a.download = (fileName || "board") + "-board.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  el.importBoardBtn.addEventListener("click", function () {
    el.importBoardInput.click();
  });

  el.importBoardInput.addEventListener("change", function () {
    var file = el.importBoardInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data.categories || !Array.isArray(data.categories) || !data.categories.length) {
          throw new Error("Missing categories");
        }
        state.categories = data.categories.slice(0, 5).map(function (cat) {
          var clues = (cat.clues || []).slice(0, 5).map(function (cl, i) {
            return {
              value: typeof cl.value === "number" ? cl.value : DEFAULT_VALUES[i],
              question: cl.question || "",
              answer: cl.answer || "",
              used: false,
            };
          });
          while (clues.length < 5) {
            clues.push({ value: DEFAULT_VALUES[clues.length], question: "", answer: "", used: false });
          }
          return { name: cat.name || "Category", clues: clues };
        });
        while (state.categories.length < 5) {
          state.categories.push(defaultCategory("Category " + (state.categories.length + 1)));
        }
        saveState();
        renderSetup();
        renderBoard();
      } catch (err) {
        alert("Couldn't read that file as a board template. Make sure it's a JSON file exported from this app.");
      }
      el.importBoardInput.value = "";
    };
    reader.readAsText(file);
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

      cat.clues.forEach(function (clue) {
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
  updateRoundUI();
})();