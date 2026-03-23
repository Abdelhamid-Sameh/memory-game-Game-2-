/**
 * BrowserInterface.js
 * Session flow: Easy → Medium → Hard → [Rule Change] → Medium (Parity)
 */
(function ($) {
  var nonMatchingCardTime = 1000;
  var isProcessing = false;

  var SESSION_STAGES = [
    {
      rows: 2,
      columns: 3,
      rule: "identical",
      label: "Round 1 — Easy",
      revealTime: 1500,
    },
    {
      rows: 3,
      columns: 4,
      rule: "identical",
      label: "Round 2 — Medium",
      revealTime: 2500,
    },
    {
      rows: 4,
      columns: 5,
      rule: "identical",
      label: "Round 3 — Hard",
      revealTime: 3500,
    },
    {
      rows: 4,
      columns: 5,
      rule: "even_odd",
      label: "Round 4 — Parity",
      revealTime: 3000,
    },
  ];

  var currentStageIndex = -1;
  var pendingAction = null;

  // ── Event log ────────────────────────────────────────────────────────────────
  var game2Log = [];
  var flipId = 0;
  var pairAttemptId = 0;
  var firstFlipTimestamp = null;

  // DOM refs
  var startModal = document.getElementById("memory--start-modal");
  var transitionModal = document.getElementById("memory--transition-modal");
  var transitionTitle = document.getElementById("memory--transition-title");
  var transitionMsg = document.getElementById("memory--transition-message");
  var transitionBtn = document.getElementById("memory--transition-btn");
  var stageLabel = document.getElementById("memory--stage-label");

  // ── Start button ────────────────────────────────────────────────────────────
  document
    .getElementById("memory--start-btn")
    .addEventListener("click", function (e) {
      e.preventDefault();
      startModal.classList.remove("show");
      currentStageIndex = 0;
      startCurrentStage();
    });

  // ── Transition / continue button ─────────────────────────────────────────────
  transitionBtn.addEventListener("click", function (e) {
    e.preventDefault();
    transitionModal.classList.remove("show");
    if (pendingAction) {
      var action = pendingAction;
      pendingAction = null;
      action();
    }
  });

  // ── Stage helpers ────────────────────────────────────────────────────────────
  function startCurrentStage() {
    var stage = SESSION_STAGES[currentStageIndex];
    stageLabel.textContent = stage.label;
    $.initialize(stage.rows, stage.columns, stage.rule);
    buildLayout($.cards, $.settings.rows, $.settings.columns);

    // Timed reveal: show all cards face-up briefly, then hide them
    isProcessing = true;
    var revealStart = Date.now();
    game2Log.push({
      event_type: "reveal_start",
      round: currentStageIndex + 1,
      timestamp: revealStart,
    });

    var childNodes = document.getElementById("memory--cards").childNodes;
    for (var i = 0; i < childNodes.length; i++) {
      childNodes[i].classList.add("clicked");
    }
    setTimeout(function () {
      game2Log.push({
        event_type: "reveal_end",
        round: currentStageIndex + 1,
        timestamp: Date.now(),
      });
      var nodes = document.getElementById("memory--cards").childNodes;
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.remove("clicked");
      }
      isProcessing = false;
    }, stage.revealTime);
  }

  function showTransition(title, message, btnText, onContinue) {
    transitionTitle.textContent = title;
    transitionMsg.textContent = message;
    if (btnText) {
      transitionBtn.textContent = btnText;
      transitionBtn.style.display = "";
    } else {
      transitionBtn.style.display = "none";
    }
    pendingAction = onContinue;
    transitionModal.classList.add("show");
  }

  function onStageComplete() {
    var nextIndex = currentStageIndex + 1;

    if (nextIndex >= SESSION_STAGES.length) {
      // All rounds finished — persist the log
      sessionStorage.setItem("game2_log", JSON.stringify(game2Log));
      showTransition(
        "Session Complete!",
        "All rounds are finished. Thank you for participating.",
        null,
        null,
      );
      stageLabel.textContent = "";
      return;
    }

    if (nextIndex === 3) {
      // Rule-change screen before the parity round
      showTransition(
        "Rule Change!",
        "Match EVEN numbers with EVEN and ODD numbers with ODD — but matching two identical numbers is WRONG, even if they share parity.",
        "Got it — let's go!",
        function () {
          currentStageIndex = 3;
          startCurrentStage();
        },
      );
    } else {
      showTransition(
        "Round Complete!",
        "Well done! Get ready for the next round.",
        "Continue",
        function () {
          currentStageIndex = nextIndex;
          startCurrentStage();
        },
      );
    }
  }

  // ── Card click handler ───────────────────────────────────────────────────────
  var handleFlipCard = function (event) {
    event.preventDefault();
    if (isProcessing) return;

    var flipTimestamp = Date.now();
    var cardIndex = this.index;
    var status = $.play(cardIndex);

    if (status.code === 0) return; // already revealed — ignore

    this.classList.toggle("clicked");

    // ── Log this flip ──────────────────────────────────────────────────────────
    flipId++;
    var flipInPair, matchResult, timeBetweenFlips;

    if (status.code === 1) {
      // First card of a pair
      pairAttemptId++;
      flipInPair = 1;
      matchResult = null;
      timeBetweenFlips = null;
      firstFlipTimestamp = flipTimestamp;
    } else {
      // Second card of a pair (codes 2, 3, 4)
      flipInPair = 2;
      matchResult = (status.code === 2 || status.code === 4) ? "correct" : "incorrect";
      timeBetweenFlips = flipTimestamp - firstFlipTimestamp;
      firstFlipTimestamp = null;
    }

    game2Log.push({
      event_type: "flip",
      flip_id: flipId,
      timestamp: flipTimestamp,
      round: currentStageIndex + 1,
      card_value: $.cards[cardIndex].value,
      pair_attempt_id: pairAttemptId,
      flip_in_pair: flipInPair,
      current_rule: $.currentRule,
      post_switch: currentStageIndex === 3,
      match_result: matchResult,
      time_between_flips_ms: timeBetweenFlips,
    });
    // ──────────────────────────────────────────────────────────────────────────

    if (status.code === 3) {
      isProcessing = true;
      var args = status.args;
      setTimeout(function () {
        var childNodes = document.getElementById("memory--cards").childNodes;
        childNodes[args[0]].classList.remove("clicked");
        childNodes[args[1]].classList.remove("clicked");
        isProcessing = false;
      }, nonMatchingCardTime);
    } else if (status.code === 4) {
      isProcessing = true;
      setTimeout(function () {
        onStageComplete();
      }, 500);
    }
  };

  // ── Layout builders ──────────────────────────────────────────────────────────
  var buildLayout = function (cards, rows, columns) {
    if (!cards.length) return;

    var memoryCards = document.getElementById("memory--cards");

    var cardMaxWidth =
      document.getElementById("memory--app-container").offsetWidth / columns;
    var cardHeightForMaxWidth = cardMaxWidth * (3 / 4);
    var cardMaxHeight =
      document.getElementById("memory--app-container").offsetHeight / rows;
    var cardWidthForMaxHeight = cardMaxHeight * (4 / 3);

    // Remove existing cards and their listeners
    while (memoryCards.firstChild) {
      memoryCards.firstChild.removeEventListener("click", handleFlipCard);
      memoryCards.removeChild(memoryCards.firstChild);
    }

    var index = 0;
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < columns; j++) {
        memoryCards.appendChild(
          buildCardNode(
            index,
            cards[index],
            100 / columns + "%",
            100 / rows + "%",
          ),
        );
        index++;
      }
    }

    if (cardMaxHeight > cardHeightForMaxWidth) {
      memoryCards.style.height = cardHeightForMaxWidth * rows + "px";
      memoryCards.style.width =
        document.getElementById("memory--app-container").offsetWidth + "px";
      memoryCards.style.top =
        (cardMaxHeight * rows - cardHeightForMaxWidth * rows) / 2 + "px";
    } else {
      memoryCards.style.width = cardWidthForMaxHeight * columns + "px";
      memoryCards.style.height =
        document.getElementById("memory--app-container").offsetHeight + "px";
      memoryCards.style.top = 0;
    }
  };

  window.addEventListener(
    "resize",
    function () {
      if (currentStageIndex >= 0) {
        buildLayout($.cards, $.settings.rows, $.settings.columns);
      }
    },
    true,
  );

  var buildCardNode = function (index, card, width, height) {
    var flipContainer = document.createElement("li");
    var flipper = document.createElement("div");
    var front = document.createElement("a");
    var back = document.createElement("a");

    flipContainer.index = index;
    flipContainer.style.width = width;
    flipContainer.style.height = height;
    flipContainer.classList.add("flip-container");
    if (card.isRevealed) flipContainer.classList.add("clicked");

    flipper.classList.add("flipper");

    front.classList.add("front");
    front.setAttribute("href", "#");

    back.classList.add("back");
    if (card.isMatchingCard) back.classList.add("matching");
    back.setAttribute("href", "#");

    var cardNumber = document.createElement("span");
    cardNumber.classList.add("card-number");
    cardNumber.textContent = card.value;
    back.appendChild(cardNumber);

    flipper.appendChild(front);
    flipper.appendChild(back);
    flipContainer.appendChild(flipper);

    flipContainer.addEventListener("click", handleFlipCard);

    return flipContainer;
  };
})(MemoryGame);
