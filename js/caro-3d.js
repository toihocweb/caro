/**
 * Caro 3D Engine
 * Uses Three.js for premium 3D visualization of the Gomoku board
 */
class Caro3D {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.boardSize = 15;
        this.enabled = false;
        this.pieceStyle = 'modern'; // 'modern', 'classic', 'crystal', 'cyberpunk', 'cube'
        
        // Settings
        this.cellSize = 2; // Size of each cell
        this.boardWidth = this.boardSize * this.cellSize;
        this.boardThickness = 2;
        
        this.container = document.getElementById('board-3d-container');
        this.board2D = document.getElementById('goban-board');
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        this.stones = [];
        this.ghostStone = null;
        
        // Materials
        this.materials = {};
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.lastHoverCoord = null;
        
        this.init();
    }
    
    init() {
        if (!THREE) {
            console.error("Three.js not loaded!");
            return;
        }

        // Setup Scene
        this.scene = new THREE.Scene();
        this.scene.background = null; // transparent to show app background
        
        // Setup Camera
        const aspect = this.container.clientWidth / this.container.clientHeight || 1;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 35, 25);
        
        // Setup Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth || 500, this.container.clientHeight || 500);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
        this.container.appendChild(this.renderer.domElement);
        
        // Setup Controls
        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2.1; // Don't go below ground
            this.controls.minDistance = 10;
            this.controls.maxDistance = 60;
        }
        
        // Lighting
        this.setupLighting();
        
        // Materials
        this.setupMaterials();
        
        // Build Board
        this.buildBoard();
        
        // Ghost Stone (for hover)
        this.createGhostStone();
        
        // Events
        this.bindEvents();
        
        // Animation Loop
        this.animate = this.animate.bind(this);
        this.renderer.setAnimationLoop(this.animate);
        
        // Handle Resize
        window.addEventListener('resize', () => this.resize());
        // Initial resize to fit container
        setTimeout(() => this.resize(), 100);
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 40, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        dirLight.shadow.bias = -0.001;
        this.scene.add(dirLight);
        
        const pointLight = new THREE.PointLight(0xffeedd, 0.3);
        pointLight.position.set(-15, 10, -15);
        this.scene.add(pointLight);
    }
    
    setupMaterials() {
        // Wood theme is default
        this.materials.board = new THREE.MeshStandardMaterial({
            color: 0xd7a15c,
            roughness: 0.8,
            metalness: 0.1,
        });
        
        this.materials.boardLines = new THREE.MeshBasicMaterial({ color: 0x3a1e08 });
        
        this.materials.ghost = new THREE.MeshStandardMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.4,
            roughness: 0.5
        });
        
        // This will set stoneX, stoneO and rebuild stones (which is empty right now)
        this.setPieceStyle(this.pieceStyle);
    }
    
    setTheme(themeName) {
        if (themeName === 'wood') {
            this.materials.board.color.setHex(0xd7a15c);
            this.materials.boardLines.color.setHex(0x3a1e08);
        } else if (themeName === 'slate') {
            this.materials.board.color.setHex(0x272e38);
            this.materials.boardLines.color.setHex(0xb4c3d7);
        } else if (themeName === 'jade') {
            this.materials.board.color.setHex(0x1c3b2b);
            this.materials.boardLines.color.setHex(0xd4af37);
        }
    }
    
    setPieceStyle(styleName) {
        this.pieceStyle = styleName;
        
        // Update Materials based on style
        if (styleName === 'classic') {
            this.materials.stoneX = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.1 });
            this.materials.stoneO = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.2, metalness: 0.1 });
        } else if (styleName === 'modern') {
            this.materials.stoneX = new THREE.MeshPhysicalMaterial({ color: 0xef4444, roughness: 0.1, metalness: 0.8, clearcoat: 1.0 });
            this.materials.stoneO = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.8, clearcoat: 1.0 });
        } else if (styleName === 'crystal') {
            this.materials.stoneX = new THREE.MeshPhysicalMaterial({ color: 0xff0088, transmission: 0.9, opacity: 1, metalness: 0.1, roughness: 0, ior: 1.5, thickness: 2.0 });
            this.materials.stoneO = new THREE.MeshPhysicalMaterial({ color: 0x00ffff, transmission: 0.9, opacity: 1, metalness: 0.1, roughness: 0, ior: 1.5, thickness: 2.0 });
        } else if (styleName === 'cyberpunk') {
            this.materials.stoneX = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff0055, emissiveIntensity: 1, wireframe: true });
            this.materials.stoneO = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00ffaa, emissiveIntensity: 1, wireframe: true });
        } else if (styleName === 'cube') {
            this.materials.stoneX = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4, metalness: 0.6 }); // Gold
            this.materials.stoneO = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.8 }); // Silver
        }
        
        this.rebuildAllStones();
    }
    
    rebuildAllStones() {
        const currentStones = [...this.stones];
        this.clearBoard();
        
        for (const s of currentStones) {
            const player = this.game.board[s.r][s.c];
            if (player) {
                this.addStone(s.r, s.c, player, false);
            }
        }
        
        if (this.lastHoverTurn) {
            this.updateGhostStone(this.lastHoverTurn);
        }
    }
    
    buildBoard() {
        // Main board block
        const boardGeom = new THREE.BoxGeometry(this.boardWidth + 2, this.boardThickness, this.boardWidth + 2);
        this.boardMesh = new THREE.Mesh(boardGeom, this.materials.board);
        this.boardMesh.receiveShadow = true;
        this.boardMesh.castShadow = true;
        this.boardMesh.position.y = -this.boardThickness / 2;
        this.scene.add(this.boardMesh);
        
        // Grid lines
        const lineGroup = new THREE.Group();
        const lineThickness = 0.08;
        const lineLength = this.boardWidth - this.cellSize;
        const startOffset = -lineLength / 2;
        
        // Hoshi points
        const hoshiPoints = new Set(['3,3', '3,11', '7,7', '11,3', '11,11']);
        const hoshiGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16);
        
        for (let i = 0; i < this.boardSize; i++) {
            const pos = startOffset + i * this.cellSize;
            
            // Horizontal line
            const hGeom = new THREE.BoxGeometry(lineLength, lineThickness, lineThickness);
            const hLine = new THREE.Mesh(hGeom, this.materials.boardLines);
            hLine.position.set(0, 0, pos);
            lineGroup.add(hLine);
            
            // Vertical line
            const vGeom = new THREE.BoxGeometry(lineThickness, lineThickness, lineLength);
            const vLine = new THREE.Mesh(vGeom, this.materials.boardLines);
            vLine.position.set(pos, 0, 0);
            lineGroup.add(vLine);
            
            // Star points
            for (let j = 0; j < this.boardSize; j++) {
                if (hoshiPoints.has(`${i},${j}`)) {
                    const hoshiPos = this.coordToPos(i, j);
                    const hoshiMesh = new THREE.Mesh(hoshiGeom, this.materials.boardLines);
                    hoshiMesh.position.set(hoshiPos.x, lineThickness, hoshiPos.z);
                    lineGroup.add(hoshiMesh);
                }
            }
        }
        
        lineGroup.position.y = 0.01; // Slightly above board
        this.scene.add(lineGroup);
        
        // Invisible plane for raycasting
        const planeGeom = new THREE.PlaneGeometry(this.boardWidth, this.boardWidth);
        this.hitPlane = new THREE.Mesh(planeGeom, new THREE.MeshBasicMaterial({ visible: false }));
        this.hitPlane.rotation.x = -Math.PI / 2;
        this.scene.add(this.hitPlane);
    }
    
    createGhostStone() {
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.visible = false;
        
        // We will create the meshes dynamically in updateGhostStone
        this.scene.add(this.ghostGroup);
    }
    
    updateGhostStone(player) {
        // Remove old children
        while(this.ghostGroup.children.length > 0){ 
            this.ghostGroup.remove(this.ghostGroup.children[0]); 
        }
        
        const mesh = this.createPieceMesh(player, this.materials.ghost);
        this.ghostGroup.add(mesh);
        
        if (player === 'X') {
            this.materials.ghost.color.setHex(0xef4444); // Red ghost for X
        } else {
            this.materials.ghost.color.setHex(0x38bdf8); // Blue ghost for O
        }
    }
    
    createPieceMesh(player, material) {
        if (this.pieceStyle === 'classic') {
            const geom = new THREE.SphereGeometry(this.cellSize * 0.45, 32, 16);
            geom.scale(1, 0.4, 1);
            return new THREE.Mesh(geom, material);
        }
        
        else if (this.pieceStyle === 'modern') {
            if (player === 'O') {
                const geom = new THREE.TorusGeometry(this.cellSize * 0.35, this.cellSize * 0.12, 16, 32);
                const mesh = new THREE.Mesh(geom, material);
                mesh.rotation.x = Math.PI / 2;
                return mesh;
            } else {
                const group = new THREE.Group();
                const geom = new THREE.CylinderGeometry(this.cellSize * 0.12, this.cellSize * 0.12, this.cellSize * 0.9, 16);
                
                const part1 = new THREE.Mesh(geom, material);
                part1.rotation.z = Math.PI / 2;
                part1.rotation.y = Math.PI / 4;
                
                const part2 = new THREE.Mesh(geom, material);
                part2.rotation.z = Math.PI / 2;
                part2.rotation.y = -Math.PI / 4;
                
                group.add(part1);
                group.add(part2);
                return group;
            }
        }
        
        else if (this.pieceStyle === 'crystal') {
            const geom = player === 'X' ? new THREE.OctahedronGeometry(this.cellSize * 0.4) : new THREE.IcosahedronGeometry(this.cellSize * 0.4);
            const mesh = new THREE.Mesh(geom, material);
            mesh.position.y = this.cellSize * 0.2;
            return mesh;
        }
        
        else if (this.pieceStyle === 'cyberpunk') {
            if (player === 'X') {
                const geom = new THREE.TorusKnotGeometry(this.cellSize * 0.25, this.cellSize * 0.05, 64, 8);
                const mesh = new THREE.Mesh(geom, material);
                mesh.position.y = this.cellSize * 0.2;
                return mesh;
            } else {
                const geom = new THREE.TorusGeometry(this.cellSize * 0.35, this.cellSize * 0.08, 16, 32);
                const mesh = new THREE.Mesh(geom, material);
                mesh.rotation.x = Math.PI / 2;
                return mesh;
            }
        }
        
        else if (this.pieceStyle === 'cube') {
            const geom = new THREE.BoxGeometry(this.cellSize * 0.6, this.cellSize * 0.6, this.cellSize * 0.6);
            const mesh = new THREE.Mesh(geom, material);
            mesh.position.y = this.cellSize * 0.3;
            if (player === 'X') {
                mesh.rotation.y = Math.PI / 4;
            }
            return mesh;
        }
        
        // Fallback
        return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), material);
    }
    
    coordToPos(r, c) {
        const offset = (this.boardSize - 1) * this.cellSize / 2;
        // c is x, r is z
        return {
            x: c * this.cellSize - offset,
            y: this.cellSize * 0.2, // half stone height
            z: r * this.cellSize - offset
        };
    }
    
    posToCoord(x, z) {
        const offset = (this.boardSize - 1) * this.cellSize / 2;
        const c = Math.round((x + offset) / this.cellSize);
        const r = Math.round((z + offset) / this.cellSize);
        if (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize) {
            return { r, c };
        }
        return null;
    }
    
    addStone(r, c, player, animated = true) {
        if (!this.enabled) return;
        
        const pos = this.coordToPos(r, c);
        const material = player === 'X' ? this.materials.stoneX : this.materials.stoneO;
        
        const stone = this.createPieceMesh(player, material);
        
        // Traverse to enable shadows for all parts
        stone.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        stone.position.set(pos.x, pos.y, pos.z);
        
        // Entrance animation
        if (animated) {
            stone.position.y = pos.y + 10;
            // Simple animation loop for drop
            let velocity = -0.5;
            const dropAnim = () => {
                velocity -= 0.05; // gravity
                stone.position.y += velocity;
                if (stone.position.y <= pos.y) {
                    stone.position.y = pos.y;
                    // Bouncing
                    velocity *= -0.4;
                    if (Math.abs(velocity) < 0.1) {
                        return; // Done
                    }
                }
                requestAnimationFrame(dropAnim);
            };
            dropAnim();
        }
        
        this.scene.add(stone);
        this.stones.push({ r, c, mesh: stone });
        
        // Hide ghost
        this.ghostGroup.visible = false;
    }
    
    removeStone(r, c) {
        const index = this.stones.findIndex(s => s.r === r && s.c === c);
        if (index !== -1) {
            const stone = this.stones[index];
            this.scene.remove(stone.mesh);
            this.stones.splice(index, 1);
        }
    }
    
    clearBoard() {
        for (const stone of this.stones) {
            this.scene.remove(stone.mesh);
        }
        this.stones = [];
    }
    
    highlightWin(winningLine) {
        if (!this.enabled) return;
        
        for (const pos of winningLine) {
            const stone = this.stones.find(s => s.r === pos.r && s.c === pos.c);
            if (stone) {
                // Elevate winning stones
                let up = 0;
                const rise = setInterval(() => {
                    up += 0.05;
                    stone.mesh.position.y += 0.05;
                    if (up >= 1.0) clearInterval(rise);
                }, 30);
                
                // Add glow material
                stone.mesh.traverse((child) => {
                    if (child.isMesh) {
                        child.material = child.material.clone();
                        child.material.emissive.setHex(0xd4af37);
                        child.material.emissiveIntensity = 0.5;
                    }
                });
            }
        }
        
        // Fire confetti
        if (window.confetti) {
            window.confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }
    
    bindEvents() {
        // Mouse move for hover
        this.container.addEventListener('mousemove', (e) => {
            if (!this.enabled || this.game.isGameOver) return;
            
            const rect = this.container.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObject(this.hitPlane);
            
            if (intersects.length > 0) {
                const point = intersects[0].point;
                const coord = this.posToCoord(point.x, point.z);
                
                if (coord && this.game.board[coord.r][coord.c] === null) {
                    if (this.game.gameMode === 'online' && this.game.currentTurn !== this.game.online.myPiece) {
                        this.ghostGroup.visible = false;
                        return;
                    }
                    if (this.game.gameMode === 'ai' && this.game.currentTurn !== 'X') {
                        this.ghostGroup.visible = false;
                        return;
                    }
                    
                    if (this.lastHoverCoord?.r !== coord.r || this.lastHoverCoord?.c !== coord.c || this.lastHoverTurn !== this.game.currentTurn) {
                        this.updateGhostStone(this.game.currentTurn);
                        this.lastHoverTurn = this.game.currentTurn;
                    }
                    
                    const p = this.coordToPos(coord.r, coord.c);
                    this.ghostGroup.position.set(p.x, p.y + 0.2, p.z);
                    this.ghostGroup.visible = true;
                    this.lastHoverCoord = coord;
                    this.container.style.cursor = 'pointer';
                } else {
                    this.ghostGroup.visible = false;
                    this.container.style.cursor = 'default';
                }
            } else {
                this.ghostGroup.visible = false;
                this.container.style.cursor = 'default';
            }
        });
        
        // Click to place
        this.container.addEventListener('click', () => {
            if (!this.enabled) return;
            if (this.ghostGroup.visible && this.lastHoverCoord) {
                // Delegate to game logic
                this.game.handleCellClick(this.lastHoverCoord.r, this.lastHoverCoord.c);
            }
        });
    }
    
    resize() {
        if (!this.container || !this.camera || !this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width === 0 || height === 0) return;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    toggleMode() {
        this.enabled = !this.enabled;
        const wrapper = document.getElementById('board-wrapper');
        const frame = document.getElementById('board-frame');
        
        if (this.enabled) {
            this.board2D.style.display = 'none';
            this.container.style.display = 'block';
            if (wrapper) wrapper.classList.add('is-3d');
            if (frame) frame.classList.add('is-3d');
            this.resize();
            this.syncFromGame();
            document.getElementById('btn-toggle-3d').classList.add('active');
        } else {
            this.container.style.display = 'none';
            this.board2D.style.display = 'grid';
            if (wrapper) wrapper.classList.remove('is-3d');
            if (frame) frame.classList.remove('is-3d');
            document.getElementById('btn-toggle-3d').classList.remove('active');
        }
    }
    
    syncFromGame() {
        this.clearBoard();
        for (let r = 0; r < this.game.boardSize; r++) {
            for (let c = 0; c < this.game.boardSize; c++) {
                const player = this.game.board[r][c];
                if (player) {
                    this.addStone(r, c, player, false);
                }
            }
        }
        this.setTheme(this.game.dom.themeSelect ? this.game.dom.themeSelect.value : 'wood');
    }
    
    animate() {
        if (!this.enabled) return;
        
        if (this.controls) this.controls.update();
        
        // Bobbing ghost stone
        if (this.ghostGroup && this.ghostGroup.visible) {
            this.ghostGroup.position.y = this.cellSize * 0.2 + 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}
