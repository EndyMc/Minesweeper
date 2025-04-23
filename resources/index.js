"use strict";


document.oncontextmenu = (ev) => { ev.preventDefault(); return false; };

var pressedKeys = {};
document.onkeydown = (ev) => { pressedKeys[ev.key] = true; };
document.onkeyup = (ev) => { pressedKeys[ev.key] = undefined; };

class Board {
    static DEFAULT_DIFFICULTY = "medium";
    static COLORS = [ "green", "purple", "orange", "red", "blue", "black", "#BB7E8C", "gray" ]
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
            var settings = Settings.get().difficulty;

            /**
             * @type {{width: number, height: number}}
             */
            this.size = {
                width: Number(settings.width),
                height: Number(settings.height)
            }

            if (settings.width == undefined || settings.height == undefined) {
                Settings.save({
                    difficulty: {
                        name: Board.DEFAULT_DIFFICULTY,

                        width: settings.width || Board.DEFAULT_BOARD[Board.DEFAULT_DIFFICULTY].width,
                        height: settings.height || Board.DEFAULT_BOARD[Board.DEFAULT_DIFFICULTY].height,

                        bombs: settings.bombs || Board.DEFAULT_BOARD[Board.DEFAULT_DIFFICULTY].bombs
                    }
                });
                location.reload();
            }

            /**
             * @type {number}
             */
            this.numberOfBombs = settings.bombs == undefined ? Math.ceil(this.size.width * this.size.height / 5) : Number(settings.bombs);
        } else if (/^(easy|medium|hard)$/.test(difficulty)) {
            this.size = {
                width: Board.DEFAULT_BOARD[difficulty].width,
                height: Board.DEFAULT_BOARD[difficulty].height
            };
            
            this.numberOfBombs = Board.DEFAULT_BOARD[difficulty].bombs;
        }
        
        /**
         * @type {"easy"|"medium"|"hard"|"custom"}
         */
        this.difficulty = difficulty;

        /**
         * @type {Tile[][]}
         */
        this.map = this.createMap();

        /**
         * @type {number}
         */
        this.numberOfPlacedFlags = 0;

        document.getElementById('flag-counter-text').innerText =  this.numberOfPlacedFlags + "/" + this.numberOfBombs;

        /**
         * @type {boolean}
         */
        this.hasLost = false;

        /**
         * @type {boolean}
         */
        this.hasWon = false;

        /**
         * @type {boolean}
         */
        this.hasStarted = false;

        this.checkedTiles = {};

        var root = document.querySelector(':root');

        root.style.setProperty('--board-width' , this.size.width );
        root.style.setProperty('--board-height', this.size.height);
    }

    /**
     * 
     * @param {{x: number, y: number}[]} tilesToExclude 
     * @returns {Tile[][]}
     */
    createMap(tilesToExclude = []) {
        // Clear tiles
        document.querySelector("board").innerHTML = "";

        // Reset flag counter
        this.numberOfPlacedFlags = 0;
        document.getElementById('flag-counter-text').innerText =  this.numberOfPlacedFlags + "/" + this.numberOfBombs;

        // Reset timer
        document.getElementById('time-display').innerText = "00:00:00";

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
            }
        }

        this.updateFlags();

        displayGameOver();
    }

    visualizeMapAt(x, y) {
        if (this.isVisualized) return;
        if (x == undefined || y == undefined) return;
        
        var tile = this.map[x][y];
        if (tile.isFlagged) return;

        tile.isVisualized = true;

        /**
         * When an already revealed tile is clicked it will reveal all nearby tiles if enough flags have been placed
         */
        tile.sprite.onmousedown = (ev) => {
            // Only accept Left-Clicks
            if (ev.button != 0) return;

            var flaggedBombs = 0;
            x = tile.position.x;
            y = tile.position.y;

            for (var dx = -1; dx <= 1; dx++) {
                for (var dy = -1; dy <= 1; dy++) {
                    if (x + dx < 0 || y + dy < 0 || x + dx > this.size.width - 1 || y + dy > this.size.height - 1) continue;
                    if (this.map[x + dx][y + dy].isFlagged) {
                        flaggedBombs += 1;
                        if (flaggedBombs >= tile.numberOfBombs) break;
                    }
                }
            }

            if (flaggedBombs >= tile.numberOfBombs) {
                for (var dx = -1; dx <= 1; dx++) {
                    for (var dy = -1; dy <= 1; dy++) {
                        if (x + dx < 0 || y + dy < 0 || x + dx > this.size.width - 1 || y + dy > this.size.height - 1) continue;
                        if (!this.map[x + dx][y + dy].isFlagged) {
                            this.visualizeMapAt(x + dx, y + dy);
                        }
                    }
                }
            }
        };

        tile.sprite.style.cursor = "default";

        if (tile.isBomb) {
            tile.sprite.innerHTML = "<img src='images/mine.png' alt='M' style='color: red; width: 50%; height: 50%;'></img>";
            
            if (!this.hasWon && !this.hasLost) {
                this.hasLost = true;
                board.visualizeWholeMap();

                tile.sprite.style.backgroundColor = "orange";
                tile.sprite.style.opacity = 0.75;

                return;
            }

        } else if (tile.numberOfBombs != 0) {
            tile.sprite.style.color = Board.COLORS[tile.numberOfBombs - 1];
            tile.sprite.style.cursor = "pointer";
            tile.sprite.innerHTML = "<span>" + tile.numberOfBombs + "</span>";
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
        
        tile.sprite.style.backgroundColor = tile.sprite.style.backgroundColor == "rgb(0, 192, 192)" || tile.sprite.style.backgroundColor == "rgb(255, 255, 255)" ? "#FFFFFF" : "#F0F0F0";

        if (!this.hasLost && !this.hasWon) {
            for (var x = 0; x < this.size.width; x++) {
                for (var y = 0; y < this.size.height; y++) {
                    if (!this.map[x][y].isVisualized && !this.map[x][y].isBomb) {
                        return;
                    }
                }
            }
            this.hasWon = true;
            this.visualizeWholeMap();
        }
    }
}

