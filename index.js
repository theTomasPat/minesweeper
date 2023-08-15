/*
	Cell definition:

	_abc dddd

	a - bool is flagged?
	b - bool is revealed?
	c - bool is a bomb?
	d - number of neighboring bombs
*/
const Difficulty  = {
	EASY: 0.123,
	MEDIUM: 0.156,
	HARD: 0.20
};

const CELL_WIDTH  = 8;
const CELL_HEIGHT = CELL_WIDTH;
const ROWS = 16;
const COLS = 28;
const BOMBCOUNT   = Math.floor(ROWS * COLS * Difficulty.MEDIUM);

const CELL_NEIGHBOR_MASK = 0b00001111;
const CELL_BOMB          = 0b00010000;
const CELL_REVEALED      = 0b00100000;
const CELL_FLAGGED       = 0b01000000;

const GAME_STATE = {
	NotStarted: 0,
	Running: 1,
	Ended: 2
};


const config = {
	type: Phaser.AUTO,
	parent: "phaserDiv",
	width: 240,
	height: 160,
	zoom: 2,
	pixelArt: true,
	backgroundColor: 0x868188,
	audio: {
		noAudio: true
	},
	scene: {
		preload: preload,
		create: create,
		update: update
	}
};

const game = new Phaser.Game(config);

function preload() {
	console.log("preload");

	this.load.image(
		"minesweeper_UI",
		"images/UI.png"
	);

	this.load.atlas(
		"minesweeper_tiles",
		"images/minesweeper_tiles.png",
		"images/minesweeper_tiles.json"
	);

	this.load.atlas(
		"UI_Font",
		"images/UI_Font.png",
		"images/UI_Font.json"
	);
}

function create() {
	// enable right-clicking
	this.input.mouse.disableContextMenu();

	// this.gameState keeps track of whether the user has started the game,
	// whether they're mid-game, or if the game is over
	this.gameState = GAME_STATE.NotStarted;
	this.gameTimer = 0;
	this.gameStartTime = 0;

	// create the UI background
	this.add.image(0,0,"minesweeper_UI").setOrigin(0,0);

	// create the big restart button
	this.add.image(
		95,2,
		"minesweeper_tiles",
		"minesweeper_button_restart"
	)
	.setOrigin(0,0)
	.setName("UI_Button")
	.setInteractive()
	.on('pointerdown', RestartGame);
	
	// create the game objects that will show the mine counter in the UI
	this.add.image(18, 6, "UI_Font", "UIFont_hyphen").setOrigin(0,0).setName("mineCounterHyphen");
	this.add.image(28, 6, "UI_Font", "UIFont_09").setOrigin(0,0).setName("mineCounterHundreds");
	this.add.image(40, 6, "UI_Font", "UIFont_09").setOrigin(0,0).setName("mineCounterTens");
	this.add.image(52, 6, "UI_Font", "UIFont_09").setOrigin(0,0).setName("mineCounterOnes");
	
	// create the game objects that will show the timer for the game
	this.add.image(181,6, "UI_Font", "UIFont_09").setOrigin(0,0).setName("timerHundreds");
	this.add.image(193,6, "UI_Font", "UIFont_09").setOrigin(0,0).setName("timerTens");
	this.add.image(205,6, "UI_Font", "UIFont_09").setOrigin(0,0).setName("timerOnes");

	// setup the game area
	const boardOriginX = 8;  //(this.game.config.width - COLS * CELL_WIDTH) / 2;
	const boardOriginY = 24; //(this.game.config.height - ROWS * CELL_HEIGHT) / 2;
	this.cellState = new Array(ROWS * COLS);
	this.cells = new Array(ROWS * COLS);

	// create all of the cells on the board
	for(let i = 0; i < this.cellState.length; i++) {
		// create a new gameobject for each tile
		let newGameObj = this.add.image(
			Math.floor(i % COLS) * CELL_WIDTH + boardOriginX,
			Math.floor(i / COLS) * CELL_HEIGHT + boardOriginY,
			"minesweeper_tiles",
			"minesweeper_default"
		);
		newGameObj.setOrigin(0,0);
		newGameObj.idx = i;
		newGameObj.setInteractive();
		newGameObj.on('pointerdown', RevealCell);
		this.cells[i] = newGameObj;
		this.cellState[i] = 0;
	}


	// Place bombs on the grid
	let bombIndices = [];
	for(let i = 0; i < BOMBCOUNT; i++) {
		// roll a random number in range [ 0, (ROWS*COLS) ]
		let idx = Math.floor(Math.random() * ROWS * COLS);
		while(bombIndices.includes(idx)) {
			// if that random index already exists in `bombIndices`,
			// roll again
			idx = Math.floor(Math.random() * ROWS * COLS);
		}

		// build up `bombIndices` to be `BOMBCOUNT` elements long
		bombIndices.push(idx);
	}
	for(let i = 0; i < bombIndices.length; i++) {
		// for each cell index in `bombIndices`, set that cell to be a bomb
		this.cellState[bombIndices[i]] |= CELL_BOMB;
	}


	// Count how many neighbors are bombs
	for(let i = 0; i < this.cellState.length; i++) {
		let neighbors = GetNeighborIndexes(this.cells[i]);
		this.cellState[i] |= neighbors.reduce(
			(acc, idx) => {
				return acc + ((this.cellState[idx] & CELL_BOMB) > 0 ? 1 : 0);
			},
			0
		);
	}
}

