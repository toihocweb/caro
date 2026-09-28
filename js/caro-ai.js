/**
 * Caro AI Engine - Intelligent Opponent with Vietnamese Double-Block Awareness
 * Levels: 'easy', 'medium', 'hard'
 */
class CaroAI {
    constructor(rules, playerPiece = 'O') {
        this.rules = rules;
        this.aiPiece = playerPiece;
        this.humanPiece = playerPiece === 'X' ? 'O' : 'X';

        // Pattern score weights
        this.SCORES = {
            WIN: 10000000,          // 5-in-a-row open or 1-end blocked
            OPEN_4: 1000000,        // _ X X X X _ (Unstoppable win)
            BLOCKED_4: 80000,       // O X X X X _ (Must answer immediately)
            OPEN_3: 15000,          // _ X X X _ (Major offensive threat)
            BLOCKED_3: 2000,        // O X X X _
            OPEN_2: 400,            // _ X X _
            BLOCKED_2: 50           // O X X _
        };
    }

    /**
     * Compute next move for AI based on selected difficulty
     */
    findBestMove(board, difficulty = 'medium') {
        // If board is empty, play center
        const center = Math.floor(this.rules.size / 2);
        if (this.isBoardEmpty(board)) {
            return { r: center, c: center };
        }

        // Get candidate moves (only cells within radius 2 of existing stones)
        const candidates = this.getCandidateMoves(board, 2);
        if (candidates.length === 0) {
            return { r: center, c: center };
        }

        if (difficulty === 'easy') {
            return this.getMoveEasy(board, candidates);
        } else if (difficulty === 'medium') {
            return this.getMoveMedium(board, candidates);
        } else {
            return this.getMoveHard(board, candidates);
        }
    }

    isBoardEmpty(board) {
        for (let r = 0; r < this.rules.size; r++) {
            for (let c = 0; c < this.rules.size; c++) {
                if (board[r][c]) return false;
            }
        }
        return true;
    }