function newLeaderboardTime (date, username, time) {
    var gameOverLeaderboard = document.getElementById("game-over-leaderboard");
    var leaderboardRow = document.createElement("div");
    var leaderboardIndex = document.createElement("div");
    var leaderboardDate = document.createElement("div");
    var leaderboardName = document.createElement("div");
    var leaderboardTime = document.createElement("div");

    leaderboardRow.className = "leaderboard-row";
    leaderboardIndex.className = "leaderboard-index";
    leaderboardDate.className = "leaderboard-date";
    leaderboardName.className = "leaderboard-name";
    leaderboardTime.className = "leaderboard-time";

    leaderboardRow.style.setProperty("--index", "" + gameOverLeaderboard.childElementCount);
    leaderboardIndex.style.color = "black";
    leaderboardDate.style.color = "black";
    leaderboardName.style.color = "black";
    leaderboardTime.style.color = "black";

    if (gameOverLeaderboard.childElementCount == 0) {
        leaderboardRow.style.backgroundColor =  time == "Failed" ? "red" : "#0D3";
    } else if (gameOverLeaderboard.childElementCount == 1) {
        leaderboardRow.style.backgroundColor = "gold";
    } else if (gameOverLeaderboard.childElementCount == 2) {
        leaderboardRow.style.backgroundColor = "silver";
    } else if (gameOverLeaderboard.childElementCount == 3) {
        leaderboardRow.style.backgroundColor = "#CD7E32";
    } else if (gameOverLeaderboard.childElementCount % 2 == 1) {
        leaderboardRow.style.backgroundColor = "#DDD";
    }

    leaderboardIndex.innerText = "" + (gameOverLeaderboard.childElementCount == 0 ? "Latest" : gameOverLeaderboard.childElementCount);
    leaderboardTime.innerText = time;
    
    gameOverLeaderboard.appendChild(leaderboardRow);
    leaderboardRow.appendChild(leaderboardIndex);

    if (date != undefined) {
        leaderboardDate.innerText = date == "-" ? date : new Date(date).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", year: "numeric", day: "2-digit", timeZone: "UTC" });
        leaderboardRow.appendChild(leaderboardDate);
    }

    if (username != undefined) {
        leaderboardName.innerText = username;
        leaderboardRow.appendChild(leaderboardName);
    }

    leaderboardRow.appendChild(leaderboardTime);

    leaderboardRow.style.gridTemplateColumns = "10% repeat(" + (leaderboardRow.childElementCount - 1) + ", 1fr)";
}

