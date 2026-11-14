// sfx.js - 统一音效管理与战术检测中心
const SFX = {
    move: 'move.mp3',
    capture: 'capture.mp3',
    check: 'check.mp3',
    win: 'win.mp3',
    shuangchecuo: 'shuangchecuo.mp3', // 双车错
    chongpao: 'chongpao.mp3',         // 重炮

    audioCache: {},
    currentAudio: null,

    play: function(name) {
        const url = this[name];
        if (!url) return;
        
        if (!this.audioCache[name]) {
            this.audioCache[name] = new Audio(url);
            this.audioCache[name].preload = 'auto';
        }
        const audio = this.audioCache[name];
        
        if (this.currentAudio && this.currentAudio !== audio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        
        try {
            audio.currentTime = 0;
            audio.play().catch(() => {});
            this.currentAudio = audio;
        } catch (e) {}
    },

    playCheck: function(board, movingColor, enemyColor) {
        let enemyKingPos = null;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p && p.type === 'K' && p.color === enemyColor) {
                    enemyKingPos = [r, c];
                }
            }
        }
        if (!enemyKingPos) return false;

        const [kr, kc] = enemyKingPos;
        let checkingCars = 0;
        let checkingCannons = 0;
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

        for (const [dr, dc] of dirs) {
            let nr = kr + dr;
            let nc = kc + dc;
            let obstacles = 0;

            while (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                const p = board[nr][nc];
                if (p) {
                    if (p.color === movingColor) {
                        if (p.type === 'R' && obstacles === 0) checkingCars++;
                        if (p.type === 'C' && obstacles === 1) checkingCannons++;
                    }
                    obstacles++;
                }
                nr += dr;
                nc += dc;
            }
        }

        if (checkingCars >= 2) {
            this.play('shuangchecuo');
            return true; // 告诉系统：我播了双车错！
        } else if (checkingCannons >= 2) {
            this.play('chongpao');
            return true; // 告诉系统：我播了重炮！
        } else {
            this.play('check');
            return false; // 普通将军
        }
    }
};