"use strict";
class Board {
    static DEFAULT_DIFFICULTY = "medium";
    static DEFAULT_BOARD = {
        easy: {
            width: 10,
            height: 8,
            
            bombs: 10
        },

        medium: {
            width: 18,
            height: 14,

            bombs: 40
        },

        hard: {
            width: 24,
            height: 20,

            bombs: 80
        }
    };

    constructor(difficulty = Board.DEFAULT_DIFFICULTY) {
        if (difficulty == "custom") {
            var parameters = parseParameters();

            this.size = {
                width: Number(parameters.width),
                height: Number(parameters.height)
            }

            if (parameters.width == undefined || parameters.height == undefined) {
                location = location.pathname + "?diff=" + Board.DEFAULT_DIFFICULTY;
            }

            this.numberOfBombs = parameters.bombs == undefined ? Math.ceil(this.size.width * this.size.height / 5) : Number(parameters.bombs);
        } else if (/^(easy|medium|hard)$/.test(difficulty)) {
            this.size = {
                width: Board.DEFAULT_BOARD[difficulty].width,
                height: Board.DEFAULT_BOARD[difficulty].height
            };
            
            this.numberOfBombs = Board.DEFAULT_BOARD[difficulty].bombs;
        } else {
            location = location.pathname + "?diff=" + Board.DEFAULT_DIFFICULTY;
        }
        
        this.difficulty = difficulty;
        this.map = this.createMap();

        this.numberOfPlacedFlags = 0;

        this.hasLost = false;
        this.hasStarted = false;

        this.startTime = performance.now();
        var clock = document.getElementById('time-display');

        this.clockInterval = setInterval(() => {
            var time = performance.now() - this.startTime;
            var hours = "" + Math.floor(time / 1000 / 60 / 60);
            var minutes = "" + Math.floor(time / 1000 / 60 % 60);
            var seconds = "" + Math.floor(time / 1000 % 60);
            clock.innerText = (hours.length == 1 ? "0" + hours : hours) + ":" + (minutes.length == 1 ? "0" + minutes : minutes) + ":" + (seconds.length == 1 ? "0" + seconds : seconds);
        }, 100);

        this.checkedTiles = {};

        var root = document.querySelector(':root');

        root.style.setProperty('--board-width' , this.size.width );
        root.style.setProperty('--board-height', this.size.height);
    }

    createMap(tilesToExclude = []) {
        var map = [];
        var bombsLeftToPlace = this.numberOfBombs;
        for (var x = 0; x < this.size.width; x++) {
            map.push([]);
            for (var y = 0; y < this.size.height; y++) {
                var tilesLeft = ((this.size.width * this.size.height) - (x * this.size.height + y) - tilesToExclude.length);
                if (tilesToExclude.some((tile) =>  tile.x == x && tile.y == y )) {
                    map[x].push(new NumberTile(x, y))
                    continue;
                }

                if (Math.random() < bombsLeftToPlace / tilesLeft) {
                    bombsLeftToPlace--;
                    map[x].push(new BombTile(x, y));
                } else {
                    map[x].push(new NumberTile(x, y));
                }
            }
        }

        for (var x = 0; x < this.size.width; x++) {
            for (var y = 0; y < this.size.height; y++) {
                map[x][y].numberOfBombs = getNumberOfBombs(x, y, map);
            }
        }

        return map;
    }

    updateFlags() {
        var correctFlags = [];
        for (var x = 0; x < this.size.width; x++) {
            for (var y = 0; y < this.size.height; y++) {
                var tile = this.map[x][y];
                if (tile.isFlagged) {
                    if (tile.isBomb) {
                        correctFlags.push(tile);
                        tile.sprite.style.backgroundColor = tile.sprite.style.backgroundColor == "rgb(0, 192, 192)" || tile.sprite.style.backgroundColor == "rgb(255, 255, 255)" ? "#FFFFFF" : "#F0F0F0";
                    } else {
                        tile.sprite.style.backgroundColor = "orange";
                        tile.sprite.style.opacity = "0.75";
                    }
                }
            }
        }

        return correctFlags;
    }

