/**
 * Author: Maximo Mena (modified for thesis project)
 * Project: Number Matcher — Memory Game (Game 2)
 */

var MemoryGame = {

  settings: {
    rows: 2,
    columns: 3,
  },

  SUM_TARGET: 21, // Round 4 target sum — pairs (1,20),(2,19),...,(10,11)

  cards: [],
  attempts: 0,
  mistakes: 0,
  isGameOver: false,
  currentRule: 'identical', // 'identical' | 'sum_target'

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

    if (this.currentRule === 'sum_target') {
      this.createSumCards(this.SUM_TARGET).shuffleCards();
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
   * Create cards for sum-to-target matching (Round 4, target = 21).
   *
   * Deck structure (20 cards, 10 pair slots):
   *   6 unique sum pairs — each value appears exactly once:
   *     (1,20),(2,19),(5,16),(6,15),(7,14),(8,13)
   *   2 duplicate sum pairs — each pair appears twice in the deck:
   *     (3,18) × 2  and  (4,17) × 2
   *
   * The duplicate pairs are the perseveration traps: the deck contains two 3s,
   * two 18s, two 4s, and two 17s. The correct match is still 3+18=21 / 4+17=21,
   * but a participant applying the old identical-match rule will try to flip (3,3),
   * (18,18), (4,4), or (17,17) — those are unambiguous perseveration errors.
   * Every card has a valid sum partner, so the round can always be completed.
   *
   * Values 3, 4, 17, 18 appear ONLY in the duplicate pairs — not in the unique
   * pairs — so trap flips are unambiguous.
   */
  createSumCards: function(target) {
    var cards = [];
    // 6 unique sum pairs — values appear exactly once
    var uniquePairs = [[1,20],[2,19],[5,16],[6,15],[7,14],[8,13]];
    for (var i = 0; i < uniquePairs.length; i++) {
      cards.push(new this.Card(uniquePairs[i][0]));
      cards.push(new this.Card(uniquePairs[i][1]));
    }
    // 2 duplicate trap pairs — each appears twice (4 cards per trap pair)
    // Correct: 3+18=21, 4+17=21. Trap: flipping (3,3),(18,18),(4,4),(17,17)
    var trapPairs = [[3,18],[4,17]];
    for (var i = 0; i < trapPairs.length; i++) {
      cards.push(new this.Card(trapPairs[i][0]));
      cards.push(new this.Card(trapPairs[i][1]));
      cards.push(new this.Card(trapPairs[i][0]));
      cards.push(new this.Card(trapPairs[i][1]));
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

      var isMatch = (this.currentRule === 'sum_target')
        ? (v0 + v1 === this.SUM_TARGET)
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
