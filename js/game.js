/**
 * Caro Master Game Controller
 * Integrates Rules, AI, Audio, P2P Online, and DOM UI.
 */
class CaroGame {
    constructor() {
        this.boardSize = 15;
        this.board = []; // 2D array: null, 'X', or 'O'
        this.moveHistory = []; // Array of { r, c, player, timestamp }
        this.currentTurn = 'X';
        this.gameMode = 'ai'; // 'ai', 'local', 'online'
        this.aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'
        this.isGameOver = false;
        this.winner = null;
        this.winningLine = null;
        this.lastMove = null;
        this.hoverCell = null;
        this.score = { X: 0, O: 0, ties: 0 };
        this.turnTimeLimit = 30; // seconds (0 = unlimited)
        this.turnTimeLeft = 30;
        this.timerInterval = null;

        // Rule engine
        this.rules = new CaroRules(this.boardSize);
        // AI engine
        this.ai = new CaroAI(this.rules, 'O');
        
        // Online Manager
        this.online = new OnlineManager(this);

        // DOM elements cache
        this.dom = {};

        // Wait a tick for DOM to be ready before 3D init
        setTimeout(() => {
            this.caro3D = new Caro3D(this);
        }, 100);

        this.init();
    }

    init() {
        this.cacheDOM();
        this.initBoardState();
        this.renderBoardGrid();
        this.bindEvents();
        this.checkURLParams();
        this.updateUI();
    }

    cacheDOM() {
        this.dom = {
            boardContainer: document.getElementById('goban-board'),
            boardWrapper: document.getElementById('board-wrapper'),
            turnIndicator: document.getElementById('turn-indicator'),
            playerXCard: document.getElementById('player-x-card'),
            playerOCard: document.getElementById('player-o-card'),
            timerDisplay: document.getElementById('timer-countdown'),
            timerProgress: document.getElementById('timer-progress-bar'),
            scoreX: document.getElementById('score-x'),
            scoreO: document.getElementById('score-o'),
            moveLogList: document.getElementById('move-log-list'),
            moveCountBadge: document.getElementById('move-count-badge'),

            // Selectors
            themeSelect: document.getElementById('theme-select'),
            pieceSelect: document.getElementById('piece-select'),
            
            // Buttons
            btnToggle3D: document.getElementById('btn-toggle-3d'),
            btnNewGame: document.getElementById('btn-new-game'),
            btnUndo: document.getElementById('btn-undo'),
            btnHint: document.getElementById('btn-hint'),
            btnAudio: document.getElementById('btn-audio'),
            btnRulesModal: document.getElementById('btn-rules-modal'),
            btnOnlineModal: document.getElementById('btn-online-modal'),

            // Modals
            rulesModal: document.getElementById('rules-modal'),
            onlineModal: document.getElementById('online-modal'),
            gameOverModal: document.getElementById('game-over-modal'),
            confirmModal: document.getElementById('confirm-modal'),

            // Online UI elements
            onlineControlsPanel: document.getElementById('online-controls-panel'),
            onlineRoomCodeDisplay: document.getElementById('online-room-code-display'),
            onlinePingDisplay: document.getElementById('online-ping-display'),
            onlineStatusText: document.getElementById('online-status-text'),
            btnCopyLink: document.getElementById('btn-copy-link'),
            btnCreateRoom: document.getElementById('btn-create-room'),
            btnJoinRoom: document.getElementById('btn-join-room'),
            inputJoinCode: document.getElementById('input-join-code'),
            chatInput: document.getElementById('chat-input'),
            btnSendChat: document.getElementById('btn-send-chat'),
            chatMessages: document.getElementById('chat-messages'),
            avatarSelector: document.getElementById('avatar-selector'),
            playerXAvatar: document.querySelector('.player-x .avatar-stone'),
            playerOAvatar: document.querySelector('.player-o .avatar-stone'),
            emoteBar: document.getElementById('emote-bar'),

            // Settings & selectors
            modeSelect: document.getElementById('mode-select'),
            difficultySelect: document.getElementById('difficulty-select'),
            themeSelect: document.getElementById('theme-select'),
            fontSelect: document.getElementById('font-select'),
            timeSelect: document.getElementById('time-select'),
            onlineTimeSelect: document.getElementById('online-time-select')
        };
    }

    initBoardState() {
        this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
        this.moveHistory = [];
        this.currentTurn = 'X';
        this.isGameOver = false;
        this.winner = null;
        this.winningLine = null;
        this.lastMove = null;
        this.resetTimer();
        this.hideRuleAlert();
    }