    visualizeWholeMap() {
        for (var x = 0; x < this.size.width; x++) {
            for (var y = 0; y < this.size.height; y++) {
                this.visualizeMapAt(x, y);

                var tile = this.map[x][y];

                tile.sprite.style.cursor = "default";

                tile.sprite.onclick = () => {};
                tile.sprite.oncontextmenu = (ev) => { ev.preventDefault(); return false; };

            }
        }

        this.updateFlags();

        displayGameOver();
    }

    visualizeMapAt(x, y) {
        if (x == undefined || y == undefined) return;
        if (this.map[x][y].isFlagged) return;

        var tile = this.map[x][y];

        tile.isVisualized = true;
        
        if (tile.isBomb) {
            tile.sprite.innerHTML = "<img src='images/mine.png' alt='M' style='color: red; width: 50%; height: 50%;'></img>";

            if (!this.hasLost) {
                this.hasLost = true;
                board.visualizeWholeMap();
            }
        } else if (tile.numberOfBombs != 0) {
            tile.sprite.innerHTML = "<center style='color: " + (tile.numberOfBombs == 1 ? "green" : tile.numberOfBombs == 2 ? "aqua" : tile.numberOfBombs == 3 ? "orange" : "coral") + ";'>" + tile.numberOfBombs + "</center>";
        } else {
            // Check cardinal directions
            if (this.checkedTiles[(x - 1) + ", " + (y)] == undefined && x - 1 >= 0) { this.checkedTiles[(x - 1) + ", " + (y)] = this.map[x - 1][y].numberOfBombs; this.visualizeMapAt(x - 1, y); }
            if (this.checkedTiles[(x + 1) + ", " + (y)] == undefined && x + 1 < this.size.width) { this.checkedTiles[(x + 1) + ", " + (y)] = this.map[x + 1][y].numberOfBombs; this.visualizeMapAt(x + 1, y); }
            if (this.checkedTiles[(x) + ", " + (y - 1)] == undefined && y - 1 >= 0) { this.checkedTiles[(x) + ", " + (y - 1)] = this.map[x][y - 1].numberOfBombs; this.visualizeMapAt(x, y - 1); }
            if (this.checkedTiles[(x) + ", " + (y + 1)] == undefined && y + 1 < this.size.height) { this.checkedTiles[(x) + ", " + (y + 1)] = this.map[x][y + 1].numberOfBombs; this.visualizeMapAt(x, y + 1); }

            // Check diagonals
            if (this.checkedTiles[(x - 1) + ", " + (y - 1)] == undefined && x - 1 >= 0 && y - 1 >= 0) { this.checkedTiles[(x - 1) + ", " + (y - 1)] = this.map[x - 1][y - 1].numberOfBombs; this.visualizeMapAt(x - 1, y - 1); }
            if (this.checkedTiles[(x + 1) + ", " + (y + 1)] == undefined && x + 1 < this.size.width && y + 1 < this.size.height) { this.checkedTiles[(x + 1) + ", " + (y + 1)] = this.map[x + 1][y + 1].numberOfBombs; this.visualizeMapAt(x + 1, y + 1); }
            if (this.checkedTiles[(x - 1) + ", " + (y + 1)] == undefined && x - 1 >= 0 && y + 1 < this.size.height) { this.checkedTiles[(x - 1) + ", " + (y + 1)] = this.map[x - 1][y + 1].numberOfBombs; this.visualizeMapAt(x - 1, y + 1); }
            if (this.checkedTiles[(x + 1) + ", " + (y - 1)] == undefined && x + 1 < this.size.width && y - 1 >= 0) { this.checkedTiles[(x + 1) + ", " + (y - 1)] = this.map[x + 1][y - 1].numberOfBombs; this.visualizeMapAt(x + 1, y - 1); }
        }

        tile.sprite.style.cursor = "default";
        
        tile.sprite.onclick = () => {};
        tile.sprite.oncontextmenu = (ev) => { ev.preventDefault(); return false; };
        
        
        tile.sprite.style.backgroundColor = tile.sprite.style.backgroundColor == "rgb(0, 192, 192)" || tile.sprite.style.backgroundColor == "rgb(255, 255, 255)" ? "#FFFFFF" : "#F0F0F0";

        if (!this.hasLost) {
            for (var x = 0; x < this.size.width; x++) {
                for (var y = 0; y < this.size.height; y++) {
                    if (!this.map[x][y].isVisualized && !this.map[x][y].isBomb) {
                        return;
                    }
                }
            }
        }

        displayGameOver();
    }
}