async function displayGameOver() {
    var gameOverAlert = document.getElementById("game-over-alert");
    var backgroundDim = document.getElementById("background-dim");
    var timeDisplay = document.getElementById("time-display");

    gameOverAlert.style.display = "block";
    backgroundDim.style.display = "block";

    window.convertToTime = (timeInMilis) => {
        if (timeInMilis == undefined || timeInMilis == null || timeInMilis == "-") return "-";
        
        var hours = Math.floor(timeInMilis / (1000 * 60 * 60));
        var minutes = Math.floor(timeInMilis / (1000 * 60) % 60);
        var seconds = Math.floor(timeInMilis / (1000) % 60);
        var milliseconds = String(Math.floor(timeInMilis % 1000));

        while (milliseconds.length < 3) {
            milliseconds = "0" + milliseconds;
        }

        return (hours > 0 ? hours + "h, " : "") + (minutes > 0 ? minutes + "m, " : "") + seconds + "s" + (timeInMilis > 60 * 1000 ? "" : " " + milliseconds + "ms");
    };

    { // Update the clock one last time, so that there isn't a mismatch between the time in the game-over menu and there
        clearInterval(board.clockInterval);

        var time = performance.now() - board.startTime;
        if (!isNaN(time)) {
            var hours = "" + Math.floor(time / 1000 / 60 / 60);
            var minutes = "" + Math.floor(time / 1000 / 60 % 60);
            var seconds = "" + Math.floor(time / 1000 % 60);
            
            timeDisplay.innerText = (hours.length == 1 ? "0" + hours : hours) + ":" + (minutes.length == 1 ? "0" + minutes : minutes) + ":" + (seconds.length == 1 ? "0" + seconds : seconds);
        }
    }

    Leaderboard.local.clearNullScores(board.difficulty);

    var gameOverLeaderboard = document.getElementById("game-over-leaderboard");
    var bestTime = Leaderboard.local.get(board.difficulty);

    gameOverLeaderboard.innerHTML = "";

    if (!board.hasLost) {
        board.endTime = performance.now();

        var elem = document.createElement("h2");
        elem.innerText = "Submitting score";
        elem.style.gridRow = "2/11";
        gameOverLeaderboard.appendChild(elem);
        
        newLeaderboardTime(undefined, undefined, isNaN(board.endTime - board.startTime) ? "Please submit a score" : convertToTime(board.endTime - board.startTime));

        if (board.difficulty != "custom" && !isNaN(board.startTime)) {
            if (bestTime == undefined) {
                // Set this to an array
                bestTime = [];
            } else if (typeof bestTime != "object") {
                // Parse old scores to this new format
                var time = Number(bestTime);
                bestTime = [];
                if (!isNaN(time)) {
                    Leaderboard.local.submit(time, board.difficulty);
                }
            }

            Leaderboard.local.submit(board.endTime - board.startTime, board.difficulty);

            if (Settings.get()?.login?.username != undefined && Settings.get()?.login?.hash != undefined) {
                try {
                    // We only need to prioritise the submission of this score if it's going to be shown in the next step
                    // Otherwise, there's no reason to wait for this to finish before showing the local leaderboard
                    if (window.showGlobalLeaderboard) {
                        await Leaderboard.global.submit(board.endTime - board.startTime, board.difficulty);
                    } else {
                        Leaderboard.global.submit(board.endTime - board.startTime, board.difficulty);
                    }
                } catch(err) {}
            }
        }

        gameOverLeaderboard.removeChild(elem);
    } else {
        newLeaderboardTime(undefined, undefined, "Failed", "black", "red");
    }

    displayLeaderboard();
}

