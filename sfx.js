// sfx.js - 统一音效管理与战术检测中心
const SFX = {
    // 声音库
    move: 'move.mp3',
    capture: 'capture.mp3',
    check: 'check.mp3',
    win: 'win.mp3',
    shuangchecuo: 'shuangchecuo.mp3', // 双车错
    chongpao: 'chongpao.mp3',         // 重炮

    audioCache: {},
    currentAudio: null,

    // 核心播放函数
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

    // 🚀 战术检测并播放（自带优先级）
    playCheck: function(board, movingColor, enemyColor) {
        let enemyKingPos = null;
        // 找老将
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p && p.type === 'K' && p.color === enemyColor) {
                    enemyKingPos = [r, c];
                }
            }
        }
        if (!enemyKingPos) return;

        const [kr, kc] = enemyKingPos;
        let checkingCars = 0;    // 攻击老将的车数量
        let checkingCannons = 0; // 攻击老将的炮数量

        // 从老将出发，往上下左右四个方向扫描
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

        for (const [dr, dc] of dirs) {
            let nr = kr + dr;
            let nc = kc + dc;
            let obstacles = 0; // 中间阻挡物的数量

            while (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                const p = board[nr][nc];
                
                if (p) {
                    if (p.color === movingColor) {
                        // 如果是车，且中间没有阻挡，说明车在将军
                        if (p.type === 'R' && obstacles === 0) {
                            checkingCars++;
                        }
                        // 如果是炮，且中间刚好隔了1个棋子，说明炮在将军
                        if (p.type === 'C' && obstacles === 1) {
                            checkingCannons++;
                        }
                    }
                    obstacles++;
                }
                nr += dr;
                nc += dc;
            }
        }

        // 🌟 优先级判断：双车错最高！
        if (checkingCars >= 2) {
            this.play('shuangchecuo');
        } else if (checkingCannons >= 2) {
            this.play('chongpao');
        } else {
            this.play('check'); // 普通将军
        }
    }
};