    /**
     * Render the 15x15 Goban grid with coordinates and Hoshi points
     */
    renderBoardGrid() {
        if (!this.dom.boardContainer) return;
        this.dom.boardContainer.innerHTML = '';

        const boardEl = document.createElement('div');
        boardEl.className = 'board-grid';
        boardEl.style.gridTemplateColumns = `repeat(${this.boardSize}, 1fr)`;
        boardEl.style.gridTemplateRows = `repeat(${this.boardSize}, 1fr)`;

        // Traditional Hoshi (Star) points for 15x15 board:
        // (3,3), (3,11), (7,7), (11,3), (11,11)
        const hoshiPoints = new Set([
            '3,3', '3,11', '7,7', '11,3', '11,11'
        ]);

        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const cell = document.createElement('div');
                cell.className = 'board-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                // Add star point marker if applicable
                if (hoshiPoints.has(`${r},${c}`)) {
                    const hoshi = document.createElement('div');
                    hoshi.className = 'hoshi-point';
                    cell.appendChild(hoshi);
                }

                // Cell click
                cell.addEventListener('click', (e) => this.handleCellClick(r, c));

                // Hover ghost stone preview
                cell.addEventListener('mouseenter', () => this.handleCellHover(r, c, cell));
                cell.addEventListener('mouseleave', () => this.handleCellLeave(cell));

                boardEl.appendChild(cell);
            }
        }

        this.dom.boardContainer.appendChild(boardEl);
        this.renderCoordinateLabels();
    }

    renderCoordinateLabels() {
        const topLabels = document.getElementById('board-coords-top');
        const leftLabels = document.getElementById('board-coords-left');
        if (!topLabels || !leftLabels) return;

        topLabels.innerHTML = '';
        leftLabels.innerHTML = '';

        // Columns: A to O (15 columns)
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
        for (let i = 0; i < this.boardSize; i++) {
            const colLabel = document.createElement('span');
            colLabel.textContent = letters[i] || (i + 1);
            topLabels.appendChild(colLabel);

            const rowLabel = document.createElement('span');
            rowLabel.textContent = this.boardSize - i;
            leftLabels.appendChild(rowLabel);
        }
    }

    getCoordLabel(r, c) {
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
        const colLetter = letters[c] || (c + 1);
        const rowNumber = this.boardSize - r;
        return `${colLetter}${rowNumber}`;
    }

    bindEvents() {
        // Mode & Theme controls
        if (this.dom.modeSelect) {
            this.dom.modeSelect.addEventListener('change', (e) => {
                this.setGameMode(e.target.value);
            });
        }

        if (this.dom.difficultySelect) {
            this.dom.difficultySelect.addEventListener('change', (e) => {
                this.aiDifficulty = e.target.value;
            });
        }

        if (this.dom.themeSelect) {
            this.dom.themeSelect.addEventListener('change', (e) => {
                this.setBoardTheme(e.target.value);
            });
        }

        if (this.dom.fontSelect) {
            const savedFont = localStorage.getItem('caro_font') || 'vietnam';
            this.dom.fontSelect.value = savedFont;
            this.setFontStyle(savedFont);

            this.dom.fontSelect.addEventListener('change', (e) => {
                this.setFontStyle(e.target.value);
            });
        }

        // Time limit controls
        const savedTime = localStorage.getItem('caro_time_limit');
        if (savedTime !== null) {
            this.turnTimeLimit = parseInt(savedTime, 10);
        }
        if (this.dom.timeSelect) {
            this.dom.timeSelect.value = this.turnTimeLimit;
            this.dom.timeSelect.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                this.setTimeLimit(val);
            });
        }
        if (this.dom.onlineTimeSelect) {
            this.dom.onlineTimeSelect.value = this.turnTimeLimit;
            this.dom.onlineTimeSelect.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                this.setTimeLimit(val);
            });
        }

        // Action buttons
        if (this.dom.pieceSelect) {
            this.dom.pieceSelect.addEventListener('change', (e) => {
                if (this.caro3D) {
                    this.caro3D.setPieceStyle(e.target.value);
                }
            });
        }
        
        if (this.dom.btnToggle3D) {
            this.dom.btnToggle3D.addEventListener('click', () => {
                if (this.caro3D) {
                    this.caro3D.toggleMode();
                }
            });
        }

        if (this.dom.btnNewGame) {
            this.dom.btnNewGame.addEventListener('click', () => {
                const createNewOnline = () => {
                    this.startNewGame();
                    this.setGameMode('online');
                    this.handleCreateOnlineRoom();
                };

                if (this.moveHistory.length > 0 && !this.isGameOver) {
                    this.showConfirmModal('Tạo phòng mới?', 'Ván đấu hiện tại sẽ kết thúc và tạo phòng thi đấu mới.', () => {
                        createNewOnline();
                    });
                } else {
                    createNewOnline();
                }
            });
        }

        if (this.dom.btnUndo) {
            this.dom.btnUndo.addEventListener('click', () => this.handleUndo());
        }

        if (this.dom.btnHint) {
            this.dom.btnHint.addEventListener('click', () => this.showHint());
        }

        if (this.dom.btnAudio) {
            this.dom.btnAudio.addEventListener('click', () => {
                const muted = window.soundEngine.toggleMute();
                this.updateAudioButton(muted);
            });
            this.updateAudioButton(window.soundEngine.isMuted());
        }

        // Modal triggers
        if (this.dom.btnRulesModal) {
            this.dom.btnRulesModal.addEventListener('click', () => this.openModal(this.dom.rulesModal));
        }

        if (this.dom.btnOnlineModal) {
            this.dom.btnOnlineModal.addEventListener('click', () => this.openModal(this.dom.onlineModal));
        }

        // Close modal buttons
        document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-container');
                if (modal) this.closeModal(modal);
            });
        });

        // Online lobby buttons
        if (this.dom.btnCreateRoom) {
            this.dom.btnCreateRoom.addEventListener('click', () => this.handleCreateOnlineRoom());
        }

        if (this.dom.btnJoinRoom) {
            this.dom.btnJoinRoom.addEventListener('click', () => this.handleJoinOnlineRoom());
        }

        if (this.dom.btnCopyLink) {
            this.dom.btnCopyLink.addEventListener('click', () => this.copyInviteLink());
        }

        // Chat & Emotes
        if (this.dom.btnSendChat) {
            this.dom.btnSendChat.addEventListener('click', () => this.sendChatMessage());
        }
        if (this.dom.chatInput) {
            this.dom.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
        }

        if (this.dom.avatarSelector) {
            this.dom.avatarSelector.addEventListener('click', (e) => {
                const btn = e.target.closest('.avatar-option');
                if (btn) {
                    this.dom.avatarSelector.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    const emoji = btn.dataset.avatar;
                    this.online.setAvatar(emoji);
                }
            });
        }

        if (this.dom.emoteBar) {
            this.dom.emoteBar.addEventListener('click', (e) => {
                const btn = e.target.closest('.emote-btn');
                if (btn) {
                    const emoji = btn.dataset.emoji;
                    this.sendEmote(emoji);
                }
            });
        }
    }

    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const room = urlParams.get('room');
        if (room) {
            this.setGameMode('online');
            this.handleJoinOnlineRoom(room);
        }
    }

    setBoardTheme(themeName) {
        const appContainer = document.querySelector('.app-container');
        if (!appContainer) return;
        appContainer.classList.remove('theme-wood', 'theme-slate', 'theme-jade');
        appContainer.classList.add(`theme-${themeName}`);
        
        if (this.caro3D) {
            this.caro3D.setTheme(themeName);
        }
    }

    setFontStyle(fontName) {
        document.body.classList.remove('font-vietnam', 'font-playfair', 'font-jakarta');
        document.body.classList.add(`font-${fontName}`);
        localStorage.setItem('caro_font', fontName);
    }

    setTimeLimit(seconds) {
        this.turnTimeLimit = seconds;
        this.turnTimeLeft = seconds;
        localStorage.setItem('caro_time_limit', seconds);
        if (this.dom.timeSelect) this.dom.timeSelect.value = seconds;
        if (this.dom.onlineTimeSelect) this.dom.onlineTimeSelect.value = seconds;
        this.updateTimerDisplay();
        if (!this.isGameOver && this.moveHistory.length > 0) {
            this.startTimer();

            if (this.gameMode !== 'online') {
                this.receiveOnlineAvatar('X', '✕');
                this.receiveOnlineAvatar('O', this.gameMode === 'ai' ? '🤖' : '○');
            }
        }
    }

    setGameMode(mode) {
        this.gameMode = mode;
        if (this.dom.modeSelect) this.dom.modeSelect.value = mode;

        const diffContainer = document.getElementById('difficulty-container');
        if (diffContainer) {
            diffContainer.style.display = mode === 'ai' ? 'flex' : 'none';
        }

        const onlinePanel = this.dom.onlineControlsPanel;
        const sidebar = document.querySelector('.sidebar-column');
        if (onlinePanel) {
            onlinePanel.style.display = mode === 'online' ? 'block' : 'none';
        }
        if (sidebar) {
            sidebar.style.display = mode === 'online' ? 'flex' : 'none';
        }

        const hintBtn = this.dom.btnHint;
        if (hintBtn) {
            hintBtn.style.display = mode === 'online' ? 'none' : 'inline-flex';
        }

        // Update player labels
        this.updatePlayerLabels();

        if (mode === 'online') {
            // No longer opening modal, everything is seamless

        } else {
            this.online.disconnect();
            this.startNewGame();
        }
    }

    updatePlayerLabels() {
        const p1Name = document.getElementById('player-x-name');
        const p2Name = document.getElementById('player-o-name');
        const p1Sub = document.getElementById('player-x-sub');
        const p2Sub = document.getElementById('player-o-sub');

        if (this.gameMode === 'ai') {
            if (p1Name) p1Name.textContent = 'Bạn (X)';
            if (p1Sub) p1Sub.textContent = 'Đi trước';
            if (p2Name) p2Name.textContent = 'Trí tuệ nhân tạo (AI)';
            if (p2Sub) p2Sub.textContent = `Cấp độ: ${this.getDifficultyName()}`;
        } else if (this.gameMode === 'local') {
            if (p1Name) p1Name.textContent = 'Người chơi 1 (X)';
            if (p1Sub) p1Sub.textContent = 'Quân đen / đỏ';
            if (p2Name) p2Name.textContent = 'Người chơi 2 (O)';
            if (p2Sub) p2Sub.textContent = 'Quân trắng / lam';
        } else if (this.gameMode === 'online') {
            const myPiece = this.online.myPiece;
            if (myPiece === 'spectator') {
                if (p1Name) p1Name.textContent = 'Chủ phòng (X)';
                if (p2Name) p2Name.textContent = 'Người chơi (O)';
                if (p1Sub) p1Sub.textContent = 'Đi trước';
                if (p2Sub) p2Sub.textContent = 'Đi sau';
            } else
                if (p1Name) p1Name.textContent = myPiece === 'X' ? 'Bạn (X - Chủ phòng)' : 'Đối thủ (X)';
            if (p2Name) p2Name.textContent = myPiece === 'O' ? 'Bạn (O - Khách)' : 'Đối thủ (O)';
            if (p1Sub) p1Sub.textContent = 'Đi trước';
            if (p2Sub) p2Sub.textContent = 'Đi sau';
        }
    }

    getDifficultyName() {
        if (this.aiDifficulty === 'easy') return 'Tập sự';
        if (this.aiDifficulty === 'hard') return 'Đại kiện tướng';
        return 'Chiến lược';
    }

    startNewGame() {
        this.initBoardState();
        this.renderBoardGrid();
        this.updateUI();
        this.startTimer();
        if (this.caro3D) {
            this.caro3D.clearBoard();
        }
    }

    handleCellHover(r, c, cell) {
        if (this.isGameOver || this.board[r][c] !== null) return;
        if (this.gameMode === 'online' && this.currentTurn !== this.online.myPiece) return;
        if (this.gameMode === 'ai' && this.currentTurn !== 'X') return;

        cell.classList.add(`ghost-${this.currentTurn.toLowerCase()}`);
        if (!cell.querySelector('.ghost-preview')) {
            const preview = document.createElement('div');
            preview.className = 'ghost-preview';
            cell.appendChild(preview);
        }
    }

    handleCellLeave(cell) {
        cell.classList.remove('ghost-x', 'ghost-o');
        const preview = cell.querySelector('.ghost-preview');
        if (preview) {
            preview.remove();
        }
    }

    handleCellClick(r, c) {
        if (this.isGameOver) return;
        if (this.board[r][c] !== null) return;

        // Check turn permissions
        if (this.gameMode === 'online') {
            if (!this.online.isConnected) {
                this.showToast('Chưa kết nối với đối thủ!');
                return;
            }
            if (this.online.myPiece === 'spectator') {
                this.showToast('Khán giả không thể đặt quân!');
                return;
            }
            if (this.currentTurn !== this.online.myPiece) {
                this.showToast('Đang đợi đối thủ đi nước...');
                return;
            }
        } else if (this.gameMode === 'ai') {
            if (this.currentTurn !== 'X') return;
        }

        const playerMakingMove = this.currentTurn;
        this.makeMove(r, c, playerMakingMove);

        // If online mode, transmit move to peer
        if (this.gameMode === 'online') {
            this.online.sendMove(r, c, playerMakingMove);
        }

        // If AI mode and game not over, trigger AI response
        if (this.gameMode === 'ai' && !this.isGameOver && this.currentTurn === 'O') {
            this.triggerAIMove();
        }
    }

    /**
     * Executes a move on the board and verifies win/double-block states
     */
    makeMove(r, c, player) {
        this.board[r][c] = player;
        this.lastMove = { r, c, player };
        this.moveHistory.push({
            r,
            c,
            player,
            time: new Date().toLocaleTimeString(),
            label: this.getCoordLabel(r, c)
        });

        // Play tactile stone placement sound
        window.soundEngine.playStoneSnap(player);

        // Update DOM cell with animated 3D stone
        this.renderStone(r, c, player, true);
        if (this.caro3D && this.caro3D.enabled) {
            this.caro3D.addStone(r, c, player);
        }

        // Clear any previous hint
        this.clearHint();

        // Check Caro Rules: 5-in-a-row + "Không được chặn 2 đầu"
        const result = this.rules.checkMove(this.board, r, c, player);

        if (result.isWin) {
            this.handleWin(player, result.winningLine);
            return;
        }

        if (result.doubleBlocked) {
            // Player reached 5 in a row, but BOTH ends are blocked by opponent!
            // Highlight the blocked line and show educational rule notification
            this.handleDoubleBlocked(result.doubleBlockedLines);
        } else {
            this.hideRuleAlert();
        }

        if (result.isDraw) {
            this.handleDraw();
            return;
        }

        // Switch turn
        this.currentTurn = player === 'X' ? 'O' : 'X';
        this.resetTimer();
        this.startTimer();
        this.updateUI();
    }

    /**
     * Render 3D stone with entrance animation and last-move indicator
     */
    renderStone(r, c, player, isNew = false) {
        const cell = this.getCellElement(r, c);
        if (!cell) return;

        cell.classList.remove('ghost-x', 'ghost-o');

        // Remove old last-move indicators
        document.querySelectorAll('.board-cell.last-move').forEach(el => el.classList.remove('last-move'));

        const stone = document.createElement('div');
        stone.className = `stone stone-${player.toLowerCase()} ${isNew ? 'stone-drop-anim' : ''}`;

        // Add specular light reflection element inside stone
        const shine = document.createElement('div');
        shine.className = 'stone-shine';
        stone.appendChild(shine);

        cell.innerHTML = '';
        cell.appendChild(stone);
        cell.classList.add('last-move', 'occupied');
    }

    getCellElement(r, c) {
        return document.querySelector(`.board-cell[data-row="${r}"][data-col="${c}"]`);
    }

    /**
     * Handler when 5 in a row is blocked at both ends (Vietnamese Caro standard)
     */
    handleDoubleBlocked(lines) {
        window.soundEngine.playWarning();

        // Flash amber warning outline on the blocked stones
        lines.forEach(line => {
            line.forEach(({ r, c }) => {
                const cell = this.getCellElement(r, c);
                if (cell) {
                    cell.classList.add('double-blocked-pulse');
                    setTimeout(() => cell.classList.remove('double-blocked-pulse'), 3000);
                }
            });
        });

        this.showRuleAlert('⚠️ Chuỗi 5 bị chặn cả 2 đầu bởi quân đối thủ! Theo Luật Cờ Caro Việt Nam: Chưa tính thắng, trận đấu tiếp tục!');
    }

    showRuleAlert(message) {
        if (!this.dom.ruleAlertBanner) return;
        if (this.dom.ruleAlertText) this.dom.ruleAlertText.textContent = message;
        this.dom.ruleAlertBanner.classList.add('active');
    }

    hideRuleAlert() {
        if (this.dom.ruleAlertBanner) {
            this.dom.ruleAlertBanner.classList.remove('active');
        }
    }

    handleWin(player, winningLine) {
        this.isGameOver = true;
        this.winner = player;
        this.winningLine = winningLine;
        this.stopTimer();

        // Update score
        this.score[player]++;
        this.updateScoreDisplay();

        // Play victory sound
        window.soundEngine.playVictory();

        // Draw luminous win trace on winning stones
        if (winningLine && winningLine.length > 0) {
            if (this.caro3D && this.caro3D.enabled) {
                this.caro3D.highlightWin(winningLine);
            }
            winningLine.forEach(({ r, c }, idx) => {
                const cell = this.getCellElement(r, c);
                if (cell) {
                    setTimeout(() => {
                        cell.classList.add('winning-stone');
                    }, idx * 60);
                }
            });
        }

        // Show game over modal after slight dramatic delay
        setTimeout(() => {
            this.showGameOverModal(player);
        }, 1200);
    }

    handleDraw() {
        this.isGameOver = true;
        this.winner = 'TIE';
        this.stopTimer();
        this.score.ties++;
        this.updateScoreDisplay();

        setTimeout(() => {
            this.showGameOverModal('TIE');
        }, 800);
    }

    triggerAIMove() {
        // Show subtle thinking indicator
        const playerOCard = this.dom.playerOCard;
        if (playerOCard) playerOCard.classList.add('ai-thinking');

        // Human-like response latency (350ms - 550ms)
        const delay = Math.floor(350 + Math.random() * 200);

        setTimeout(() => {
            if (this.isGameOver) return;
            const bestMove = this.ai.findBestMove(this.board, this.aiDifficulty);
            if (playerOCard) playerOCard.classList.remove('ai-thinking');

            if (bestMove) {
                this.makeMove(bestMove.r, bestMove.c, 'O');
            }
        }, delay);
    }

    handleUndo() {
        if (this.isGameOver) return;
        if (this.moveHistory.length === 0) return;

        if (this.gameMode === 'online') {
            this.showToast('Đang gửi yêu cầu xin đi lại...');
            this.online.sendUndoRequest();
            return;
        }

        // In AI mode, undo 2 moves (both AI and player) so it's back to player's turn
        if (this.gameMode === 'ai') {
            if (this.moveHistory.length >= 2) {
                this.undoSingleMove();
                this.undoSingleMove();
            } else if (this.moveHistory.length === 1) {
                this.undoSingleMove();
            }
        } else {
            // Local 2-player mode: undo 1 move
            this.undoSingleMove();
        }

        this.currentTurn = this.moveHistory.length % 2 === 0 ? 'X' : 'O';
        this.resetTimer();
        this.startTimer();
        this.updateUI();
    }

    undoSingleMove() {
        const last = this.moveHistory.pop();
        if (!last) return;

        this.board[last.r][last.c] = null;
        if (this.caro3D) {
            this.caro3D.removeStone(last.r, last.c);
        }
        const cell = this.getCellElement(last.r, last.c);
        if (cell) {
            cell.innerHTML = '';
            cell.classList.remove('occupied', 'last-move', 'winning-stone', 'double-blocked-pulse');
        }

        // Highlight previous move if exists
        const prev = this.moveHistory[this.moveHistory.length - 1];
        if (prev) {
            this.lastMove = prev;
            const prevCell = this.getCellElement(prev.r, prev.c);
            if (prevCell) prevCell.classList.add('last-move');
        } else {
            this.lastMove = null;
        }
    }

    showHint() {
        if (this.isGameOver) return;
        if (this.gameMode === 'ai' && this.currentTurn !== 'X') return;

        const hintMove = this.ai.findBestMove(this.board, 'hard');
        if (!hintMove) return;

        this.clearHint();

        const cell = this.getCellElement(hintMove.r, hintMove.c);
        if (cell) {
            const beacon = document.createElement('div');
            beacon.className = 'hint-beacon';
            cell.appendChild(beacon);
            cell.classList.add('has-hint');

            this.showToast(`💡 Gợi ý nước đi: ${this.getCoordLabel(hintMove.r, hintMove.c)}`);
        }
    }

    clearHint() {
        document.querySelectorAll('.hint-beacon').forEach(el => el.remove());
        document.querySelectorAll('.has-hint').forEach(el => el.classList.remove('has-hint'));
    }

    startTimer() {
        this.stopTimer();
        if (this.turnTimeLimit <= 0) {
            this.updateTimerDisplay();
            return;
        }

        this.turnTimeLeft = this.turnTimeLimit;
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.turnTimeLeft--;
            this.updateTimerDisplay();

            if (this.turnTimeLeft <= 5 && this.turnTimeLeft > 0) {
                window.soundEngine.playTick();
            }

            if (this.turnTimeLeft <= 0) {
                this.stopTimer();
                this.handleTimeout();
            }
        }, 1000);
    }

    resetTimer() {
        this.turnTimeLeft = this.turnTimeLimit;
        this.updateTimerDisplay();
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    handleTimeout() {
        // Player ran out of time
        const loser = this.currentTurn;
        const winner = loser === 'X' ? 'O' : 'X';
        this.showToast(`⏱️ Hết giờ! ${loser === 'X' ? 'Quân X' : 'Quân O'} xử thua do hết thời gian.`);
        this.handleWin(winner, null);
    }

    updateTimerDisplay() {
        if (!this.dom.timerDisplay || !this.dom.timerProgress) return;

        if (this.turnTimeLimit <= 0) {
            this.dom.timerDisplay.textContent = '♾️';
            this.dom.timerProgress.style.width = '100%';
            this.dom.timerProgress.classList.remove('urgent');
            return;
        }

        this.dom.timerDisplay.textContent = `${this.turnTimeLeft}s`;

        const percentage = Math.max(0, (this.turnTimeLeft / this.turnTimeLimit) * 100);
        this.dom.timerProgress.style.width = `${percentage}%`;

        if (this.turnTimeLeft <= 5) {
            this.dom.timerProgress.classList.add('urgent');
        } else {
            this.dom.timerProgress.classList.remove('urgent');
        }
    }

    updateScoreDisplay() {
        if (this.dom.scoreX) this.dom.scoreX.textContent = this.score.X;
        if (this.dom.scoreO) this.dom.scoreO.textContent = this.score.O;
    }

    updateUI() {
        // Turn active card highlights
        if (this.dom.playerXCard && this.dom.playerOCard) {
            if (this.currentTurn === 'X') {
                this.dom.playerXCard.classList.add('active-turn');
                this.dom.playerOCard.classList.remove('active-turn');
            } else {
                this.dom.playerOCard.classList.add('active-turn');
                this.dom.playerXCard.classList.remove('active-turn');
            }
        }

        // Turn status text
        if (this.dom.turnIndicator) {
            const turnName = this.currentTurn === 'X' ? 'Quân X (Đen/Đỏ)' : 'Quân O (Trắng/Lam)';
            this.dom.turnIndicator.textContent = `Lượt đi: ${turnName}`;
        }

        // Move count badge
        if (this.dom.moveCountBadge) {
            this.dom.moveCountBadge.textContent = `${this.moveHistory.length} nước`;
        }

        // Render Move Log
        this.renderMoveLog();
    }

    renderMoveLog() {
        if (!this.dom.moveLogList) return;
        this.dom.moveLogList.innerHTML = '';

        this.moveHistory.slice(-12).reverse().forEach((mv, idx) => {
            const item = document.createElement('div');
            item.className = 'move-log-item';
            const moveNum = this.moveHistory.length - idx;
            item.innerHTML = `
                <span class="move-num">#${moveNum}</span>
                <span class="move-player move-${mv.player.toLowerCase()}">${mv.player}</span>
                <span class="move-coord">${mv.label}</span>
                <span class="move-time">${mv.time}</span>
            `;
            this.dom.moveLogList.appendChild(item);
        });
    }

    updateAudioButton(muted) {
        if (!this.dom.btnAudio) return;
        this.dom.btnAudio.innerHTML = muted ? '🔇 <span>Tắt âm</span>' : '🔊 <span>Bật âm</span>';
    }

    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'game-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }

    // Modal helpers
    openModal(modal) {
        if (modal) modal.classList.add('active');
    }

    closeModal(modal) {
        if (modal) modal.classList.remove('active');
    }

    showGameOverModal(winner) {
        const modal = this.dom.gameOverModal;
        if (!modal) return;

        const title = modal.querySelector('.modal-title');
        const desc = modal.querySelector('.game-over-desc');
        const stats = modal.querySelector('.game-over-stats');

        if (winner === 'TIE') {
            if (title) title.textContent = 'Trận Đấu Hòa!';
            if (desc) desc.textContent = 'Bàn cờ đã đầy và cả hai bên đều thi đấu xuất sắc.';
        } else {
            const winnerName = this.gameMode === 'ai'
                ? (winner === 'X' ? 'Bạn' : 'Máy (AI)')
                : (winner === 'X' ? 'Người chơi 1 (X)' : 'Người chơi 2 (O)');
            if (title) title.textContent = `🏆 ${winnerName} Chiến Thắng!`;
            if (desc) desc.textContent = `Tạo thành chuỗi 5 quân liên tiếp hợp lệ (không bị đối thủ chặn 2 đầu).`;
        }

        if (stats) {
            stats.innerHTML = `
                <div class="stat-pill"><span>Tổng nước đi:</span> <strong>${this.moveHistory.length}</strong></div>
                <div class="stat-pill"><span>Tỉ số X:</span> <strong>${this.score.X}</strong></div>
                <div class="stat-pill"><span>Tỉ số O:</span> <strong>${this.score.O}</strong></div>
            `;
        }

        const btnPlayAgain = modal.querySelector('.btn-play-again');
        if (btnPlayAgain) {
            btnPlayAgain.onclick = () => {
                this.closeModal(modal);
                this.startNewGame();
                if (this.gameMode === 'online') {
                    this.online.sendNewGame();
                }
            };
        }

        this.openModal(modal);
    }

    showConfirmModal(title, message, onConfirm) {
        const modal = this.dom.confirmModal;
        if (!modal) {
            if (confirm(`${title}\n${message}`)) onConfirm();
            return;
        }

        modal.querySelector('.confirm-title').textContent = title;
        modal.querySelector('.confirm-message').textContent = message;

        const btnConfirm = modal.querySelector('.btn-modal-confirm');
        const btnCancel = modal.querySelector('.btn-modal-cancel');

        btnConfirm.onclick = () => {
            this.closeModal(modal);
            onConfirm();
        };

        btnCancel.onclick = () => {
            this.closeModal(modal);
        };

        this.openModal(modal);
    }

    // ==========================================
    // Online Multiplayer Handlers
    // ==========================================

    handleCreateOnlineRoom() {
        const timeLimit = this.dom.onlineTimeSelect ? parseInt(this.dom.onlineTimeSelect.value, 10) : this.turnTimeLimit;
        this.setTimeLimit(timeLimit);
        const timeLabel = timeLimit > 0 ? `${timeLimit}s/lượt` : 'Vô hạn';

        if (this.dom.btnCreateRoom) {
            this.dom.btnCreateRoom.innerHTML = '⏳ Đang tạo...';
            this.dom.btnCreateRoom.disabled = true;
        }

        this.dom.onlineStatusText.textContent = `Đang khởi tạo phòng thi đấu (${timeLabel})...`;
        this.online.createRoom(timeLimit, (roomCode) => {
            this.dom.onlineRoomCodeDisplay.textContent = roomCode;
            this.dom.onlineStatusText.textContent = `Phòng đã sẵn sàng! Thời gian: ${timeLabel}. Hãy sao chép link hoặc gửi mã cho bạn bè.`;
            this.updatePlayerLabels();

            // Host avatar setup
            this.receiveOnlineAvatar('X', this.online.myAvatar);

            // Update URL and copy link
            const url = new URL(window.location.href);
            url.searchParams.set('room', roomCode);
            window.history.pushState({}, '', url);

            navigator.clipboard.writeText(url.toString()).then(() => {
                this.showToast(`✅ Đã tạo phòng ${roomCode} và copy link! Hãy gửi link cho bạn bè để chơi ngay.`);
            }).catch(() => {
                this.showToast(`✅ Đã tạo phòng ${roomCode}. Hãy copy link ở thanh địa chỉ web để gửi cho bạn bè!`);
            });

            this.closeModal(this.dom.onlineModal);

            if (this.dom.btnCreateRoom) {
                this.dom.btnCreateRoom.innerHTML = '🎲 Tạo phòng thi đấu';
                this.dom.btnCreateRoom.disabled = false;
            }
        });
    }

    handleJoinOnlineRoom(customCode) {
        const code = customCode || (this.dom.inputJoinCode ? this.dom.inputJoinCode.value.trim() : '');
        if (!code) {
            this.showToast('Vui lòng nhập mã phòng!');
            return;
        }

        if (this.dom.btnJoinRoom) {
            this.dom.btnJoinRoom.innerHTML = '⏳ Đang vào...';
            this.dom.btnJoinRoom.disabled = true;
        }

        this.dom.onlineStatusText.textContent = `Đang kết nối vào phòng ${code}...`;
        this.online.joinRoom(code, () => {
            this.dom.onlineRoomCodeDisplay.textContent = code;
            this.updatePlayerLabels();
            this.showToast(`✅ Đã kết nối vào phòng ${code} thành công!`);
            this.closeModal(this.dom.onlineModal);

            if (this.dom.btnJoinRoom) {
                this.dom.btnJoinRoom.innerHTML = 'Vào phòng';
                this.dom.btnJoinRoom.disabled = false;
            }
        }, () => {
            this.showToast(`❌ Không tìm thấy phòng ${code}!`);
            if (this.dom.btnJoinRoom) {
                this.dom.btnJoinRoom.innerHTML = 'Vào phòng';
                this.dom.btnJoinRoom.disabled = false;
            }
            this.dom.onlineStatusText.textContent = `Hệ thống: Phòng thi đấu P2P đã sẵn sàng!`;
        });
    }

    copyInviteLink() {
        const roomCode = this.online.roomCode || this.dom.onlineRoomCodeDisplay.textContent;
        if (!roomCode || roomCode === '------') {
            this.showToast('Chưa có mã phòng để sao chép!');
            return;
        }

        const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('📋 Đã sao chép link phòng! Hãy gửi cho bạn bè.');
        }).catch(() => {
            prompt('Sao chép link mời sau:', url);
        });
    }

    onOnlineConnected(info) {
        if (typeof info.timeLimit !== 'undefined') {
            this.setTimeLimit(info.timeLimit);
        }

        this.closeModal(this.dom.onlineModal);

        if (info.myPiece === 'spectator') {
            this.showToast(`🎉 Đã tham gia phòng ${info.roomCode} với tư cách KHÁN GIẢ!`);
            this.dom.onlineStatusText.textContent = `🟢 Bạn đang ở chế độ KHÁN GIẢ. Chỉ có thể xem.`;

            this.updatePlayerLabels();

            if (info.hostAvatar) this.receiveOnlineAvatar('X', info.hostAvatar);
            if (info.guestAvatar) this.receiveOnlineAvatar('O', info.guestAvatar);

            this.board = info.board || Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
            this.currentTurn = info.currentTurn || 'X';
            this.score = info.score || { X: 0, O: 0, ties: 0 };
            this.moveHistory = info.moveHistory || [];

            this.updateScoreDisplay();
            this.renderBoardGrid();

            for (let r = 0; r < this.boardSize; r++) {
                for (let c = 0; c < this.boardSize; c++) {
                    if (this.board[r][c] !== null) {
                        this.renderStone(r, c, this.board[r][c], false);
                    }
                }
            }

            // Mark last move if exists
            const lastMove = this.moveHistory[this.moveHistory.length - 1];
            if (lastMove) {
                const lastCell = this.getCellElement(lastMove.r, lastMove.c);
                if (lastCell) lastCell.classList.add('last-move');
            }

            this.updateUI();
        } else {
            const timeLabel = this.turnTimeLimit > 0 ? `${this.turnTimeLimit}s/lượt` : 'Vô hạn';
            this.showToast(`🎉 Đối thủ đã tham gia phòng ${info.roomCode}!`);
            this.dom.onlineStatusText.textContent = `🟢 Đã kết nối với đối thủ! Bạn cầm quân [${info.myPiece}]. Thời gian: ${timeLabel}.`;
            this.updatePlayerLabels();
            this.startNewGame();
        }
    }

    receiveOnlineAvatar(piece, avatar) {
        if (piece === 'X') {
            if (this.dom.playerXAvatar) this.dom.playerXAvatar.textContent = avatar;
        } else if (piece === 'O') {
            if (this.dom.playerOAvatar) this.dom.playerOAvatar.textContent = avatar;
        }
    }

    onOnlineDisconnected() {
        this.showToast('⚠️ Mất kết nối với đối thủ!');
        if (this.dom.onlineStatusText) {
            this.dom.onlineStatusText.textContent = '🔴 Đã ngắt kết nối với đối thủ.';
        }
    }

    updatePingDisplay(ms) {
        if (!this.dom.onlinePingDisplay) return;
        this.dom.onlinePingDisplay.textContent = `${ms} ms`;
        if (ms < 80) {
            this.dom.onlinePingDisplay.className = 'ping-good';
        } else if (ms < 180) {
            this.dom.onlinePingDisplay.className = 'ping-fair';
        } else {
            this.dom.onlinePingDisplay.className = 'ping-poor';
        }
    }

    receiveOnlineMove(r, c, player) {
        if (player !== this.currentTurn) return;
        this.makeMove(r, c, player);
    }

    receiveOnlineNewGame() {
        this.showToast('Đối thủ đã bắt đầu ván mới!');
        this.startNewGame();
    }

    receiveOnlineUndoRequest() {
        this.showConfirmModal('Đối thủ xin đi lại', 'Đối thủ muốn rút lại nước đi vừa rồi. Bạn có đồng ý không?', () => {
            this.online.sendUndoResponse(true);
            this.undoSingleMove();
            this.currentTurn = this.moveHistory.length % 2 === 0 ? 'X' : 'O';
            this.resetTimer();
            this.updateUI();
        });
    }

    receiveOnlineUndoResponse(accepted) {
        if (accepted) {
            this.showToast('Đối thủ đã đồng ý cho đi lại!');
            this.undoSingleMove();
            this.currentTurn = this.moveHistory.length % 2 === 0 ? 'X' : 'O';
            this.resetTimer();
            this.updateUI();
        } else {
            this.showToast('Đối thủ không đồng ý cho đi lại.');
        }
    }

    receiveOnlineResign() {
        this.showToast('Đối thủ đã đầu hàng!');
        const winner = this.online.myPiece;
        this.handleWin(winner, null);
    }

    sendEmote(emoji) {
        window.soundEngine.playPop();
        this.showFloatingEmote(emoji, true);
        if (this.gameMode === 'online') {
            this.online.sendEmote(emoji);
        }
    }

    receiveOnlineEmote(emoji) {
        window.soundEngine.playPop();
        this.showFloatingEmote(emoji, false);
    }

    showFloatingEmote(emoji, isMe = true) {
        const bubble = document.createElement('div');
        bubble.className = `floating-emote ${isMe ? 'from-me' : 'from-opponent'}`;
        bubble.textContent = emoji;

        const targetCard = isMe ? this.dom.playerXCard : this.dom.playerOCard;
        if (targetCard) {
            targetCard.appendChild(bubble);
            setTimeout(() => bubble.remove(), 2500);
        }
    }

    sendChatMessage() {
        const text = this.dom.chatInput.value.trim();
        if (!text) return;

        this.addChatMessage(text, 'me');
        this.dom.chatInput.value = '';

        if (this.gameMode === 'online') {
            this.online.sendChat(text);
        }
    }

    receiveOnlineChat(text) {
        window.soundEngine.playPop();
        this.addChatMessage(text, 'opponent');
    }

    addChatMessage(text, sender) {
        if (!this.dom.chatMessages) return;

        const msgEl = document.createElement('div');
        msgEl.className = `chat-msg msg-${sender}`;
        msgEl.innerHTML = `<strong>${sender === 'me' ? 'Bạn' : 'Đối thủ'}:</strong> ${this.escapeHTML(text)}`;

        this.dom.chatMessages.appendChild(msgEl);
        this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight;
    }

    escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }
}

// Instantiate game on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.caroGame = new CaroGame();
});
