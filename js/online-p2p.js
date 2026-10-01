/**
 * Caro P2P Online Multiplayer Manager
 * Powered by WebRTC (PeerJS) with BroadcastChannel local fallback for dual-tab testing.
 * Supports Spectator Mode & Avatar Sync.
 */
class OnlineManager {
    constructor(gameController) {
        this.game = gameController;
        this.peer = null;
        this.guestConn = null;
        this.spectatorConns = [];
        this.broadcastChannel = null;
        this.isHost = false;
        this.myPiece = 'spectator';
        this.seats = { X: null, O: null }; // Host is X, Guest is O, Spectator is 'spectator'
        this.myAvatar = '🦊'; // Default avatar
        this.guestAvatar = '🐯'; // Tracked by host
        this.roomCode = null;
        this.isConnected = false;
        this.pingInterval = null;
        this.lastPingTime = 0;
        this.pingMs = 0;

        this.initBroadcastFallback();
    }

    setAvatar(emoji) {
        this.myAvatar = emoji;
        if (this.isConnected && !this.isHost && this.myPiece !== 'spectator') {
            this.sendData({ type: 'SET_AVATAR', piece: this.myPiece, avatar: this.myAvatar });
        }
    }

    initBroadcastFallback() {
        if ('BroadcastChannel' in window) {
            try {
                this.broadcastChannel = new BroadcastChannel('caro_local_p2p_channel');
                this.broadcastChannel.onmessage = (event) => {
                    if (event.data && event.data.roomCode === this.roomCode) {
                        this.handleIncomingData(event.data, null);
                    }
                };
            } catch (e) {
                console.warn('BroadcastChannel not supported or restricted', e);
            }
        }
    }

    generateRoomCode() {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        return `CARO-${randNum}`;
    }

    createRoom(timeLimit = 30, callback) {
        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        this.myPiece = 'spectator';
        this.seats = { X: null, O: null };
        this.roomTimeLimit = timeLimit;
        this.guestConn = null;
        this.spectatorConns = [];

        const peerId = `caro-v1-${this.roomCode.toLowerCase()}`;
        this.initPeer(peerId, () => {
            this.peer.on('connection', (connection) => {
                if (!this.guestConn) {
                    this.guestConn = connection;
                    this.setupConnection(connection, 'O');
                    const sendInit = () => {
                        connection.send({
                            type: 'INIT_GAME',
                            roomCode: this.roomCode,
                            hostPiece: 'spectator',
                            guestPiece: 'spectator',
                            seats: this.seats,
                            hostAvatar: this.myAvatar,
                            timeLimit: this.roomTimeLimit,
                            board: this.game.board,
                            currentTurn: this.game.currentTurn,
                            score: this.game.score,
                            usedSwapCard: this.game.usedSwapCard,
                            moveHistory: this.game.moveHistory
                        });
                    };
                    if (connection.open) sendInit();
                    else connection.on('open', sendInit);
                } else {
                    this.spectatorConns.push(connection);
                    this.setupConnection(connection, 'spectator');
                    const sendInitSpec = () => {
                        connection.send({
                            type: 'INIT_GAME',
                            roomCode: this.roomCode,
                            hostPiece: 'spectator',
                            guestPiece: 'spectator',
                            seats: this.seats,
                            hostAvatar: this.myAvatar,
                            guestAvatar: this.guestAvatar,
                            timeLimit: this.roomTimeLimit,
                            board: this.game.board,
                            currentTurn: this.game.currentTurn,
                            score: this.game.score,
                            usedSwapCard: this.game.usedSwapCard,
                            moveHistory: this.game.moveHistory
                        });
                    };
                    if (connection.open) sendInitSpec();
                    else connection.on('open', sendInitSpec);
                }
            });
            if (callback) callback(this.roomCode);
        });
    }