function displayGameOver() {
    var gameOverAlert = document.getElementById("game-over-alert");
    var backgroundDim = document.getElementById("background-dim");

    var timeTakenText = document.getElementById('time-taken');
    var bestTimeText = document.getElementById('best-time');
    var timeDisplay = document.getElementById("time-display");

    gameOverAlert.style.display = "block";
    backgroundDim.style.display = "block";

    var convertToTime = (timeInMilis) => timeInMilis == undefined || timeInMilis == null || timeInMilis == "-" ? "-" : (Math.floor(timeInMilis / (1000 * 60 * 60)) > 0 ? Math.floor(timeInMilis / (1000 * 60 * 60)) + "h, " : "") + (Math.floor(timeInMilis / (1000 * 60) % 60) > 0 ? Math.floor(timeInMilis / (1000 * 60) % 60) + "m, " : "") + Math.floor(timeInMilis / (1000) % 60) + "s";

    { // Update the clock one last time, so that there isn't a mismatch between the time in the game-over menu and there
        clearInterval(board.clockInterval);

        var time = performance.now() - board.startTime;
        var hours = "" + Math.floor(time / 1000 / 60 / 60);
        var minutes = "" + Math.floor(time / 1000 / 60 % 60);
        var seconds = "" + Math.floor(time / 1000 % 60);

        timeDisplay.innerText = (hours.length == 1 ? "0" + hours : hours) + ":" + (minutes.length == 1 ? "0" + minutes : minutes) + ":" + (seconds.length == 1 ? "0" + seconds : seconds);
    }

    if (localStorage.getItem('best-time') == null) {
        localStorage.setItem('best-time', JSON.stringify({}));
    }
    
    var bestTime = JSON.parse(localStorage.getItem('best-time'));
    if (!board.hasLost) {
        var endTime = performance.now();

        if (bestTime["width: " + board.size.width + ", height: " + board.size.height + ", bombs: " + board.numberOfBombs] == undefined || endTime - board.startTime < Number(bestTime["width: " + board.size.width + ", height: " + board.size.height + ", bombs: " + board.numberOfBombs])) {
            bestTime["width: " + board.size.width + ", height: " + board.size.height + ", bombs: " + board.numberOfBombs] = endTime - board.startTime;
            localStorage.setItem("best-time", JSON.stringify(bestTime));
        }

        timeTakenText.innerText = "Time taken: " + convertToTime(endTime - board.startTime);
    } else {
        timeTakenText.innerText = "Time taken: -";
    }

    bestTimeText.innerText = "Best time: " + convertToTime(bestTime["width: " + board.size.width + ", height: " + board.size.height + ", bombs: " + board.numberOfBombs]);
}

function getNumberOfBombs(x, y, map = board.map) {
    var numberOfBombs = 0;

    var width = map.length - 1;
    var height = map[x].length - 1;

    if (x > 0      && map[x - 1][y].isBomb) numberOfBombs++; 
    if (y > 0      && map[x][y - 1].isBomb) numberOfBombs++; 
    if (x < width  && map[x + 1][y].isBomb) numberOfBombs++; 
    if (y < height && map[x][y + 1].isBomb) numberOfBombs++; 

    if (x > 0 && y > 0          && map[x - 1][y - 1].isBomb) numberOfBombs++; 
    if (x < width && y > 0      && map[x + 1][y - 1].isBomb) numberOfBombs++; 
    if (x > 0 && y < height     && map[x - 1][y + 1].isBomb) numberOfBombs++; 
    if (x < width && y < height && map[x + 1][y + 1].isBomb) numberOfBombs++; 

    return numberOfBombs;
}

