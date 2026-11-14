// sfx.js - 纯净最终版（彻底删除双车错等特殊判定）
const SFX = {
    move: 'move.mp3',
    capture: 'capture.mp3',
    check: 'check.mp3',
    win: 'win.mp3',

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
        
        // 确保同一时间只有一个声音在播放
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

    // 兼容接口：无论哪个网页调用了 playWin，统统只会播放普通绝杀！
    playWin: function(board, color) {
        this.play('win');
    }
};