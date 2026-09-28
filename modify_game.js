const fs = require('fs');
const file = '/Users/I754010/Documents/caro/js/game.js';
let content = fs.readFileSync(file, 'utf8');

// 1. cacheDOM
content = content.replace("chatMessages: document.getElementById('chat-messages'),", 
`chatMessages: document.getElementById('chat-messages'),
            avatarSelector: document.getElementById('avatar-selector'),
            playerXAvatar: document.querySelector('.player-x .avatar-stone'),
            playerOAvatar: document.querySelector('.player-o .avatar-stone'),`);

// 2. bindEvents
content = content.replace("if (this.dom.emoteBar) {", 
`if (this.dom.avatarSelector) {
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

        if (this.dom.emoteBar) {`);

// 3. updatePlayerLabels
content = content.replace("const myPiece = this.online.myPiece;", 
`const myPiece = this.online.myPiece;
            if (myPiece === 'spectator') {
                if (p1Name) p1Name.textContent = 'Chủ phòng (X)';
                if (p2Name) p2Name.textContent = 'Người chơi (O)';
                if (p1Sub) p1Sub.textContent = 'Đi trước';
                if (p2Sub) p2Sub.textContent = 'Đi sau';
            } else`);

// 4. startNewGame
content = content.replace("this.startTimer();",
`this.startTimer();
        
        if (this.gameMode !== 'online') {
            this.receiveOnlineAvatar('X', '✕');
            this.receiveOnlineAvatar('O', this.gameMode === 'ai' ? '🤖' : '○');
        }`);

// 5. handleCellClick permissions
content = content.replace("if (this.currentTurn !== this.online.myPiece) {",
`if (this.online.myPiece === 'spectator') {
                this.showToast('Khán giả không thể đặt quân!');
                return;
            }
            if (this.currentTurn !== this.online.myPiece) {`);

// 6. handleUndo permissions
content = content.replace("if (this.gameMode === 'online') {",
`if (this.gameMode === 'online') {
            if (this.online.myPiece === 'spectator') {
                this.showToast('Khán giả không thể đi lại!');
                return;
            }`);

// 7. onOnlineConnected
content = content.replace(/onOnlineConnected\(info\) \{([\s\S]*?)onOnlineDisconnected\(\) \{/m, 
`onOnlineConnected(info) {
        if (typeof info.timeLimit !== 'undefined') {
            this.setTimeLimit(info.timeLimit);
        }
        
        this.closeModal(this.dom.onlineModal);

        if (info.myPiece === 'spectator') {
            this.showToast(\`🎉 Đã tham gia phòng \${info.roomCode} với tư cách KHÁN GIẢ!\`);
            this.dom.onlineStatusText.textContent = \`🟢 Bạn đang ở chế độ KHÁN GIẢ. Chỉ có thể xem.\`;
            
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
            const timeLabel = this.turnTimeLimit > 0 ? \`\${this.turnTimeLimit}s/lượt\` : 'Vô hạn';
            this.showToast(\`🎉 Đối thủ đã tham gia phòng \${info.roomCode}!\`);
            this.dom.onlineStatusText.textContent = \`🟢 Đã kết nối với đối thủ! Bạn cầm quân [\${info.myPiece}]. Thời gian: \${timeLabel}.\`;
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

    onOnlineDisconnected() {`);

fs.writeFileSync(file, content, 'utf8');