class Tile {
    constructor(x, y, isBomb) {
        this.position = { x: x, y: y };
        
        this.isFlagged = false;
        this.isBomb = isBomb;

        this.sprite = this.createSprite();
    }

    createSprite() {
        var sprite = document.createElement('tile');

        sprite.style.left = "calc(var(--width) * " + this.position.x + ")";
        sprite.style.top =  "calc(var(--height) * " + this.position.y + ")";

        sprite.style.backgroundColor = (this.position.x + this.position.y) % 2 == 0 ? "#00a6a6" : "#00C0C0";

        document.getElementsByTagName('board')[0].appendChild(sprite);

        sprite.onclick = () => {
            if (!board.hasStarted) {
                board.hasStarted = true;
                // Make it so that there aren't any bombs in the tile which the player clicked on
                // and in the tiles closest to the player.
                var tilesToExclude = [
                    { x: this.position.x - 1, y: this.position.y - 1 },
                    { x: this.position.x + 0, y: this.position.y - 1 },
                    { x: this.position.x + 1, y: this.position.y - 1 },
                    
                    { x: this.position.x - 1, y: this.position.y + 0 },
                    { x: this.position.x + 0, y: this.position.y + 0 },
                    { x: this.position.x + 1, y: this.position.y + 0 },
                    
                    { x: this.position.x - 1, y: this.position.y + 1 },
                    { x: this.position.x + 0, y: this.position.y + 1 },
                    { x: this.position.x + 1, y: this.position.y + 1 },
                ];
                
                // Remove all listed tiles which are offscreen, as to not break anything
                tilesToExclude.filter((value) => value.x >= 0 && value.x < board.size.width && value.y >= 0 && value.y < board.size.height);
                
                // Generate a new board with the condition that these tiles aren't bombs
                board.map = board.createMap(tilesToExclude);
                board.visualizeMapAt(this.position.x, this.position.y);
            } else {
                board.visualizeMapAt(this.position.x, this.position.y);
            }
        }

        sprite.oncontextmenu = (ev) => {
            ev.preventDefault();

            if (this.isVisualized) return;

            this.isFlagged = !this.isFlagged;
            if (this.isFlagged) {
                this.sprite.innerHTML = "<img style='color: red; position: relative;width:50%;height:50%;' src='images/flag.png' alt='F'>";

                board.numberOfPlacedFlags++;
            } else {
                this.sprite.innerHTML = "";

                board.numberOfPlacedFlags--;
            }

            return false;
        }

        return sprite;
    }
}

class BombTile extends Tile {
    constructor(x, y) {
        super(x, y, true);
    }
}

class NumberTile extends Tile {
    constructor(x, y) {
        super(x, y, false);
        this.numberOfBombs = -1;
    }
}

function parseParameters() {
    var parameters = {};

    if (location.href.replace(/[^\?]/g, "").length == 1) {
        location.href
            .split("?")[1]
            .split("&")
                .forEach((parameter) => {
                    if (parameter.replace(/[^=]/g, "").length == 1) {
                        parameters[parameter.split("=")[0]] = parameter.split("=")[1];
                    }
                });
    }

    return parameters;
}