    /**
     * Get empty cells close to occupied cells (optimizes search space)
     */
    getCandidateMoves(board, distance = 2) {
        const candidates = [];
        const seen = new Set();
        const size = this.rules.size;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c]) {
                    for (let dr = -distance; dr <= distance; dr++) {
                        for (let dc = -distance; dc <= distance; dc++) {
                            const nr = r + dr;
                            const nc = c + dc;
                            const key = `${nr},${nc}`;
                            if (this.rules.isValidCoord(nr, nc) && !board[nr][nc] && !seen.has(key)) {
                                seen.add(key);
                                candidates.push({ r: nr, c: nc });
                            }
                        }
                    }
                }
            }
        }
        return candidates;
    }

    /**
     * Easy: Basic heuristic with occasional sub-optimal choices
     */
    getMoveEasy(board, candidates) {
        // Check immediate winning move for AI
        for (const move of candidates) {
            board[move.r][move.c] = this.aiPiece;
            const res = this.rules.checkMove(board, move.r, move.c, this.aiPiece);
            board[move.r][move.c] = null;
            if (res.isWin) return move;
        }

        // Check immediate block for human win
        for (const move of candidates) {
            board[move.r][move.c] = this.humanPiece;
            const res = this.rules.checkMove(board, move.r, move.c, this.humanPiece);
            board[move.r][move.c] = null;
            if (res.isWin) return move;
        }

        // Score moves with noise
        let bestMove = candidates[0];
        let bestScore = -Infinity;

        for (const move of candidates) {
            const attack = this.evaluatePoint(board, move.r, move.c, this.aiPiece);
            const defense = this.evaluatePoint(board, move.r, move.c, this.humanPiece);
            const noise = (Math.random() - 0.5) * 500;
            const score = attack + defense * 0.85 + noise;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        return bestMove;
    }

    /**
     * Medium: Full heuristic evaluation balancing offense and defense
     */
    getMoveMedium(board, candidates) {
        // 1. Immediate win
        for (const move of candidates) {
            board[move.r][move.c] = this.aiPiece;
            const res = this.rules.checkMove(board, move.r, move.c, this.aiPiece);
            board[move.r][move.c] = null;
            if (res.isWin) return move;
        }

        // 2. Urgent defense (block opponent win)
        for (const move of candidates) {
            board[move.r][move.c] = this.humanPiece;
            const res = this.rules.checkMove(board, move.r, move.c, this.humanPiece);
            board[move.r][move.c] = null;
            if (res.isWin) return move;
        }

        let bestMove = candidates[0];
        let bestScore = -Infinity;

        for (const move of candidates) {
            const attack = this.evaluatePoint(board, move.r, move.c, this.aiPiece);
            const defense = this.evaluatePoint(board, move.r, move.c, this.humanPiece);
            // Defend aggressively if human has strong threat
            const score = attack * 1.1 + defense * 1.25;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        return bestMove;
    }

    /**
     * Hard (Grandmaster): Heuristic-filtered Minimax with Alpha-Beta Pruning
     */
    getMoveHard(board, candidates) {
        // 1. Check immediate win
        for (const move of candidates) {
            board[move.r][move.c] = this.aiPiece;
            const res = this.rules.checkMove(board, move.r, move.c, this.aiPiece);
            board[move.r][move.c] = null;
            if (res.isWin) return move;
        }

        // 2. Check immediate opponent win to block
        for (const move of candidates) {
            board[move.r][move.c] = this.humanPiece;
            const res = this.rules.checkMove(board, move.r, move.c, this.humanPiece);
            board[move.r][move.c] = null;
            if (res.isWin) return move;
        }

        // Sort candidates by heuristic score to explore best branches first
        const scoredMoves = candidates.map(move => {
            const attack = this.evaluatePoint(board, move.r, move.c, this.aiPiece);
            const defense = this.evaluatePoint(board, move.r, move.c, this.humanPiece);
            return {
                move,
                score: attack + defense * 1.15
            };
        });

        scoredMoves.sort((a, b) => b.score - a.score);

        // Pick top 10 candidates for Minimax depth 2-3
        const topMoves = scoredMoves.slice(0, 10).map(item => item.move);

        let bestMove = topMoves[0];
        let alpha = -Infinity;
        const beta = Infinity;
        const depth = 2; // Fast and deep enough with candidate pruning

        for (const move of topMoves) {
            board[move.r][move.c] = this.aiPiece;
            const evalScore = this.minimax(board, depth - 1, alpha, beta, false);
            board[move.r][move.c] = null;

            if (evalScore > alpha) {
                alpha = evalScore;
                bestMove = move;
            }
        }
        return bestMove;
    }

    minimax(board, depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return this.evaluateBoard(board);
        }

        const candidates = this.getCandidateMoves(board, 1).slice(0, 8);
        if (candidates.length === 0) return 0;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of candidates) {
                board[move.r][move.c] = this.aiPiece;
                const res = this.rules.checkMove(board, move.r, move.c, this.aiPiece);
                let score;
                if (res.isWin) {
                    score = this.SCORES.WIN + depth * 1000;
                } else {
                    score = this.minimax(board, depth - 1, alpha, beta, false);
                }
                board[move.r][move.c] = null;

                maxEval = Math.max(maxEval, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of candidates) {
                board[move.r][move.c] = this.humanPiece;
                const res = this.rules.checkMove(board, move.r, move.c, this.humanPiece);
                let score;
                if (res.isWin) {
                    score = -this.SCORES.WIN - depth * 1000;
                } else {
                    score = this.minimax(board, depth - 1, alpha, beta, true);
                }
                board[move.r][move.c] = null;

                minEval = Math.min(minEval, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    /**
     * Evaluate overall board value for AI
     */
    evaluateBoard(board) {
        let aiScore = 0;
        let humanScore = 0;

        // Sample evaluation around active stones
        const candidates = this.getCandidateMoves(board, 1);
        for (const cell of candidates) {
            aiScore += this.evaluatePoint(board, cell.r, cell.c, this.aiPiece) * 0.1;
            humanScore += this.evaluatePoint(board, cell.r, cell.c, this.humanPiece) * 0.1;
        }
        return aiScore - humanScore * 1.1;
    }

    /**
     * Evaluate value of a point (r, c) for player P
     * Checks all 4 directions and handles the double-block rule
     */
    evaluatePoint(board, r, c, player) {
        const opponent = player === 'X' ? 'O' : 'X';
        let totalScore = 0;

        for (const dir of this.rules.DIRECTIONS) {
            // Count friendly stones in both ways
            let count = 1;
            let blockedEnds = 0;

            // Step forward
            let forwardR = r + dir.dr;
            let forwardC = c + dir.dc;
            while (this.rules.isValidCoord(forwardR, forwardC) && board[forwardR][forwardC] === player) {
                count++;
                forwardR += dir.dr;
                forwardC += dir.dc;
            }
            if (this.rules.isCellBlockedByOpponent(board, forwardR, forwardC, opponent)) {
                blockedEnds++;
            }

            // Step backward
            let backwardR = r - dir.dr;
            let backwardC = c - dir.dc;
            while (this.rules.isValidCoord(backwardR, backwardC) && board[backwardR][backwardC] === player) {
                count++;
                backwardR -= dir.dr;
                backwardC -= dir.dc;
            }
            if (this.rules.isCellBlockedByOpponent(board, backwardR, backwardC, opponent)) {
                blockedEnds++;
            }

            // Scoring based on length and Vietnamese double-block rule
            if (count >= 5) {
                if (blockedEnds === 2) {
                    // Double-blocked 5-in-a-row: NO WIN in Vietnamese rules!
                    // Worth little because it's dead
                    totalScore += 50;
                } else {
                    totalScore += this.SCORES.WIN;
                }
            } else if (count === 4) {
                if (blockedEnds === 0) {
                    totalScore += this.SCORES.OPEN_4;
                } else if (blockedEnds === 1) {
                    totalScore += this.SCORES.BLOCKED_4;
                }
                // if blockedEnds === 2, it's blocked 4 on both ends, dead
            } else if (count === 3) {
                if (blockedEnds === 0) {
                    totalScore += this.SCORES.OPEN_3;
                } else if (blockedEnds === 1) {
                    totalScore += this.SCORES.BLOCKED_3;
                }
            } else if (count === 2) {
                if (blockedEnds === 0) {
                    totalScore += this.SCORES.OPEN_2;
                } else if (blockedEnds === 1) {
                    totalScore += this.SCORES.BLOCKED_2;
                }
            }
        }
        return totalScore;
    }
}

// Global export
window.CaroAI = CaroAI;