async function displayLeaderboard() {
    var image = document.getElementById("change-leaderboard-icon");

    window.changeLeaderboardCooldown = window.changeLeaderboardCooldown || false;
    if (window.changeLeaderboardCooldown) {
        return;
    } else {
        window.changeLeaderboardCooldown = true;
        setTimeout(() => {
            window.changeLeaderboardCooldown = false;
            image.style.filter = "";
            image.style.cursor = "";
        }, 500);
    }

    var gameOverLeaderboard = document.getElementById('game-over-leaderboard');
    var gameOverHeader = document.getElementById("game-over-header");
    
    image.style.filter = "invert(30%)";
    image.style.cursor = "not-allowed";

    gameOverHeader.innerText = board.difficulty[0].toUpperCase() + board.difficulty.substring(1) + " (" + (window.showGlobalLeaderboard ? "Global" : "Local") + ")";
    gameOverLeaderboard.innerHTML = '';

    document.getElementById("change-leaderboard-icon").src = !window.showGlobalLeaderboard ? "images/local.png" : "images/globe.png";

    // Latest
    if (!board.hasLost) {
        newLeaderboardTime(undefined, undefined, (isNaN(board.endTime - board.startTime) ? "Please submit a score" : convertToTime(board.endTime - board.startTime)) + (Settings.get()?.login?.hash == undefined && window.showGlobalLeaderboard ? " (Please login)" : ""));
    } else {
        newLeaderboardTime(undefined, undefined, "Failed" + (Settings.get()?.login?.hash == undefined && window.showGlobalLeaderboard ? " (Please login)" : ""), "black", "red");
    }

    
    if (board.difficulty == "custom") {
        var elem = document.createElement("h2");
        elem.innerText = "Unranked";
        gameOverLeaderboard.appendChild(elem);
    } else {
        var elem = document.createElement("h2");
        elem.innerText = "Loading leaderboard";
        elem.style.gridRow = "2/11";
        gameOverLeaderboard.appendChild(elem);

        const MAX_SHOWN_SCORES = 10;
        var leaderboard = window.showGlobalLeaderboard ? (await Leaderboard.global.get(board.difficulty)) : Leaderboard.local.get(board.difficulty);
        gameOverLeaderboard.removeChild(elem);
        for (var i = 0; i < MAX_SHOWN_SCORES; i++) {
            var color = i == 0 ? "gold" : i == 1 ? "#f0f0f0" : i == 2 ? "#cd7f32" : "black";
            newLeaderboardTime(leaderboard?.[i]?.date || "-", leaderboard?.[i]?.username || (window.showGlobalLeaderboard ? "-" : undefined), convertToTime(leaderboard?.[i]?.time), color, color);
        }
    }
}

