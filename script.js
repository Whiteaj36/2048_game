(function () {
  "use strict";

  const GRID_SIZE = 4;
  const CELL_GAP = 12;
  const SWIPE_THRESHOLD = 20;

  const tileContainer = document.getElementById("tile-container");
  const gridBackground = document.getElementById("grid-background");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const movesEl = document.getElementById("moves");
  const newGameBtn = document.getElementById("new-game-btn");
  const tryAgainBtn = document.getElementById("try-again-btn");
  const gameMessage = document.getElementById("game-message");
  const gameMessageText = document.getElementById("game-message-text");
  const boardWrapper = document.querySelector(".board-wrapper");

  let grid = [];
  let score = 0;
  let best = Number(localStorage.getItem("2048-best")) || 0;
  let moves = 0;
  let gameOver = false;
  let won = false;
  let tileIdCounter = 0;

  function createEmptyGrid() {
    const g = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      g.push(new Array(GRID_SIZE).fill(null));
    }
    return g;
  }

  function buildGridBackground() {
    gridBackground.innerHTML = "";
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      gridBackground.appendChild(cell);
    }
  }

  function getEmptyCells() {
    const cells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!grid[r][c]) cells.push({ r, c });
      }
    }
    return cells;
  }

  function addRandomTile() {
    const empty = getEmptyCells();
    if (empty.length === 0) return null;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = { id: ++tileIdCounter, value, r, c, isNew: true, merged: false };
    grid[r][c] = tile;
    return tile;
  }

  function startGame() {
    grid = createEmptyGrid();
    score = 0;
    moves = 0;
    gameOver = false;
    won = false;
    tileIdCounter = 0;
    gameMessage.classList.remove("show");
    addRandomTile();
    addRandomTile();
    updateScoreDisplay();
    render();
  }

  function updateScoreDisplay() {
    scoreEl.textContent = score;
    movesEl.textContent = moves;
    if (score > best) {
      best = score;
      localStorage.setItem("2048-best", String(best));
    }
    bestEl.textContent = best;
  }

  function cellMetrics() {
    const size = boardWrapper.clientWidth - CELL_GAP * 2;
    const cellSize = (size - CELL_GAP * (GRID_SIZE - 1)) / GRID_SIZE;
    return { cellSize, gap: CELL_GAP };
  }

  function render() {
    tileContainer.innerHTML = "";
    const { cellSize, gap } = cellMetrics();

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const tile = grid[r][c];
        if (!tile) continue;
        const el = document.createElement("div");
        el.className = "tile";
        el.dataset.value = tile.value;
        el.textContent = tile.value;
        el.style.width = cellSize + "px";
        el.style.height = cellSize + "px";
        el.style.left = c * (cellSize + gap) + "px";
        el.style.top = r * (cellSize + gap) + "px";
        el.style.lineHeight = cellSize + "px";
        if (tile.isNew) el.classList.add("tile-new");
        if (tile.merged) el.classList.add("tile-merged");
        tileContainer.appendChild(el);
      }
    }
  }

  function cloneGridValues(g) {
    return g.map((row) => row.map((tile) => (tile ? tile.value : 0)));
  }

  function gridsEqual(a, b) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (a[r][c] !== b[r][c]) return false;
      }
    }
    return true;
  }

  // Compresses and merges a single line (array of tiles/nulls) toward the front.
  function processLine(line) {
    const tiles = line.filter((t) => t !== null);
    const result = [];
    let gained = 0;
    for (let i = 0; i < tiles.length; i++) {
      const current = tiles[i];
      if (i + 1 < tiles.length && tiles[i + 1].value === current.value) {
        const mergedValue = current.value * 2;
        result.push({ id: ++tileIdCounter, value: mergedValue, isNew: false, merged: true });
        gained += mergedValue;
        i++;
      } else {
        result.push({ id: current.id, value: current.value, isNew: false, merged: false });
      }
    }
    while (result.length < GRID_SIZE) result.push(null);
    return { result, gained };
  }

  function getLine(direction, index) {
    const line = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      if (direction === "left") line.push(grid[index][i]);
      else if (direction === "right") line.push(grid[index][GRID_SIZE - 1 - i]);
      else if (direction === "up") line.push(grid[i][index]);
      else if (direction === "down") line.push(grid[GRID_SIZE - 1 - i][index]);
    }
    return line;
  }

  function setLine(direction, index, line) {
    for (let i = 0; i < GRID_SIZE; i++) {
      const tile = line[i];
      let r, c;
      if (direction === "left") { r = index; c = i; }
      else if (direction === "right") { r = index; c = GRID_SIZE - 1 - i; }
      else if (direction === "up") { r = i; c = index; }
      else if (direction === "down") { r = GRID_SIZE - 1 - i; c = index; }
      if (tile) { tile.r = r; tile.c = c; }
      grid[r][c] = tile;
    }
  }

  function move(direction) {
    if (gameOver) return;

    const before = cloneGridValues(grid);
    let gained = 0;

    for (let index = 0; index < GRID_SIZE; index++) {
      const line = getLine(direction, index);
      const { result, gained: lineGain } = processLine(line);
      gained += lineGain;
      setLine(direction, index, result);
    }

    const after = cloneGridValues(grid);
    const changed = !gridsEqual(before, after);

    if (!changed) return;

    moves += 1;
    score += gained;
    addRandomTile();
    updateScoreDisplay();
    render();

    if (gained > 0 && !won && hasTileValue(2048)) {
      won = true;
      showMessage("You win!");
    } else if (!canMove()) {
      gameOver = true;
      showMessage("Game over!");
    }
  }

  function hasTileValue(target) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] && grid[r][c].value === target) return true;
      }
    }
    return false;
  }

  function canMove() {
    if (getEmptyCells().length > 0) return true;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const value = grid[r][c].value;
        if (c + 1 < GRID_SIZE && grid[r][c + 1].value === value) return true;
        if (r + 1 < GRID_SIZE && grid[r + 1][c].value === value) return true;
      }
    }
    return false;
  }

  function showMessage(text) {
    gameMessageText.textContent = text;
    gameMessage.classList.add("show");
  }

  // Touch swipe handling
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  boardWrapper.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );

  boardWrapper.addEventListener(
    "touchmove",
    (e) => {
      if (touchActive) e.preventDefault();
    },
    { passive: false }
  );

  boardWrapper.addEventListener(
    "touchend",
    (e) => {
      if (!touchActive) return;
      touchActive = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) < SWIPE_THRESHOLD) return;

      if (absX > absY) {
        move(dx > 0 ? "right" : "left");
      } else {
        move(dy > 0 ? "down" : "up");
      }
    },
    { passive: true }
  );

  // Keyboard support for desktop testing
  window.addEventListener("keydown", (e) => {
    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const direction = keyMap[e.key];
    if (!direction) return;
    e.preventDefault();
    move(direction);
  });

  newGameBtn.addEventListener("click", startGame);
  tryAgainBtn.addEventListener("click", startGame);
  window.addEventListener("resize", render);

  buildGridBackground();
  startGame();
})();
