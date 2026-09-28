/**
 * Caro Game Rules Engine - Vietnamese Gomoku Standard
 * Strict enforcement of the "Không được chặn 2 đầu" (Double-Block Rule).
 */
class CaroRules {
    constructor(size = 15, options = {}) {
        this.size = size;
        this.options = {
            blockEdge: false,       // Default: Only opponent stones block, board edge does NOT count as block
            allowOverline: true,    // 5 or more consecutive stones count as win if not double-blocked
            ...options
        };
        // 4 Directions: [rowDelta, colDelta]
        this.DIRECTIONS = [
            { dr: 0, dc: 1, name: 'horizontal' },    // Ngang (→)
            { dr: 1, dc: 0, name: 'vertical' },      // Dọc (↓)
            { dr: 1, dc: 1, name: 'main-diagonal' }, // Chéo chính (↘)
            { dr: 1, dc: -1, name: 'anti-diagonal' } // Chéo phụ (↙)
        ];
    }

    /**
     * Check if coordinates (r, c) are within board bounds
     */
    isValidCoord(r, c) {
        return r >= 0 && r < this.size && c >= 0 && c < this.size;
    }

    /**
     * Check board state after a move at (r, c) by player ('X' or 'O')
     * Returns: {
     *   isWin: boolean,
     *   winningLine: Array<{r, c}> | null,
     *   doubleBlocked: boolean,
     *   doubleBlockedLines: Array<Array<{r, c}>>,
     *   isDraw: boolean
     * }
     */
    checkMove(board, lastR, lastC, player) {
        const opponent = player === 'X' ? 'O' : 'X';
        let winningLine = null;
        const doubleBlockedLines = [];

        for (const dir of this.DIRECTIONS) {
            // Find full contiguous line of player's stones passing through (lastR, lastC)
            const lineData = this.getConsecutiveLine(board, lastR, lastC, dir.dr, dir.dc, player);
            const count = lineData.stones.length;

            if (count >= 5) {
                // Check endpoints
                const head = lineData.head; // cell right before first stone
                const tail = lineData.tail; // cell right after last stone

                const headBlocked = this.isCellBlockedByOpponent(board, head.r, head.c, opponent);
                const tailBlocked = this.isCellBlockedByOpponent(board, tail.r, tail.c, opponent);

                if (headBlocked && tailBlocked) {
                    // DOUBLE BLOCKED! (O X X X X X O)
                    // According to Vietnamese Caro rules: NOT A WIN!
                    doubleBlockedLines.push(lineData.stones);
                } else {
                    // At least one end is open or not blocked by opponent
                    if (this.options.allowOverline || count === 5) {
                        winningLine = lineData.stones;
                        break; // Found winning line
                    }
                }
            }
        }

        const isWin = winningLine !== null;
        const isDraw = !isWin && this.isBoardFull(board);

        return {
            isWin,
            winningLine,
            doubleBlocked: doubleBlockedLines.length > 0 && !isWin,
            doubleBlockedLines,
            isDraw
        };
    }

    /**
     * Trace continuous stones in direction (dr, dc)
     */
    getConsecutiveLine(board, r, c, dr, dc, player) {
        const stones = [{ r, c }];

        // Trace backward (-dr, -dc)
        let backwardR = r - dr;
        let backwardC = c - dc;
        while (this.isValidCoord(backwardR, backwardC) && board[backwardR][backwardC] === player) {
            stones.unshift({ r: backwardR, c: backwardC });
            backwardR -= dr;
            backwardC -= dc;
        }
        const head = { r: backwardR, c: backwardC };

        // Trace forward (+dr, +dc)
        let forwardR = r + dr;
        let forwardC = c + dc;
        while (this.isValidCoord(forwardR, forwardC) && board[forwardR][forwardC] === player) {
            stones.push({ r: forwardR, c: forwardC });
            forwardR += dr;
            forwardC += dc;
        }
        const tail = { r: forwardR, c: forwardC };

        return { stones, head, tail };
    }

    /**
     * Determines whether an endpoint is considered "blocked"
     */
    isCellBlockedByOpponent(board, r, c, opponent) {
        if (!this.isValidCoord(r, c)) {
            // Reached board boundary
            return this.options.blockEdge;
        }
        // Blocked if occupied by opponent piece
        return board[r][c] === opponent;
    }

    /**
     * Checks if all cells on the board are occupied
     */
    isBoardFull(board) {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (board[r][c] === null || board[r][c] === '') {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Comprehensive scan of entire board to find any existing win or double-blocked lines
     */
    scanBoard(board) {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const player = board[r][c];
                if (!player) continue;

                for (const dir of this.DIRECTIONS) {
                    // Check only if this cell is the start of a sequence in this direction
                    const prevR = r - dir.dr;
                    const prevC = c - dir.dc;
                    if (this.isValidCoord(prevR, prevC) && board[prevR][prevC] === player) {
                        continue; // Not the head, skip to avoid duplicate checks
                    }

                    const lineData = this.getConsecutiveLine(board, r, c, dir.dr, dir.dc, player);
                    if (lineData.stones.length >= 5) {
                        const opponent = player === 'X' ? 'O' : 'X';
                        const headBlocked = this.isCellBlockedByOpponent(board, lineData.head.r, lineData.head.c, opponent);
                        const tailBlocked = this.isCellBlockedByOpponent(board, lineData.tail.r, lineData.tail.c, opponent);

                        if (!headBlocked || !tailBlocked) {
                            return { isWin: true, winner: player, winningLine: lineData.stones };
                        }
                    }
                }
            }
        }
        return { isWin: false, winner: null, winningLine: null };
    }
}

// Global export for vanilla browser usage
window.CaroRules = CaroRules;