class Leaderboard {
    static local = {
        get: (difficulty) => {
            var leaderboard = localStorage.getItem('best-time');

            if (leaderboard == null) {
                leaderboard = { easy: [], medium: [], hard: [] };
                localStorage.setItem('best-time', JSON.stringify(leaderboard));
            } else {
                leaderboard = JSON.parse(leaderboard);
            }

            return leaderboard?.[difficulty] || [];
        },

        /**
         * 
         * @param {number} time 
         * @param {"easy"|"medium"|"hard"} difficulty 
         * @returns 
         */
        submit: (time, difficulty) => {
            console.trace("Submitting score", time, difficulty);
            
            var date = new Date().getTime();
            var leaderboard = Leaderboard.local.get(difficulty);
            var bestTime = JSON.parse(localStorage.getItem('best-time'));

            leaderboard.push({ date, time });
            leaderboard.sort((a, b) => a.time - b.time);

            const MAX_STORED_SCORES = 30;
            while (leaderboard.length > MAX_STORED_SCORES) {
                leaderboard.pop();
            }

            bestTime[difficulty] = leaderboard;
            localStorage.setItem('best-time', JSON.stringify(bestTime));
        },

        clearNullScores: (difficulty = "easy") => {
            var bestTime = JSON.parse(localStorage.getItem('best-time'));
            if (bestTime == null) return;

            // Remove all null, bugged scores
            bestTime[difficulty] = bestTime?.[difficulty]?.filter(l => l.time != null) || [];

            localStorage.setItem('best-time', JSON.stringify(bestTime));        
        }
    }

    static global = {
        cache: {},
        UPDATE_FREQUENCY: 5 * 60 * 1000,
        get: async (difficulty) => {
            var headers = {
                "Difficulty": difficulty
            }

            if (new Date().getTime() - (Leaderboard.global.cache?.[difficulty]?.time || 0) > Leaderboard.global.UPDATE_FREQUENCY) {
                // Invalidate cache if it's too old
                Leaderboard.global.cache[difficulty] = undefined;
            }

            var response;
            if (Leaderboard.global.cache?.[difficulty] != undefined) {
                console.log("global.get() from cache");
                response = Leaderboard.global.cache[difficulty].data;
            } else {
                console.log("global.get() from remote server");
                response = (await (await fetch("https://production.minesweeper.endy.workers.dev/get_score", { headers })).json());
                Leaderboard.global.cache[difficulty] = { time: new Date().getTime(), data: response };
            }

            return response;
        },

        submit: async (time, difficulty) => {
            var date = new Date().getTime();

            // Add a way to create new users
            // Could be possible to create a new user when a certain name is used for the first time
            var headers = {
                "Difficulty": difficulty,
                "Timestamp": date,
                "Time": time,
                "Username": Settings.get()?.login?.username,
                "Userhash": Settings.get()?.login?.hash
            }

            console.log("global.submit() to remote server");
            await fetch("https://production.minesweeper.endy.workers.dev/submit_score", { headers });

            // Update the cache, if it exists
            Leaderboard.global.cache?.[difficulty]?.data?.push({
                time,
                date,
                username: Settings.get()?.login?.username
            });
            Leaderboard.global.cache?.[difficulty]?.data?.sort((a, b) => a.time - b.time);
            console.log(Leaderboard.global.cache?.[difficulty]?.data);
        }
    }
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

        sprite.innerHTML = "<img style='color: red; position: absolute; width: 50%; height: 50%; display: none; left: 25%; top: 25%;' src='images/flag.png' alt='F'>" +
            "<div class=\"center-circle\" ontransitionend=\"this.style.width = '0px'; this.style.height = '0px'; this.style.left = 'calc((100% - 50%) / 2 + 50% / 2)'; this.style.top = 'calc((100% - 50%) / 2 + 50% / 2)';\"></div>" +
            "<div class=\"left-circle\" ontransitionend=\"this.style.width = '0px'; this.style.height = '0px'; this.style.left = 'calc(2% + 35% / 2)'; this.style.top = 'calc(50% + 35% / 2)';\"></div>" +
            "<div class=\"right-circle\" ontransitionend=\"this.style.width = '0px'; this.style.height = '0px'; this.style.left = 'calc(60% + 25% / 2)'; this.style.top = 'calc(10% + 25% / 2)';\"></div>"


        document.getElementsByTagName('board')[0].appendChild(sprite);