    joinRoom(roomCode, callback, onError) {
        this.roomCode = roomCode.toUpperCase().trim();
        this.isHost = false;
        this.myPiece = 'O';
        this.guestConn = null;
        this.spectatorConns = [];

        const targetPeerId = `caro-v1-${this.roomCode.toLowerCase()}`;
        const myGuestId = `caro-guest-${Math.random().toString(36).substring(2, 9)}`;

        this.initPeer(myGuestId, () => {
            const connection = this.peer.connect(targetPeerId, {
                reliable: true
            });
            this.guestConn = connection;
            this.setupConnection(connection, 'host');
            
            let isConnOpen = false;
            connection.on('open', () => {
                isConnOpen = true;
                if (callback) callback();
            });

            const connTimeout = setTimeout(() => {
                if (!isConnOpen) {
                    if (onError) onError();
                }
            }, 5000);

            this.peer.on('error', (err) => {
                if (err.type === 'peer-unavailable') {
                    clearTimeout(connTimeout);
                    if (onError) onError();
                }
            });
        });

        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({
                type: 'LOCAL_HANDSHAKE_REQUEST',
                roomCode: this.roomCode
            });
        }
    }

    initPeer(peerId, onOpen) {
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
        }
        if (typeof Peer === 'undefined') {
            console.warn('PeerJS library not loaded, using local simulation mode');
            if (onOpen) onOpen();
            return;
        }
        try {
            this.peer = new Peer(peerId, {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                },
                debug: 1
            });
            this.peer.on('open', (id) => {
                console.log('Peer connected with ID:', id);
                if (onOpen) onOpen(id);
            });
            this.peer.on('error', (err) => {
                console.warn('PeerJS connection error:', err);
                if (err.type === 'unavailable-id' && this.isHost) {
                    this.roomCode = this.generateRoomCode();
                    this.initPeer(`caro-v1-${this.roomCode.toLowerCase()}`, onOpen);
                }
            });
        } catch (err) {
            console.error('Failed to initialize PeerJS:', err);
            if (onOpen) onOpen();
        }
    }

    setupConnection(conn, role) {
        conn.on('open', () => {
            if (!this.isHost) {
                // Not host: we just connected to the host. Wait for INIT_GAME before firing onConnected.
                // But in broadcast fallback, we might not get open event cleanly.
            } else {
                if (role === 'O') {
                    this.onConnected(); // Host considers connected when first guest joins
                }
            }
        });

        conn.on('data', (data) => {
            this.handleIncomingData(data, conn);
        });

        conn.on('close', () => {
            this.handleDisconnect(conn);
        });

        conn.on('error', (err) => {
            console.error('Data connection error:', err);
            this.handleDisconnect(conn);
        });
    }

    handleDisconnect(conn) {
        if (this.isHost) {
            if (conn === this.guestConn) {
                this.guestConn = null;
                this.onDisconnected();
            } else {
                this.spectatorConns = this.spectatorConns.filter(c => c !== conn);
            }
        } else {
            this.onDisconnected();
        }
    }

    onConnected() {
        this.isConnected = true;
        this.startPing();
        this.game.onOnlineConnected({
            isHost: this.isHost,
            myPiece: this.myPiece,
            roomCode: this.roomCode
        });
    }

    onDisconnected() {
        this.isConnected = false;
        this.stopPing();
        this.game.onOnlineDisconnected();
    }


    requestSeat(color) {
        if (this.isHost) {
            this.processSeatRequest('host', color);
        } else {
            // Local broadcast fallback (when offline)
            if (this.broadcastChannel && !this.guestConn) {
                this.sendData({ type: 'SIT_REQUEST', color: color, peerId: this.peer ? this.peer.id : 'local-guest' });
            }
            if (this.guestConn) {
                this.guestConn.send({ type: 'SIT_REQUEST', color: color, peerId: this.peer.id });
            }
        }
    }

    processSeatRequest(peerId, color) {
        if (!this.isHost) return;
        if (!this.seats[color]) {
            if (this.seats['X'] === peerId) this.seats['X'] = null;
            if (this.seats['O'] === peerId) this.seats['O'] = null;
            
            this.seats[color] = peerId;
            
            const state = { type: 'SEAT_UPDATE', seats: this.seats };
            this.handleIncomingData(state, null);
            this.sendData(state);
        }
    }

    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.myPiece !== 'spectator') {
                this.lastPingTime = performance.now();
                this.sendData({ type: 'PING', time: this.lastPingTime });
            }
        }, 4000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    sendData(data) {
        data.roomCode = this.roomCode;
        if (this.isHost) {
            if (this.guestConn && this.guestConn.open) {
                try { this.guestConn.send(data); } catch(e) {}
            }
            this.spectatorConns.forEach(c => {
                if (c.open) {
                    try { c.send(data); } catch(e) {}
                }
            });
        } else {
            if (this.guestConn && this.guestConn.open) {
                try { this.guestConn.send(data); } catch(e) {}
            }
        }

        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(data);
        }
    }

    handleIncomingData(data, sourceConn) {
        if (!data || !data.type) return;
        if (data.roomCode && data.roomCode !== this.roomCode) return;

        // Host forwards messages from guest/spectators to everyone else
        if (this.isHost && sourceConn) {
            if (this.guestConn && this.guestConn !== sourceConn && this.guestConn.open) {
                this.guestConn.send(data);
            }
            this.spectatorConns.forEach(c => {
                if (c !== sourceConn && c.open) {
                    c.send(data);
                }
            });
        }
        
        // Host forwards local broadcast similarly
        if (this.isHost && !sourceConn && data.type !== 'LOCAL_HANDSHAKE_REQUEST' && data.type !== 'INIT_GAME') {
            this.sendData(data); // this will broadcast to WebRTC conns
        }

        switch (data.type) {
            case 'LOCAL_HANDSHAKE_REQUEST':
                if (this.isHost) {
                    if (!this.isConnected) {
                        this.onConnected();
                        this.sendData({
                            type: 'INIT_GAME',
                            roomCode: this.roomCode,
                            hostPiece: 'spectator',
                            guestPiece: 'spectator',
                            seats: this.seats,
                            hostAvatar: this.myAvatar,
                            timeLimit: this.roomTimeLimit
                        });
                    } else {
                        // Accept as spectator for local fallback
                        this.sendData({
                            type: 'INIT_GAME',
                            roomCode: this.roomCode,
                            hostPiece: 'spectator',
                            guestPiece: 'spectator',
                            seats: this.seats,
                            hostAvatar: this.myAvatar,
                            guestAvatar: this.guestAvatar,
                            timeLimit: this.roomTimeLimit,
                            board: this.game.board,
                            currentTurn: this.game.currentTurn,
                            score: this.game.score,
                            usedSwapCard: this.game.usedSwapCard,
                            moveHistory: this.game.moveHistory
                        });
                    }
                }
                break;


            case 'SIT_REQUEST':
                if (this.isHost) {
                    const requesterId = sourceConn ? sourceConn.peer : data.peerId;
                    this.processSeatRequest(requesterId, data.color);
                }
                break;
                
            case 'SEAT_UPDATE':
                this.seats = data.seats;
                if (data.usedSwapCard) {
                    // clone it to avoid reference issues
                    this.game.usedSwapCard = JSON.parse(JSON.stringify(data.usedSwapCard));
                }
                if (data.swapInitiator) {
                    this.game.playSwapAnimation(data.swapInitiator);
                }
                const myId = this.isHost ? 'host' : (this.peer ? this.peer.id : 'local-guest');
                if (this.seats['X'] === myId) this.myPiece = 'X';
                else if (this.seats['O'] === myId) this.myPiece = 'O';
                else this.myPiece = 'spectator';
                this.game.updateUI();
                break;

            case 'INIT_GAME':
                if (!this.isHost && !this.isConnected) {
                    this.seats = data.seats || { X: null, O: null };
                    const myId = this.peer ? this.peer.id : 'local-guest';
                    if (this.seats['X'] === myId) this.myPiece = 'X';
                    else if (this.seats['O'] === myId) this.myPiece = 'O';
                    else this.myPiece = 'spectator';
                    
                    this.game.onOnlineConnected({
                        isHost: false,
                        myPiece: this.myPiece,
                        roomCode: this.roomCode,
                        timeLimit: typeof data.timeLimit !== 'undefined' ? data.timeLimit : 30,
                        hostAvatar: data.hostAvatar,
                        guestAvatar: data.guestAvatar,
                        board: data.board,
                        currentTurn: data.currentTurn,
                        score: data.score,
                        usedSwapCard: data.usedSwapCard,
                        moveHistory: data.moveHistory
                    });
                    this.isConnected = true;
                    this.startPing();
                    
                    if (this.myPiece === 'O') {
                        this.sendData({ type: 'SET_AVATAR', piece: 'O', avatar: this.myAvatar });
                    }
                }
                break;

            case 'SET_AVATAR':
                if (this.isHost && data.piece === 'O') {
                    this.guestAvatar = data.avatar;
                }
                this.game.receiveOnlineAvatar(data.piece, data.avatar);
                break;

            case 'MOVE':
                this.game.receiveOnlineMove(data.r, data.c, data.player);
                break;

            case 'NEW_GAME':
                this.game.receiveOnlineNewGame();
                break;

            case 'UNDO_REQUEST':
                this.game.receiveOnlineUndoRequest();
                break;

            case 'UNDO_RESPONSE':
                this.game.receiveOnlineUndoResponse(data.accepted);
                break;

            case 'RESIGN':
                this.game.receiveOnlineResign();
                break;

            case 'DRAW_REQUEST':
                this.game.receiveOnlineDrawRequest();
                break;

            case 'DRAW_RESPONSE':
                this.game.receiveOnlineDrawResponse(data.accepted);
                break;

            case 'SWAP_CARD':
                if (this.isHost) {
                    const requesterId = sourceConn ? sourceConn.peer : 'host';
                    let requesterColor = null;
                    if (this.seats['X'] === requesterId) requesterColor = 'X';
                    else if (this.seats['O'] === requesterId) requesterColor = 'O';

                    if (requesterColor && this.game.currentTurn === requesterColor && !this.game.usedSwapCard[requesterColor]) {
                        // Mark used based on current color BEFORE swap
                        this.game.usedSwapCard[requesterColor] = true;
                        
                        // Swap seats
                        const tempSeat = this.seats['X'];
                        this.seats['X'] = this.seats['O'];
                        this.seats['O'] = tempSeat;
                        
                        // Swap card usage states so the "used" status follows the player!
                        const tempUsed = this.game.usedSwapCard['X'];
                        this.game.usedSwapCard['X'] = this.game.usedSwapCard['O'];
                        this.game.usedSwapCard['O'] = tempUsed;
                        
                        // Broadcast both the card usage and seat update
                        const state = { type: 'SEAT_UPDATE', seats: this.seats, usedSwapCard: this.game.usedSwapCard, swapInitiator: requesterColor };
                        this.handleIncomingData(state, null);
                        this.sendData(state);
                    }
                }
                break;

            case 'EMOTE':
                this.game.receiveOnlineEmote(data.emoji, data.sender);
                break;

            case 'CHAT':
                this.game.receiveOnlineChat(data.text, data.sender);
                break;

            case 'PING':
                if (this.isHost) {
                    if (sourceConn && sourceConn === this.guestConn) {
                        try { sourceConn.send({ type: 'PONG', time: data.time }); } catch(e){}
                    }
                } else if (this.guestConn && this.guestConn.open) {
                    try { this.guestConn.send({ type: 'PONG', time: data.time }); } catch(e){}
                }
                break;

            case 'PONG':
                if (data.time && !this.isHost && this.myPiece !== 'spectator') {
                    this.pingMs = Math.round(performance.now() - data.time);
                    this.game.updatePingDisplay(this.pingMs);
                }
                break;
        }
    }

    sendMove(r, c, player) {
        if (this.myPiece === 'spectator') return;
        this.sendData({
            type: 'MOVE',
            r,
            c,
            player
        });
    }

    sendNewGame() {
        if (this.myPiece === 'spectator') return;
        this.sendData({ type: 'NEW_GAME' });
    }

    sendUndoRequest() {
        if (this.myPiece === 'spectator') return;
        this.sendData({ type: 'UNDO_REQUEST' });
    }

    sendUndoResponse(accepted) {
        if (this.myPiece === 'spectator') return;
        this.sendData({ type: 'UNDO_RESPONSE', accepted });
    }

    sendResign() {
        if (this.myPiece === 'spectator') return;
        this.sendData({ type: 'RESIGN' });
    }

    sendDrawRequest() {
        if (this.myPiece === 'spectator') return;
        this.sendData({ type: 'DRAW_REQUEST' });
    }

    sendDrawResponse(accepted) {
        if (this.myPiece === 'spectator') return;
        this.sendData({ type: 'DRAW_RESPONSE', accepted });
    }

    sendSwapCard() {
        if (this.myPiece === 'spectator') return;
        if (this.isHost) {
            this.handleIncomingData({ type: 'SWAP_CARD' }, null);
        } else {
            this.sendData({ type: 'SWAP_CARD' });
        }
    }

    sendEmote(emoji) {
        this.sendData({
            type: 'EMOTE',
            emoji,
            sender: this.myPiece
        });
    }

    sendChat(text) {
        this.sendData({
            type: 'CHAT',
            text,
            sender: this.myPiece
        });
    }

    disconnect() {
        this.stopPing();
        if (this.guestConn) {
            try { this.guestConn.close(); } catch (e) {}
            this.guestConn = null;
        }
        this.spectatorConns.forEach(c => {
            try { c.close(); } catch (e) {}
        });
        this.spectatorConns = [];
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }
        this.isConnected = false;
    }
}

window.OnlineManager = OnlineManager;
