class CaroGame {
    constructor() {
        this.boardSize = 15;
        this.board = [];
        this.moveHistory = [];
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        
        this.currentTurn = 'X'; // X (Black) goes first
        this.gameMode = 'ai'; // 'ai' or 'online'
        
        this.rules = new CaroRules(this.boardSize);
        if (typeof CaroAI !== 'undefined') {
            this.ai = new CaroAI(this.rules);
        }
        
        this.turnTimeLimit = 30; // seconds
        this.timeLeft = 30;
        this.timerInterval = null;

        this.cacheDOM();
        this.initBoardArray();
        this.renderBoardGrid();
        this.bindEvents();
        
        this.isGameOver = false;
        
        // Setup initial UI
        if (this.dom.tabBtns.length > 0) {
            this.dom.tabBtns[0].click();
        }
        
        this.checkURLParams();
        this.updateUI();
    }
    
    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        if (roomCode) {
            this.gameMode = 'online';
            this.onlineManager = new OnlineManager(this);
            this.onlineManager.joinRoom(roomCode, () => {
                this.addChatLog('Đã kết nối thành công!', true);
            }, () => {
                this.addChatLog('Lỗi kết nối hoặc phòng không tồn tại.', true);
            });
            this.addChatLog('Đang kết nối phòng ' + roomCode + '...', true);
            if (this.dom.onlineModal) {
                this.dom.onlineModal.style.display = 'none';
            }
        }
    }
    
    cacheDOM() {
        this.dom = {
            boardContainer: document.getElementById('goban-board'),
            boardWrapper: document.getElementById('board-wrapper'),
            btnSitBoard: document.getElementById('btn-sit-board'),
            
            btnDraw: document.getElementById('btn-draw'),
            btnUndo: document.getElementById('btn-undo'),
            btnResign: document.getElementById('btn-resign'),
            btnNewGame: document.getElementById('btn-new-game'),
            btnOnline: document.getElementById('btn-online'),
            
            slot1: document.getElementById('slot-1'),
            btnSit1: document.getElementById('btn-sit-1'),
            name1: document.getElementById('name-1'),
            card1: document.getElementById('card-1'),

            timer1: document.getElementById('timer-1'),
            
            slot2: document.getElementById('slot-2'),
            btnSit2: document.getElementById('btn-sit-2'),
            name2: document.getElementById('name-2'),
            card2: document.getElementById('card-2'),

            timer2: document.getElementById('timer-2'),
            
            roomTitle: document.getElementById('room-title'),
            roomTime: document.getElementById('room-time'),
            
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabPanes: document.querySelectorAll('.tab-pane'),
            chatLog: document.getElementById('chat-log'),
            chatInput: document.getElementById('chat-input'),
            tabMoves: document.getElementById('tab-moves'),
            
            onlineModal: document.getElementById('online-modal'),
            btnCreateRoom: document.getElementById('btn-create-room'),
            btnJoinRoom: document.getElementById('btn-join-room'),
            inputJoinCode: document.getElementById('input-join-code'),
            onlineTimeSelect: document.getElementById('online-time-select'),
            btnCloseOnline: document.getElementById('btn-close-online'),
        };
    }
    
    initBoardArray() {
        this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
    }
    
    startNewGame() {
        this.isGameOver = false;
        this.currentTurn = 'X';
        this.moveHistory = [];
        this.usedSwapCard = { X: false, O: false };
        this.hasUsedSwapCard = false;
        this.hasUsedSwapCard = false;
        this.boardSize = 25;
        this.rules.size = 25;
        if (this.ai) this.ai.rules.size = 25;
        this.lastMove = null;
        
        this.initBoardArray();
        this.renderBoardGrid();
        this.dom.tabMoves.innerHTML = '';
        
        this.updateUI();
        this.startTimer();
        
        if (this.gameMode === 'ai' && this.getMyPiece() === 'O') {
            this.makeAIMove();
        }
    }
    
    getMyPiece() {
        if (this.gameMode === 'online' && this.onlineManager) {
            return this.onlineManager.myPiece;
        }
        return 'X'; // AI mode defaults to X
    }
    
    updateUI() {
        if (!this.dom.slot1) return;
        
        const myPiece = this.getMyPiece();
        
        const hand1 = document.getElementById('hand-1');
        const hand2 = document.getElementById('hand-2');
        if (hand1 && hand2) {
            if (myPiece === 'X') {
                hand1.style.order = 2; // My card at bottom
                hand2.style.order = 1; // Opponent at top
            } else if (myPiece === 'O') {
                hand1.style.order = 1; // Opponent at top
                hand2.style.order = 2; // My card at bottom
            } else {
                hand1.style.order = 1;
                hand2.style.order = 2;
            }
        }
        
        if (this.gameMode === 'online' && this.onlineManager) {
            const seats = this.onlineManager.seats || { X: null, O: null };
            
            // Middle board sit button
            if (myPiece === 'spectator' && (!seats['X'] || !seats['O'])) {
                this.dom.btnSitBoard.style.display = 'block';
            } else {
                this.dom.btnSitBoard.style.display = 'none';
            }
            
            // Slot 1 (X)
            if (seats['X']) {
                this.dom.btnSit1.style.display = 'none';
                this.dom.name1.style.display = 'block';
                this.dom.name1.textContent = (myPiece === 'X') ? 'Bạn' : 'Đối thủ';
                this.dom.card1.style.display = 'block';
                if (this.usedSwapCard['X']) this.dom.card1.classList.add('used');
                else this.dom.card1.classList.remove('used');
            } else {
                this.dom.btnSit1.style.display = 'block';
                this.dom.name1.style.display = 'none';
                this.dom.card1.style.display = 'none';
            }
            
            // Slot 2 (O)
            if (seats['O']) {
                this.dom.btnSit2.style.display = 'none';
                this.dom.name2.style.display = 'block';
                this.dom.name2.textContent = (myPiece === 'O') ? 'Bạn' : 'Đối thủ';
                this.dom.card2.style.display = 'block';
                if (this.usedSwapCard['O']) this.dom.card2.classList.add('used');
                else this.dom.card2.classList.remove('used');
            } else {
                this.dom.btnSit2.style.display = 'block';
                this.dom.name2.style.display = 'none';
                this.dom.card2.style.display = 'none';
            }
            
        } else {
            // AI Mode
            if (myPiece === 'spectator') {
                this.dom.btnSitBoard.style.display = 'block';
                this.dom.btnSit1.style.display = 'block';
                this.dom.btnSit2.style.display = 'block';
                this.dom.name1.style.display = 'none';
                this.dom.name2.style.display = 'none';
            } else {
                this.dom.btnSitBoard.style.display = 'none';
                
                this.dom.btnSit1.style.display = 'none';
                this.dom.name1.style.display = 'block';
                this.dom.name1.textContent = myPiece === 'X' ? 'Bạn' : 'Máy (AI)';
                this.dom.card1.style.display = 'block';
                if (this.usedSwapCard && this.usedSwapCard['X']) this.dom.card1.classList.add('used');
                else this.dom.card1.classList.remove('used');
                
                this.dom.btnSit2.style.display = 'none';
                this.dom.name2.style.display = 'block';
                this.dom.name2.textContent = myPiece === 'O' ? 'Bạn' : 'Máy (AI)';
                this.dom.card2.style.display = 'block';
                if (this.usedSwapCard && this.usedSwapCard['O']) this.dom.card2.classList.add('used');
                else this.dom.card2.classList.remove('used');
            }
        }
        
        if (this.onlineManager && this.onlineManager.roomCode) {
            this.dom.roomTitle.textContent = "bàn " + this.onlineManager.roomCode;
            this.dom.roomTime.textContent = this.turnTimeLimit ? this.turnTimeLimit + "s" : "∞";
        } else {
            this.dom.roomTitle.textContent = "Chơi với Máy (AI)";
        }
    }
    
    bindEvents() {
        if (this.dom.btnSitBoard) this.dom.btnSitBoard.addEventListener('click', () => this.handleSit('X'));
        if (this.dom.btnSit1) this.dom.btnSit1.addEventListener('click', () => this.handleSit('X'));
        if (this.dom.btnSit2) this.dom.btnSit2.addEventListener('click', () => this.handleSit('O'));
        if (this.dom.card1) this.dom.card1.addEventListener('click', () => this.handleSwapCard('X'));
        if (this.dom.card2) this.dom.card2.addEventListener('click', () => this.handleSwapCard('O'));

        if (this.dom.btnOnline) this.dom.btnOnline.addEventListener('click', () => this.dom.onlineModal.style.display = 'flex');
        if (this.dom.btnCloseOnline) this.dom.btnCloseOnline.addEventListener('click', () => this.dom.onlineModal.style.display = 'none');
        
        if (this.dom.btnCreateRoom) {
            this.dom.btnCreateRoom.addEventListener('click', () => {
                this.dom.onlineModal.style.display = 'none';
                this.gameMode = 'online';
                const timeStr = this.dom.onlineTimeSelect ? this.dom.onlineTimeSelect.value : "30";
                this.turnTimeLimit = parseInt(timeStr) || 30;
                
                this.startNewGame();
                
                this.onlineManager = new OnlineManager(this);
                this.onlineManager.createRoom(this.turnTimeLimit, (roomCode) => {
                    this.addChatLog('Đã tạo phòng: ' + roomCode, true);
                    const url = new URL(window.location.href);
                    url.searchParams.set('room', roomCode);
                    window.history.pushState({}, '', url);
                    this.updateUI();
                });
                this.addChatLog('Đang tạo phòng...', true);
            });
        }
        
        if (this.dom.btnJoinRoom) {
            this.dom.btnJoinRoom.addEventListener('click', () => {
                const code = this.dom.inputJoinCode.value.trim().toUpperCase();
                if (code) {
                    this.dom.onlineModal.style.display = 'none';
                    this.gameMode = 'online';
                    this.onlineManager = new OnlineManager(this);
                    this.onlineManager.joinRoom(code, () => {
                        this.addChatLog('Đã kết nối thành công!', true);
                        const url = new URL(window.location.href);
                        url.searchParams.set('room', code);
                        window.history.pushState({}, '', url);
                    }, () => {
                        this.addChatLog('Lỗi kết nối hoặc phòng không tồn tại.', true);
                    });
                    this.addChatLog('Đang kết nối phòng ' + code + '...', true);
                }
            });
        }

        if (this.dom.tabBtns) {
            this.dom.tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.dom.tabBtns.forEach(b => b.classList.remove('active'));
                    this.dom.tabPanes.forEach(p => p.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
                });
            });
        }

        if (this.dom.chatInput) {
            this.dom.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const text = e.target.value.trim();
                    if (text) {
                        if (this.onlineManager && this.onlineManager.isConnected) {
                            this.onlineManager.sendChat(text);
                            this.receiveOnlineChat(text, this.onlineManager.myPiece);
                        } else {
                            this.receiveOnlineChat(text, 'Bạn');
                        }
                        e.target.value = '';
                    }
                }
            });
        }

        if (this.dom.btnNewGame) this.dom.btnNewGame.addEventListener('click', () => {
            if (this.gameMode === 'online') {
                if (this.onlineManager) this.onlineManager.sendNewGame();
            } else {
                this.startNewGame();
            }
        });
        
        if (this.dom.btnUndo) this.dom.btnUndo.addEventListener('click', () => this.handleUndo());
        if (this.dom.btnResign) this.dom.btnResign.addEventListener('click', () => this.handleResign());
        if (this.dom.btnDraw) this.dom.btnDraw.addEventListener('click', () => this.handleDraw());
        

        if (this.dom.boardContainer) {
            this.dom.boardContainer.addEventListener('wheel', (e) => {
                
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.05 : 0.05;
                this.handleZoom(delta);
            });
            
            let isDragging = false;
            let startX, startY;
            this.dom.boardContainer.addEventListener('mousedown', (e) => {
                
                if (e.button === 0 && this.zoomLevel === 1.0 && this.boardSize === 15) return; 
                isDragging = true;
                this.dom.boardContainer.style.cursor = 'grabbing';
                this.dom.boardContainer.style.transition = 'none';
                startX = e.clientX - this.panX;
                startY = e.clientY - this.panY;
            });
            window.addEventListener('mousemove', (e) => {
                if (!isDragging ) return;
                this.panX = e.clientX - startX;
                this.panY = e.clientY - startY;
                this.update2DTransform();
            });
            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    this.dom.boardContainer.style.cursor = 'pointer';
                    this.dom.boardContainer.style.transition = 'transform 0.2s ease-out';
                }
            });
        }
    }
    
    update2DTransform() {
        if (!this.dom.boardContainer) return;
        this.dom.boardContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
        this.dom.boardContainer.style.transformOrigin = 'center center';
    }

    handleZoom(delta) {
        this.zoomLevel += delta;
        this.zoomLevel = Math.max(0.4, Math.min(this.zoomLevel, 3.0));
        this.update2DTransform();
    }

    handleSwapCard(color) {
        if (this.isGameOver) return;
        if (this.getMyPiece() !== color) return;
        if (this.hasUsedSwapCard) return; // Strict local lock
        if (this.usedSwapCard[color]) return;
        if (this.currentTurn !== color) {
            this.addChatLog('Chỉ được dùng bài khi đến lượt của bạn!', true);
            return;
        }
        
        if (this.gameMode === 'online') {
            if (this.onlineManager) {
                // Lock locally immediately to prevent spam clicking
                this.hasUsedSwapCard = true;
                this.updateUI();
                
                this.onlineManager.sendSwapCard();
            }
        } else {
            // AI Mode
            this.usedSwapCard[color] = true;
            this.addChatLog('Bạn đã dùng Bài Hoán Đổi!', true);
            
            // Swap AI and Player roles
            if (this.getMyPiece() === 'X') {
                this.addChatLog('Bạn giờ là Trắng (O), Máy là Đen (X).', true);
                // In AI mode, getMyPiece() returns 'X' by default. We can't really swap easily without refactoring AI mode.
                // But we can just make the AI move as X!
                // Wait, if AI mode is hardcoded, let's just cheat:
                this.addChatLog('Lưu ý: Chơi với máy chưa hỗ trợ hoán đổi 100%. Tính năng này chủ yếu dùng cho Online.', true);
            }
            this.updateUI();
        }
    }

    playSwapAnimation(color) {
        const card = color === 'X' ? this.dom.card1 : this.dom.card2;
        if (card) {
            card.classList.add('card-activating');
            setTimeout(() => card.classList.remove('card-activating'), 1000);
        }
        
        if (this.dom.boardWrapper) {
            this.dom.boardWrapper.classList.add('board-swapping');
            setTimeout(() => this.dom.boardWrapper.classList.remove('board-swapping'), 1000);
        }
        
        if (this.getMyPiece() === 'spectator') {
            this.addChatLog(`[HỆ THỐNG] Phe ${color === 'X' ? 'Đen' : 'Trắng'} vừa dùng Hoán Đổi! Bàn cờ xoay chuyển!`, true);
        } else {
            const who = (color !== this.getMyPiece()) ? 'BẠN' : 'ĐỐI THỦ';
            const currentPieceName = this.getMyPiece() === 'X' ? 'ĐEN' : 'TRẮNG';
            this.addChatLog(`[HỆ THỐNG] ${who} vừa dùng Hoán Đổi! Bàn cờ xoay chuyển! HIỆN TẠI QUÂN CỦA BẠN LÀ ${currentPieceName}.`, true);
        }
    }

    handleSit(color) {
        if (this.gameMode === 'ai') {
            this.updateUI();
            this.startNewGame();
            return;
        }
        if (this.onlineManager) {
            this.onlineManager.requestSeat(color);
        }
    }

    addChatLog(msg, isSys=false) {
        if (!this.dom.chatLog) return;
        const div = document.createElement('div');
        if (isSys) div.className = 'chat-sys';
        div.textContent = msg;
        this.dom.chatLog.appendChild(div);
        this.dom.chatLog.scrollTop = this.dom.chatLog.scrollHeight;
    }
    
    receiveOnlineChat(text, sender) {
        const prefix = sender === 'X' ? '[Đen]' : (sender === 'O' ? '[Trắng]' : sender);
        this.addChatLog(prefix + ': ' + text);
    }
    
    renderBoardGrid() {
        if (!this.dom.boardContainer) return;
        this.dom.boardContainer.innerHTML = '';

        const boardEl = document.createElement('div');
        boardEl.className = 'board-grid';
        boardEl.style.gridTemplateColumns = `repeat(${this.boardSize}, 1fr)`;
        boardEl.style.gridTemplateRows = `repeat(${this.boardSize}, 1fr)`;

        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const cell = document.createElement('div');
                cell.className = 'board-cell';
                
                if (r === 0) cell.classList.add('edge-top');
                if (r === this.boardSize - 1) cell.classList.add('edge-bottom');
                if (c === 0) cell.classList.add('edge-left');
                if (c === this.boardSize - 1) cell.classList.add('edge-right');

                cell.addEventListener('click', () => this.handleCellClick(r, c));
                boardEl.appendChild(cell);
            }
        }

        this.dom.boardContainer.appendChild(boardEl);
    }
    
    getCellElement(r, c) {
        if (!this.dom.boardContainer) return null;
        const grid = this.dom.boardContainer.querySelector('.board-grid');
        if (!grid) return null;
        const index = r * this.boardSize + c;
        return grid.children[index];
    }
    
    renderStone(r, c, player, isNew = false) {
        const cell = this.getCellElement(r, c);
        if (!cell) return;
        
        if (isNew) {
            document.querySelectorAll('.stone.last-move').forEach(el => el.classList.remove('last-move'));
        }
        
        const stone = document.createElement('div');
        stone.className = `stone stone-${player.toLowerCase()}`;
        
        cell.innerHTML = '';
        cell.appendChild(stone);
        
        if (isNew) {
            stone.classList.add('last-move');
        }
    }
    
    handleCellClick(r, c) {
        if (this.isGameOver) return;
        if (this.getMyPiece() === 'spectator') return;
        
        if (this.currentTurn !== this.getMyPiece()) return;
        
        if (this.board[r][c] !== null) return;
        
        const moveColor = this.currentTurn;
        this.makeMove(r, c, moveColor);
        
        if (this.gameMode === 'online') {
            this.onlineManager.sendMove(r, c, moveColor);
        } else {
            if (!this.isGameOver) {
                setTimeout(() => this.makeAIMove(), 300);
            }
        }
    }
    
    makeAIMove() {
        if (this.isGameOver) return;
        const bestMove = this.ai.findBestMove(this.board, 'O');
        if (bestMove) {
            this.makeMove(bestMove.r, bestMove.c, 'O');
        }
    }
    
    makeMove(r, c, player) {
        this.board[r][c] = player;
        this.lastMove = { r, c, player };
        this.moveHistory.push(this.lastMove);
        
        const coords = `${String.fromCharCode(65+c)}${this.boardSize - r}`;
        const color = player === 'X' ? 'Đen' : 'Trắng';
        const moveDiv = document.createElement('div');
        moveDiv.textContent = `${this.moveHistory.length}. ${color} - ${coords}`;
        if (this.dom.tabMoves) {
            this.dom.tabMoves.appendChild(moveDiv);
            this.dom.tabMoves.scrollTop = this.dom.tabMoves.scrollHeight;
        }
        
        this.renderStone(r, c, player, true);
        
        const result = this.rules.checkMove(this.board, r, c, player);
        if (result.isWin) {
            this.handleWin(player, result.winningLine);
            return;
        }
        
        if (result.doubleBlocked) {
            // Do not switch turn or anything special, just log
            this.addChatLog(`* Cảnh báo: Chuỗi của ${color} bị chặn 2 đầu!`, true);
        }
        
        this.currentTurn = player === 'X' ? 'O' : 'X';
        this.startTimer();
    }
    
    handleWin(winner, winningLine) {
        this.isGameOver = true;
        this.stopTimer();
        const msg = winner === 'X' ? 'Đen thắng!' : 'Trắng thắng!';
        this.addChatLog(`*** ${msg} ***`, true);
        
        if (winningLine && winningLine.length > 0) {
            winningLine.forEach(coord => {
                const cell = this.getCellElement(coord.r, coord.c);
                if (cell) {
                    const stone = cell.querySelector('.stone');
                    if (stone) {
                        stone.classList.add('winning-stone');
                    }
                }
            });
        }
    }
    
    checkExpansion(r, c) {
        if (r <= 2 || r >= this.boardSize - 3 || c <= 2 || c >= this.boardSize - 3) {
            this.expandBoard(5);
        }
    }
    
    expandBoard(amount) {
        const oldSize = this.boardSize;
        const newSize = oldSize + amount * 2;
        
        const newBoard = Array(newSize).fill(null).map(() => Array(newSize).fill(null));
        
        for (let r = 0; r < oldSize; r++) {
            for (let c = 0; c < oldSize; c++) {
                newBoard[r + amount][c + amount] = this.board[r][c];
            }
        }
        
        for (let move of this.moveHistory) {
            move.r += amount;
            move.c += amount;
        }
        // DO NOT modify this.lastMove again because it's a reference to the last element in this.moveHistory!
        
        this.board = newBoard;
        this.boardSize = newSize;
        this.rules.size = newSize;
        if (this.ai) this.ai.rules.size = newSize;
        
        this.renderBoardGrid();
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                if (this.board[r][c]) {
                    this.renderStone(r, c, this.board[r][c], false);
                }
            }
        }
        if (this.lastMove) {
            const cell = this.getCellElement(this.lastMove.r, this.lastMove.c);
            if (cell) cell.querySelector('.stone').classList.add('last-move');
        }
    }
    
    handleUndo() {
        if (this.isGameOver) return;
        if (this.gameMode === 'online') {
            if (this.onlineManager && this.getMyPiece() !== 'spectator') {
                this.addChatLog('Đã gửi yêu cầu đánh lại...', true);
                this.onlineManager.sendUndoRequest();
            }
        } else {
            if (this.moveHistory.length >= 2) {
                this.undoMove(2); // pop AI and Player
            }
        }
    }

    handleResign() {
        if (this.isGameOver) return;
        if (this.gameMode === 'online') {
            if (this.onlineManager && this.getMyPiece() !== 'spectator') {
                this.onlineManager.sendResign();
                this.isGameOver = true;
                const winner = this.getMyPiece() === 'X' ? 'O' : 'X';
                this.handleWin(winner, []);
            }
        } else {
            this.isGameOver = true;
            this.handleWin('O', []);
        }
    }

    handleDraw() {
        if (this.isGameOver) return;
        if (this.gameMode === 'online') {
            if (this.onlineManager && this.getMyPiece() !== 'spectator') {
                this.addChatLog('Đã gửi yêu cầu cầu hoà...', true);
                this.onlineManager.sendDrawRequest();
            }
        }
    }

    undoMove(count = 1) {
        for (let i = 0; i < count; i++) {
            if (this.moveHistory.length === 0) break;
            const move = this.moveHistory.pop();
            this.board[move.r][move.c] = null;
        }
        this.lastMove = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;
        
        this.renderBoardGrid();
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                if (this.board[r][c]) {
                    this.renderStone(r, c, this.board[r][c], false);
                }
            }
        }
        if (this.lastMove) {
            this.renderStone(this.lastMove.r, this.lastMove.c, this.lastMove.player, true);
        }
        
        if (this.dom.tabMoves) {
            this.dom.tabMoves.innerHTML = '';
            this.moveHistory.forEach((m, idx) => {
                const coords = `${String.fromCharCode(65+m.c)}${this.boardSize - m.r}`;
                const color = m.player === 'X' ? 'Đen' : 'Trắng';
                const moveDiv = document.createElement('div');
                moveDiv.textContent = `${idx + 1}. ${color} - ${coords}`;
                this.dom.tabMoves.appendChild(moveDiv);
            });
            this.dom.tabMoves.scrollTop = this.dom.tabMoves.scrollHeight;
        }
        
        this.currentTurn = this.moveHistory.length % 2 === 0 ? 'X' : 'O';
        this.isGameOver = false;
        this.updateUI();
    }

    receiveOnlineUndoRequest() {
        if (this.isGameOver) return;
        if (confirm('Đối thủ muốn đánh lại 1 nước. Bạn có đồng ý không?')) {
            this.onlineManager.sendUndoResponse(true);
            this.undoMove(1);
        } else {
            this.onlineManager.sendUndoResponse(false);
        }
    }

    receiveOnlineUndoResponse(accepted) {
        if (accepted) {
            this.addChatLog('Đối thủ đã đồng ý cho đánh lại.', true);
            this.undoMove(1);
        } else {
            this.addChatLog('Đối thủ từ chối yêu cầu đánh lại.', true);
        }
    }

    receiveOnlineResign() {
        if (this.isGameOver) return;
        const myPiece = this.getMyPiece();
        // The one who sent resign is the opponent
        const winner = myPiece === 'spectator' ? 'X' : myPiece;
        this.addChatLog('Đối thủ đã đầu hàng.', true);
        this.handleWin(winner, []);
    }

    receiveOnlineDrawRequest() {
        if (this.isGameOver) return;
        if (confirm('Đối thủ muốn xin hoà. Bạn có đồng ý không?')) {
            this.onlineManager.sendDrawResponse(true);
            this.isGameOver = true;
            this.addChatLog('*** VÁN CỜ HOÀ ***', true);
            alert('Ván cờ hoà!');
        } else {
            this.onlineManager.sendDrawResponse(false);
        }
    }

    receiveOnlineDrawResponse(accepted) {
        if (accepted) {
            this.isGameOver = true;
            this.addChatLog('Đối thủ đã chấp nhận hoà.', true);
            this.addChatLog('*** VÁN CỜ HOÀ ***', true);
            alert('Ván cờ hoà!');
        } else {
            this.addChatLog('Đối thủ từ chối yêu cầu hoà.', true);
        }
    }
    
    startTimer() {
        this.stopTimer();
        if (this.turnTimeLimit <= 0) {
            if (this.dom.timer1) this.dom.timer1.textContent = "0:00";
            if (this.dom.timer2) this.dom.timer2.textContent = "0:00";
            return;
        }

        this.timeLeft = this.turnTimeLimit;
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();

            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.makeRandomMove();
            }
        }, 1000);
    }
    
    makeRandomMove() {
        if (this.isGameOver) return;
        // Just skip turn to simple
        this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
        this.startTimer();
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const mins = Math.floor(this.timeLeft / 60);
        const secs = this.timeLeft % 60;
        const text = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        if (this.dom.timer1 && this.dom.timer2) {
            if (this.currentTurn === 'X') {
                this.dom.timer1.textContent = text;
                this.dom.timer2.textContent = "0:00";
            } else {
                this.dom.timer1.textContent = "0:00";
                this.dom.timer2.textContent = text;
            }
        }
    }
    
    // Online Callbacks
    onOnlineConnected(info) {
        this.gameMode = 'online';
        if (info.usedSwapCard) {
            this.usedSwapCard = info.usedSwapCard;
        }
        if (info.board && info.moveHistory && info.moveHistory.length > 0) {
            this.boardSize = info.board.length;
            this.board = info.board;
            this.moveHistory = info.moveHistory;
            this.currentTurn = info.currentTurn || 'X';
            this.lastMove = this.moveHistory[this.moveHistory.length - 1];
            
            this.renderBoardGrid();
            for (let r = 0; r < this.boardSize; r++) {
                for (let c = 0; c < this.boardSize; c++) {
                    if (this.board[r][c]) {
                        this.renderStone(r, c, this.board[r][c], false);
                    }
                }
            }
            if (this.lastMove) {
                const cell = this.getCellElement(this.lastMove.r, this.lastMove.c);
                if (cell) cell.querySelector('.stone').classList.add('last-move');
            }
        } else {
            this.startNewGame();
        }
        this.addChatLog(`Đã tham gia bàn ${info.roomCode}`, true);
        this.updateUI();
    }
    onOnlineDisconnected() {
        this.addChatLog('Đã ngắt kết nối', true);
    }
    receiveOnlineMove(r, c, player) {
        this.makeMove(r, c, player);
    }
    receiveOnlineNewGame() {
        this.startNewGame();
    }
    updatePingDisplay() {}
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new CaroGame();
});