function update(time, delta) {
	//`time` is a high-res counter whose value is the number of milliseconds
	//since the scene was created
	if(this.gameState === GAME_STATE.Running && this.gameTimer < 999) {
		this.gameTimer = Math.floor((time - this.gameStartTime) / 1000);
	}
	
	// get a reference to each of the characters in the mine counter
	const mineCounterHyphen = this.children.getChildren().find(e => e.name === "mineCounterHyphen");
	const mineCounterHundreds = this.children.getChildren().find(e => e.name === "mineCounterHundreds");
	const mineCounterTens = this.children.getChildren().find(e => e.name === "mineCounterTens");
	const mineCounterOnes = this.children.getChildren().find(e => e.name === "mineCounterOnes");
	// the counter should show the number of mines on the field minus the
	// number of flagged cells
	const mineCounter = BOMBCOUNT - this.cellState.reduce(
		(acc, ele) => acc += ((ele & CELL_FLAGGED) > 0 ? 1 : 0),
		0 	// start the accumulator from 0
	);

	// draw the correct numbers in the mine counter
	mineCounterHyphen.setVisible((mineCounter < 0));
	mineCounterHundreds.setFrame(`UIFont_0${Math.floor(Math.abs(mineCounter) / 100)}`);
	mineCounterTens.setFrame(`UIFont_0${Math.floor(Math.abs(mineCounter) / 10) % 10}`);
	mineCounterOnes.setFrame(`UIFont_0${Math.abs(mineCounter) % 10}`);

	// get a reference to each of the characters in the timer
	const timerHundreds = this.children.getChildren().find(e => e.name === "timerHundreds");
	const timerTens = this.children.getChildren().find(e => e.name === "timerTens");
	const timerOnes = this.children.getChildren().find(e => e.name === "timerOnes");

	// draw the correct numbers in the timer
	timerHundreds.setFrame(`UIFont_0${Math.floor(Math.abs(this.gameTimer) / 100)}`);
	timerTens.setFrame(`UIFont_0${Math.floor(Math.abs(this.gameTimer) / 10) % 10}`);
	timerOnes.setFrame(`UIFont_0${Math.abs(this.gameTimer) % 10}`);
}

function RestartGame(event) {
	console.log("clicked restart");

	// `this` should the be reset button in the UI
	this.scene.scene.restart();
}


// given a cell's index, reveal all of its neighbors
function RevealNeighbors(cell) {
	let neighbors = GetNeighborIndexes(cell);
	for(let i = 0; i < neighbors.length; i++) {
		RevealCell.apply(cell.scene.cells[ neighbors[i] ]);
	}
}