        sprite.oncontextmenu = (ev) => {
            // This event triggers on rightclick
            if (this.isVisualized) return;

            this.isFlagged = !this.isFlagged;
            if (this.isFlagged) {
                sprite.querySelector("img").style.display = "block";
                runAnimation("#00AB41");
//                this.sprite.innerHTML = "<img style='color: red; position: relative; width: 50%; height: 50%;' src='images/flag.png' alt='F'>";

                board.numberOfPlacedFlags++;
            } else {
                sprite.querySelector("img").style.display = "none";
                runAnimation("red");
//                this.sprite.innerHTML = "";

                board.numberOfPlacedFlags--;
            }

            document.getElementById('flag-counter-text').innerText =  board.numberOfPlacedFlags + "/" + board.numberOfBombs;

            return false;
        };

        sprite.onmousedown = (ev) => {
            // If this was rightclick
            if (ev.button == 2) {
                return;
            }

            if (pressedKeys["Shift"] != undefined) {
                sprite.oncontextmenu(undefined);
                return;
            }

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

                // Start the timer
                board.startTime = performance.now();
                var clock = document.getElementById('time-display');
        
                board.clockInterval = setInterval(() => {
                    var time = performance.now() - board.startTime;
                    var hours = "" + Math.floor(time / 1000 / 60 / 60);
                    var minutes = "" + Math.floor(time / 1000 / 60 % 60);
                    var seconds = "" + Math.floor(time / 1000 % 60);
                    clock.innerText = (hours.length == 1 ? "0" + hours : hours) + ":" + (minutes.length == 1 ? "0" + minutes : minutes) + ":" + (seconds.length == 1 ? "0" + seconds : seconds);
                }, 100);
            }
            
