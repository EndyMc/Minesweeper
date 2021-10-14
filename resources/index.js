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
                width: parameters.width,
                height: parameters.height
            }

            this.numberOfBombs = Number(parameters.bombs);
        } else if (/^(easy|medium|hard)$/.test(difficulty)) {
            this.size = {
                width: Board.DEFAULT_BOARD[difficulty].width,
                height: Board.DEFAULT_BOARD[difficulty].height
            };
            
            this.numberOfBombs = Board.DEFAULT_BOARD[difficulty].bombs;
        } else {
            location.href = "http://" + location.host + location.pathname + "?diff=" + Board.DEFAULT_DIFFICULTY;
        }
        
        this.difficulty = difficulty;
        this.map = this.createMap();

        this.numberOfPlacedFlags = 0;

        this.hasLost = false;
        this.startTime = performance.now();

        this.checkedTiles = {};

        var root = document.querySelector(':root');

        root.style.setProperty('--board-width' , this.size.width );
        root.style.setProperty('--board-height', this.size.height);
    }

    createMap() {
        var map = [];
        var bombsLeftToPlace = this.numberOfBombs;
        for (var x = 0; x < this.size.width; x++) {
            map.push([]);
            for (var y = 0; y < this.size.height; y++) {
                var tilesLeft = ((this.size.width * this.size.height) - (x * this.size.height + y));
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
            tile.sprite.innerHTML = "<img src='images/mine.png' alt='M' style='color: red; width: 50%; height: 50%; left: calc((100% - 50%) / 2); top: calc((100% - 50%) / 2); position: relative;'></img>";

            if (!this.hasLost) {
                this.hasLost = true;
                board.visualizeWholeMap();
            }
        } else if (tile.numberOfBombs != 0) {
            tile.sprite.innerHTML = "<center style='color: " + (tile.numberOfBombs == 1 ? "green" : tile.numberOfBombs == 2 ? "aqua" : tile.numberOfBombs == 3 ? "orange" : "coral") + ";'>" + tile.numberOfBombs + "</center>";
            tile.sprite.children[0].style.top = "calc((100% - " + tile.sprite.children[0].offsetHeight + "px) / 2)";
        } else {
            if (this.checkedTiles[(x - 1) + ", " + (y)] == undefined && x - 1 >= 0) { this.checkedTiles[(x - 1) + ", " + (y)] = this.map[x - 1][y].numberOfBombs; this.visualizeMapAt(x - 1, y); }
            if (this.checkedTiles[(x + 1) + ", " + (y)] == undefined && x + 1 < this.size.width) { this.checkedTiles[(x + 1) + ", " + (y)] = this.map[x + 1][y].numberOfBombs; this.visualizeMapAt(x + 1, y); }
            if (this.checkedTiles[(x) + ", " + (y - 1)] == undefined && y - 1 >= 0) { this.checkedTiles[(x) + ", " + (y - 1)] = this.map[x][y - 1].numberOfBombs; this.visualizeMapAt(x, y - 1); }
            if (this.checkedTiles[(x) + ", " + (y + 1)] == undefined && y + 1 < this.size.height) { this.checkedTiles[(x) + ", " + (y + 1)] = this.map[x][y + 1].numberOfBombs; this.visualizeMapAt(x, y + 1); }
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
    document.getElementById('game-over-alert').style.display = "block";
    document.getElementById('background-dim').style.display = "block";

    var convertToTime = (timeInMilis) => timeInMilis == undefined || timeInMilis == null || timeInMilis == "-" ? "-" : (Math.floor(timeInMilis / (1000 * 60 * 60)) > 0 ? Math.floor(timeInMilis / (1000 * 60 * 60)) + "h, " : "") + (Math.floor(timeInMilis / (1000 * 60) % 60) > 0 ? Math.floor(timeInMilis / (1000 * 60) % 60) + "m, " : "") + Math.floor(timeInMilis / (1000) % 60) + "s";

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

        document.getElementById('time-taken').innerText = "Time taken: " + convertToTime(endTime - board.startTime);
    } else {
        document.getElementById('time-taken').innerText = "Time taken: -";
    }

    document.getElementById('best-time').innerText = "Best time: " + convertToTime(bestTime["width: " + board.size.width + ", height: " + board.size.height + ", bombs: " + board.numberOfBombs]);
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
            board.visualizeMapAt(this.position.x, this.position.y);
        }

        sprite.oncontextmenu = (ev) => {
            ev.preventDefault();

            if (this.isVisualized) return;

            this.isFlagged = !this.isFlagged;
            if (this.isFlagged) {
                this.sprite.innerHTML = "<img style='color: red; position: relative;' src='images/flag.png' alt='F' width='" + (this.sprite.offsetWidth * 0.5) + "' height='" + (this.sprite.offsetHeight * 0.5) + "'>"

                this.sprite.children[0].style.top = "calc((100% - " + this.sprite.children[0].offsetHeight + "px) / 2)";
                this.sprite.children[0].style.left = "calc((100% - " + this.sprite.children[0].offsetWidth + "px) / 2)";

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

function init() {
    var diff = parseParameters().diff;

    if (diff == undefined) location = location.pathname + "?diff=" + Board.DEFAULT_DIFFICULTY;

    document.getElementsByTagName('board')[0].innerHTML = "";

    document.getElementById('game-over-alert').style.display = "none";
    document.getElementById('background-dim').style.display = "none";

    window.board = new Board(diff);
}