function RevealCell(pointer, localX, localY, e) {
	if(this.scene.gameState === GAME_STATE.Ended) return;

	if(this.scene.gameState === GAME_STATE.NotStarted) {
		// make sure that the game is now running
		this.scene.gameStartTime = this.scene.time.now;
		this.scene.gameState = GAME_STATE.Running;
	}

	// get a reference to the UI button
	let uiButton = this.scene.children.getChildren().find(element => element.name === "UI_Button");

	// if this cell has already been revealed, exit early
	if((this.scene.cellState[this.idx] & CELL_REVEALED) > 0) {
		//console.log(this.scene.cellState[this.idx] & CELL_NEIGHBOR_MASK);
		return;
	}

	// check if the player right-clicked a cell
	if(pointer && pointer.rightButtonDown()) {
		if((this.scene.cellState[this.idx] & CELL_FLAGGED) == 0) {
			//cell isn't flagged, make it so
			this.scene.cellState[this.idx] |= CELL_FLAGGED;
			this.setFrame("minesweeper_flagged");
		}
		else {
			//cell was already flagged, clear it
			this.scene.cellState[this.idx] ^= CELL_FLAGGED;
			// draw default tile
			this.setFrame("minesweeper_default");
		}
	}
	// the player either left-clicked the cell, or we're recursively clearing neighbors
	else {
		// don't do anything if this cell has already been flagged
		if((this.scene.cellState[this.idx] & CELL_FLAGGED) > 0) return;

		// reveal this cell
		this.scene.cellState[this.idx] |= CELL_REVEALED;

		// if this cell is a bomb, game over
		if((this.scene.cellState[this.idx] & CELL_BOMB) > 0) {
			console.log("you clicked a bomb!");
			// show all of the bombs on the board
			for(let i = 0; i < this.scene.cellState.length; i++) {
				if((this.scene.cellState[i] & CELL_BOMB) > 0)
					this.scene.cells[i].setFrame("minesweeper_mine");
			}

			// show the game-over icon on the main button
			if(uiButton) uiButton.setFrame("minesweeper_button_lose");

			// set the new game state. this also has the side-effect of
			// disabling input
			this.scene.gameState = GAME_STATE.Ended;
		}
		else {
			// show this cell's neighbor count
			this.setFrame(
				`minesweeper_revealed_${this.scene.cellState[this.idx] & CELL_NEIGHBOR_MASK}`
			);

			// if this cell is empty, flood fill neighbors
			if((this.scene.cellState[this.idx] & CELL_NEIGHBOR_MASK) == 0) {
				RevealNeighbors(this);
			}
		}

		//console.log(this.scene.cellState[this.idx] & CELL_NEIGHBOR_MASK);
	}

	if(pointer) {
		// regardless of whether the player left- or right-clicked a cell,
		// we need to see if they've just made a winning move
		if(CheckWon(this.scene)) {
			// show the game-over icon on the main button
			if(uiButton) uiButton.setFrame("minesweeper_button_win");
			this.scene.gameState = GAME_STATE.Ended;
		}
	}
}

function CheckWon(scene) {
	return scene.cellState.every((cell) => {
		// each cell must either be clear and revealed, or a bomb and flagged

		if((cell & CELL_BOMB) === 0 && (cell & CELL_REVEALED) > 0) {
			return true;
		} else if((cell & CELL_BOMB) > 0 && (cell & CELL_FLAGGED) > 0) {
			return true;
		} else {
			return false;
		}
	});
}

function XYToIndex(x, y) {
	return y * COLS + x;
}

function IndexToXY(idx) {
	return {
		x: idx % COLS,
		y: Math.floor(idx / COLS)
	};
}

// given a cell index, return an array of indexes for the neighboring cells
// the neighbors are the surrounding 8 cells
function GetNeighborIndexes(cell) {
	let neighbors = [];
	let cellXY = IndexToXY(cell.idx);
	for(let j = -1; j <= 1; j++) {
		for(let k = -1; k <= 1; k++) {
			if(j === 0 && k === 0) continue;
			if(
				cellXY.x + j >= 0 &&
				cellXY.x + j < COLS && 
				cellXY.y + k >= 0 &&
				cellXY.y + k < ROWS
			  ) {
				neighbors.push(XYToIndex(cellXY.x + j, cellXY.y + k));
			}
		}
	}
	return neighbors;
}
