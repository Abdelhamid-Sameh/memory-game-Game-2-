/**
 * Author: Maximo Mena (modified for thesis project)
 * Project: Number Matcher — Memory Game (Game 2)
 */

var MemoryGame = {

  settings: {
    rows: 2,
    columns: 3,
  },

  cards: [],
  attempts: 0,
  mistakes: 0,
  isGameOver: false,
  currentRule: 'identical', // 'identical' or 'even_odd'

  // play() state — stored here so initialize() can reset them between stages
  _cardSelection: [],
  _revealedCards: 0,
  _revealedValues: [],

  /**
   * Start a new stage.
   * @param {number} rows
   * @param {number} columns
   * @param {string} rule  'identical' | 'even_odd'
   */
  initialize: function(rows, columns, rule) {
    if (!(typeof columns === 'number' && (columns % 1) === 0 && columns > 1) ||
        !(typeof rows === 'number' && (rows % 1) === 0 && rows > 1)) {
      throw { name: 'invalidInteger', message: 'Rows and columns must be integers > 1.' };
    }
    if ((columns * rows) % 2 !== 0) {
      throw { name: 'oddNumber', message: 'The total number of cards must be even.' };
    }

    this.settings.rows = rows;
    this.settings.columns = columns;
    this.currentRule = rule || 'identical';
    this.attempts = 0;
    this.mistakes = 0;
    this.isGameOver = false;
    this._cardSelection = [];
    this._revealedCards = 0;
    this._revealedValues = [];

    if (this.currentRule === 'even_odd') {
      this.createParityCards().shuffleCards();
    } else {
      this.createCards().shuffleCards();
    }

    return this.cards;
  },

  /**
   * Create matched pairs of cards with identical values.
   * Each pair shares the same randomly chosen integer (1–20).
   */
  createCards: function() {
    var cards = [];
    var usedValues = [];
    var numPairs = (this.settings.columns * this.settings.rows) / 2;

    for (var i = 0; i < numPairs; i++) {
      var value = this.getRandomUniqueValue(usedValues, 20);
      cards[2 * i]     = new this.Card(value);
      cards[2 * i + 1] = new this.Card(value, true);
    }

    this.cards = cards;
    return this;
  },

  /**
   * Create cards for parity matching: all values unique,
   * half are even and half are odd so the game is always completable.
   */
  createParityCards: function() {
    var totalCards = this.settings.columns * this.settings.rows;
    var half = totalCards / 2;

    var evensPool = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    var oddsPool  = [1, 3, 5, 7,  9, 11, 13, 15, 17, 19];

    var evens = this.shuffleArray(evensPool.slice()).slice(0, half);
    var odds  = this.shuffleArray(oddsPool.slice()).slice(0, half);

    var allValues = evens.concat(odds);
    var cards = [];
    for (var i = 0; i < allValues.length; i++) {
      cards.push(new this.Card(allValues[i]));
    }

    this.cards = cards;
    return this;
  },

  /**
   * Return a random integer in [1, max] not already in usedValues.
   */
  getRandomUniqueValue: function(usedValues, max) {
    var value;
    do {
      value = Math.floor(Math.random() * max) + 1;
    } while (usedValues.indexOf(value) !== -1);
    usedValues.push(value);
    return value;
  },

  /**
   * Fisher-Yates shuffle in place; returns the array.
   */
  shuffleArray: function(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  },

  /**
   * Rearrange elements in cards array (original algorithm preserved).
   */
  shuffleCards: function() {
    var cards = this.cards;
    var shuffledCards = [];

    while (shuffledCards.length < cards.length) {
      var randomIndex = Math.floor(Math.random() * cards.length);
      if (cards[randomIndex]) {
        shuffledCards.push(cards[randomIndex]);
        cards[randomIndex] = false;
      }
    }

    this.cards = shuffledCards;
    return this;
  },

  /**
   * Process a card flip at the given index.
   * Matching logic respects this.currentRule.
   *
   * Status codes:
   *   0 — card already revealed
   *   1 — first card of pair flipped
   *   2 — match
   *   3 — no match (args: [idx0, idx1])
   *   4 — stage complete (all pairs found)
   */
  play: function(index) {
    var status = {};

    if (this.cards[index].isRevealed) {
      status.code = 0;
      status.message = 'Card is already facing up.';
      return status;
    }

    this.cards[index].reveal();
    this._cardSelection.push(index);

    if (this._cardSelection.length === 2) {
      this.attempts++;
      var idx0 = this._cardSelection[0];
      var idx1 = this._cardSelection[1];
      var v0 = this.cards[idx0].value;
      var v1 = this.cards[idx1].value;

      var isMatch = (this.currentRule === 'even_odd')
        ? (v0 % 2 === v1 % 2)
        : (v0 === v1);

      if (!isMatch) {
        this.cards[idx0].conceal();
        this.cards[idx1].conceal();

        // Mistake = at least one of the cards was seen before in a failed attempt
        var isMistake = false;
        if (this._revealedValues.indexOf(v0) === -1) {
          this._revealedValues.push(v0);
        } else {
          isMistake = true;
        }
        if (this._revealedValues.indexOf(v1) === -1) {
          this._revealedValues.push(v1);
        }
        if (isMistake) {
          this.mistakes++;
        }

        status.code = 3;
        status.message = 'No match. Conceal cards.';
        status.args = [idx0, idx1];

      } else {
        this._revealedCards += 2;

        if (this._revealedCards === this.cards.length) {
          this.isGameOver = true;
          status.code = 4;
          status.message = 'Stage complete!';
        } else {
          status.code = 2;
          status.message = 'Match.';
        }
      }

      this._cardSelection = [];

    } else {
      status.code = 1;
      status.message = 'Flip first card.';
    }

    return status;
  }

};