            board.visualizeMapAt(this.position.x, this.position.y);                
        }

        function runAnimation(color = "blue") {
            var centerCircle = sprite.querySelector(".center-circle");
            var rightCircle = sprite.querySelector(".right-circle");
            var leftCircle = sprite.querySelector(".left-circle");
            
            centerCircle.style.backgroundColor = color;
            leftCircle.style.backgroundColor = color;
            rightCircle.style.backgroundColor = color;

            // Center
            centerCircle.style.left = "25%";
            centerCircle.style.top = "25%";

            centerCircle.style.width = "50%";
            centerCircle.style.height = "50%";
            
            // Left
            leftCircle.style.left = "2%";
            leftCircle.style.top = "50%";
            
            leftCircle.style.width = "35%";
            leftCircle.style.height = "35%";
        
            // Right
            rightCircle.style.left = "60%";
            rightCircle.style.top = "10%";

            rightCircle.style.width = "25%";
            rightCircle.style.height = "25%";
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

function openSettings() {
    var settingsAlert = document.getElementById('settings-alert');
    var gameOverAlert = document.getElementById('game-over-alert');
    var label = document.getElementById("login-label");
    document.getElementById('apply-settings').style.disabled = 'enabled';
    
    settingsAlert.style.display = "flex";
    gameOverAlert.style.display = "none";

    label.style.color = "black";
    label.innerText = "Login:";

    document.getElementById(board.difficulty).selected = "selected";
    document.getElementById('login-username').value = Settings.get()?.login?.username || "";
    document.getElementById('login-password').value = "";

    var onblur = (ev, word, number) => {
        if (ev.target.value == "") return;

        if (!/^\d*$/.test(ev.target.value)) {
            ev.target.value = "";
            ev.target.placeholder = "Invalid input, please use digits only";
        } else if (Number(ev.target.value) >= number || Number(ev.target.value) <= 0) {
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

function closeSettings() {
    var settingsAlert = document.getElementById('settings-alert');
    var gameOverAlert = document.getElementById('game-over-alert');

    settingsAlert.style.display = "none";
    gameOverAlert.style.display = "block";

    // Clear the fields on these inputs
    document.getElementById("width-settings-input").value = "";
    document.getElementById("height-settings-input").value = "";
    document.getElementById("bombs-settings-input").value = "";
}

function init() {
    var diff = Settings.get()?.difficulty?.name;
    window.showGlobalLeaderboard = window.showGlobalLeaderboard || false;

    if (diff == undefined) {
        Settings.save({
            difficulty: {
                name: Board.DEFAULT_DIFFICULTY
            }
        });

        location.reload();
    }

    document.querySelector('board').innerHTML = "";

    document.getElementById('game-over-alert').style.display = "none";
    document.getElementById('background-dim').style.display = "none";

    Settings.load();

    window.board = new Board(diff);

    if (diff != "custom") {
        // Preload the leaderboard so that the load-time is lower later
        Leaderboard.global.get(diff);
    }
}

class Settings {
    static accessibility = {
        "small": "15cqmin",
        "normal": "25cqmin",
        "large": "35cqmin",
        "extra-large": "50cqmin"
    }

    /**
     * 
     * @param  {object} changes The changes to made to the settings, in (key: value) pairs
     */
    static save(changes) {
        // Fetch from localstorage
        var settings = Settings.get();

        // Set changes
        Object.entries(changes).forEach((change) => settings[change[0]] = change[1]);

        // Save to localstorage
        localStorage.setItem("settings", JSON.stringify(settings));
    }

    /**
     * @returns The currently applied settings
     */
    static get() {
        var settings = {};
        if (localStorage.getItem("settings") != null) {
            settings = JSON.parse(localStorage.getItem("settings"));
        }

        return settings;
    }

    static async apply() {
        var changes = {};

        var username = document.getElementById('login-username').value;
        var password = document.getElementById('login-password').value;

        if (username != "" && password != "") {
            password = password.split("").map(x => x.charCodeAt(0)).reduce((t, a) => t + a);
            var hash = btoa(btoa(encodeURI(username.split("").map(x => String.fromCharCode(x.charCodeAt(0) + password)).join(""))));

            changes["login"] = {
                username,
                hash
            }

            document.getElementById('login-password').value = "";
            var headers = {
                "Username": username,
                "Userhash": hash
            }

            var res = await fetch("https://production.minesweeper.endy.workers.dev/login_user", { headers });
            if (res.status == 401) {
                var label = document.getElementById("login-label");
                label.style.color = "red";
                label.innerText = "Login: (Incorrect username/password)";
                return;
            }
        }


        // Change the font-size
        var fontSize = document.getElementById('font-list').value;

        changes["fontSize"] = fontSize;
                
        // Change the difficulty if it was changed
        var width = document.getElementById("width-settings-input").value;
        width = width == "" ? board.size.width : width;
        
        var height = document.getElementById("height-settings-input").value;
        height = height == "" ? board.size.height : height;
        
        var bombs = document.getElementById("bombs-settings-input").value;
        bombs = bombs == "" ? board.numberOfBombs : bombs;
        
        if (board.difficulty != document.getElementById('diffs-list').value || (board.difficulty == "custom" && (width != board.size.width || height != board.size.height || bombs != board.numberOfBombs))) {
            changes["difficulty"] = {
                "name": document.getElementById('diffs-list').value,
                width,
                height,
                bombs
            };
        }
        
        Settings.save(changes);

        if (changes.difficulty != undefined) {
            // Simplest way for everything to be reset for the next run
            location.reload();
        }

        // If the site hasn't reloaded yet, close this menu and open the game-over menu instead
        Settings.load();
        Settings.menu.close();
    }

    static load() {
        var settings = Settings.get();

        // Change the font-size
        var fontSize = settings.fontSize || "normal";
        document.querySelector("board").style.setProperty("--font-size", Settings.accessibility[fontSize]);
        document.getElementById("font-" + fontSize).selected = "selected";
    }

    static menu = {
        open: openSettings,
        close: closeSettings
    }
}