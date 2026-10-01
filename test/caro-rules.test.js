const fs = require('fs');
const vm = require('vm');

// Load js/caro-rules.js into sandbox
const rulesCode = fs.readFileSync('js/caro-rules.js', 'utf8');
const aiCode = fs.readFileSync('js/caro-ai.js', 'utf8');

const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(rulesCode, sandbox);
vm.runInContext(aiCode, sandbox);

const CaroRules = sandbox.window.CaroRules;
const CaroAI = sandbox.window.CaroAI;

console.log('🧪 Starting Caro Rules & Double-Block Verification Tests...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passedTests++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        throw new Error(`Test failed: ${message}`);
    }
}

// -------------------------------------------------------------
// Test 1: Horizontal Line Cases
// -------------------------------------------------------------
console.log('--- Test Suite 1: Horizontal "Chặn 2 Đầu" Rule Checks ---');

const rules = new CaroRules(15);
let board = Array(15).fill(null).map(() => Array(15).fill(null));

// Case 1A: Both ends open (_ X X X X X _)
// Row 7, Cols 4-8 are X. Cols 3 and 9 are empty.
for (let c = 4; c <= 8; c++) board[7][c] = 'X';
let res = rules.checkMove(board, 7, 8, 'X');
assert(res.isWin === true, 'Chuỗi 5 mở 2 đầu (_ X X X X X _) phải THẮNG');
assert(res.doubleBlocked === false, 'Không bị chặn 2 đầu');

// Case 1B: Blocked at left end only (O X X X X X _)
board[7][3] = 'O'; // Block left end
res = rules.checkMove(board, 7, 8, 'X');
assert(res.isWin === true, 'Chuỗi 5 bị chặn 1 đầu bên trái (O X X X X X _) vẫn THẮNG');
assert(res.doubleBlocked === false, 'Chặn 1 đầu không tính là double-blocked');

// Case 1C: Blocked at BOTH ends (O X X X X X O) -> Vietnamese Caro Double Block Rule!
board[7][9] = 'O'; // Block right end
res = rules.checkMove(board, 7, 8, 'X');
assert(res.isWin === false, 'CHẶN CẢ 2 ĐẦU (O X X X X X O) KHÔNG ĐƯỢC THẮNG!');
assert(res.doubleBlocked === true, 'Phải đánh dấu doubleBlocked = true');
assert(res.doubleBlockedLines.length === 1, 'Báo cáo chính xác 1 dòng bị chặn 2 đầu');

// -------------------------------------------------------------
// Test 2: Vertical Line Cases
// -------------------------------------------------------------
console.log('\n--- Test Suite 2: Vertical "Chặn 2 Đầu" Rule Checks ---');
board = Array(15).fill(null).map(() => Array(15).fill(null));

// Cols 5, Rows 4-8 are X
for (let r = 4; r <= 8; r++) board[r][5] = 'X';
res = rules.checkMove(board, 8, 5, 'X');
assert(res.isWin === true, 'Hàng dọc 5 quân mở 2 đầu phải THẮNG');

// Block top end
board[3][5] = 'O';
res = rules.checkMove(board, 8, 5, 'X');
assert(res.isWin === true, 'Hàng dọc chặn 1 đầu trên (O X X X X X _) vẫn THẮNG');

// Block bottom end -> Both ends blocked!
board[9][5] = 'O';
res = rules.checkMove(board, 8, 5, 'X');
assert(res.isWin === false, 'Hàng dọc chặn 2 đầu (O X X X X X O) KHÔNG ĐƯỢC THẮNG');
assert(res.doubleBlocked === true, 'Hàng dọc đánh dấu doubleBlocked = true');

// -------------------------------------------------------------
// Test 3: Diagonal Main (\) Cases
// -------------------------------------------------------------
console.log('\n--- Test Suite 3: Diagonal Main (\) Checks ---');
board = Array(15).fill(null).map(() => Array(15).fill(null));

// (3,3) to (7,7) are X
for (let i = 0; i < 5; i++) board[3 + i][3 + i] = 'X';
board[2][2] = 'O'; // Block top-left
board[8][8] = 'O'; // Block bottom-right
res = rules.checkMove(board, 7, 7, 'X');
assert(res.isWin === false, 'Đường chéo chính chặn 2 đầu KHÔNG THẮNG');
assert(res.doubleBlocked === true, 'Đường chéo chính đánh dấu doubleBlocked = true');

// Unblock one end
board[8][8] = null;
res = rules.checkMove(board, 7, 7, 'X');
assert(res.isWin === true, 'Đường chéo chính mở 1 đầu phải THẮNG');

// -------------------------------------------------------------
// Test 4: Diagonal Anti (/) Cases
// -------------------------------------------------------------
console.log('\n--- Test Suite 4: Diagonal Anti (/) Checks ---');
board = Array(15).fill(null).map(() => Array(15).fill(null));

// (7,3) to (3,7) are X -> dr: 1, dc: -1 from top-right to bottom-left
// (3,7), (4,6), (5,5), (6,4), (7,3)
const antiCoords = [{r:3, c:7}, {r:4, c:6}, {r:5, c:5}, {r:6, c:4}, {r:7, c:3}];
antiCoords.forEach(({r, c}) => board[r][c] = 'X');

// Block both ends: (2,8) and (8,2)
board[2][8] = 'O';
board[8][2] = 'O';

res = rules.checkMove(board, 5, 5, 'X');
assert(res.isWin === false, 'Đường chéo phụ chặn 2 đầu KHÔNG THẮNG');
assert(res.doubleBlocked === true, 'Đường chéo phụ đánh dấu doubleBlocked = true');

// -------------------------------------------------------------
// Test 5: AI Engine Decision Testing
// -------------------------------------------------------------
console.log('\n--- Test Suite 5: AI Engine Defense & Offense Checks ---');
const ai = new CaroAI(rules, 'O');

// Test 5A: AI must block an open 4 of opponent
board = Array(15).fill(null).map(() => Array(15).fill(null));
// X has 4 in a row at (7, 5), (7, 6), (7, 7), (7, 8)
for (let c = 5; c <= 8; c++) board[7][c] = 'X';

let aiMove = ai.findBestMove(board, 'medium');
assert(
    (aiMove.r === 7 && aiMove.c === 4) || (aiMove.r === 7 && aiMove.c === 9),
    `AI phải chặn ngay 1 trong 2 đầu của chuỗi 4 nguy hiểm (AI chọn: ${aiMove.r},${aiMove.c})`
);

// Test 5B: AI takes immediate win when available
board = Array(15).fill(null).map(() => Array(15).fill(null));
for (let c = 4; c <= 7; c++) board[7][c] = 'O'; // AI has 4 open
aiMove = ai.findBestMove(board, 'hard');
assert(
    (aiMove.r === 7 && aiMove.c === 3) || (aiMove.r === 7 && aiMove.c === 8),
    `AI phải lập tức đánh vào ô thắng (AI chọn: ${aiMove.r},${aiMove.c})`
);

console.log(`\n🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