function openSettings() {
    var settingsAlert = document.getElementById('settings-alert');
    var gameOverAlert = document.getElementById('game-over-alert');

    settingsAlert.style.display = "flex";
    gameOverAlert.style.display = "none";

    var difficulty = parseParameters().diff;

    document.getElementById(difficulty).selected = "selected";

    var onblur = (ev, word, number) => {
        if (!/^\d*$/.test(ev.target.value)) {
            ev.target.value = "";
            ev.target.placeholder = "Invalid input, please use digits only";
        } else if (Number(ev.target.value) >= number) {
            ev.target.value = "";
            ev.target.placeholder = "Invalid input, the max " + word + " is: " + number;
        }
    };

    // Handle non-digit input, and make sure that the user doesn't blow their computer.
    // Even 1000x1000 with 10000 mines is enough for firefox to use 8GB ram and still crash.
    document.getElementById("width-settings-input").onblur = (ev) => onblur(ev, "width", 1000);
    document.getElementById("height-settings-input").onblur = (ev) => onblur(ev, "height", 1000);
    document.getElementById("bombs-settings-input" ).onblur = (ev) => onblur(ev, "mines", 10000);

    difficultyListChanged();
}

function difficultyListChanged() {
    var difficulty = document.getElementById("diffs-list").value;
    
    if (difficulty != "custom") {
        document.getElementById("width-settings-input").placeholder = "Width: " + Board.DEFAULT_BOARD[difficulty].width;
        document.getElementById("width-settings-input").disabled = "disabled";
    } else {
        document.getElementById("width-settings-input").placeholder = "Insert new Width (Current: " + board.size.width + ")";
        document.getElementById("width-settings-input").disabled = undefined;
    }
    
    if (difficulty != "custom") {
        document.getElementById("height-settings-input").placeholder = "Height: " + Board.DEFAULT_BOARD[difficulty].height;
        document.getElementById("height-settings-input").disabled = "disabled";
    } else {
        document.getElementById("height-settings-input").placeholder = "Insert new Height (Current: " + board.size.height + ")";
        document.getElementById("height-settings-input").disabled = undefined;
    }
    
    if (difficulty != "custom") {
        document.getElementById("bombs-settings-input").placeholder = "Bombs: " + Board.DEFAULT_BOARD[difficulty].bombs;
        document.getElementById("bombs-settings-input").disabled = "disabled";
    } else {
        document.getElementById("bombs-settings-input").placeholder = "Insert new Bombs (Current: " + board.numberOfBombs + ")";
        document.getElementById("bombs-settings-input").disabled = undefined;
    }
}

function applySettingsChanges() {
    // Change the difficulty if it was changed
    var width = document.getElementById("width-settings-input").value;
    width = width == "" ? board.size.width : width;

    var height = document.getElementById("height-settings-input").value;
    height = height == "" ? board.size.height : height;

    var bombs = document.getElementById("bombs-settings-input").value;
    bombs = bombs == "" ? board.numberOfBombs : bombs;

    if (board.difficulty != document.getElementById('diffs-list').value || (board.difficulty == "custom" && (width != board.size.width || height != board.size.height || bombs != board.numberOfBombs))) difficultyChange();

    // If the site hasn't reloaded yet, close this menu and open the game-over menu instead
    closeSettings();
}

function difficultyChange() {
    var difficulty = document.getElementById('diffs-list').value;

    // Changes the location, and with that also changes the difficulty
    if (difficulty == "custom") {
        var width = document.getElementById("width-settings-input").value;
        width = width == "" ? board.size.width : width;

        var height = document.getElementById("height-settings-input").value;
        height = height == "" ? board.size.height : height;

        var bombs = document.getElementById("bombs-settings-input").value;
        bombs = bombs == "" ? board.numberOfBombs : bombs;

        location = location.pathname + "?diff=" + difficulty + "&width=" + width + "&height=" + height + "&bombs=" + bombs;
    } else {
        location = location.pathname + "?diff=" + difficulty;
    }
}

function closeSettings() {
    var settingsAlert = document.getElementById('settings-alert');
    var gameOverAlert = document.getElementById('game-over-alert');

    settingsAlert.style.display = "none";
    gameOverAlert.style.display = "block";
}

function init() {
    var diff = parseParameters().diff;

    if (diff == undefined) location = location.pathname + "?diff=" + Board.DEFAULT_DIFFICULTY;

    document.getElementsByTagName('board')[0].innerHTML = "";

    document.getElementById('game-over-alert').style.display = "none";
    document.getElementById('background-dim').style.display = "none";

    window.board = new Board(diff);
}