const SFX = {
    /* ===== 1. 音效表 ===== */
    move: 'move.mp3',
    capture: 'capture.mp3',
    check: 'check.mp3',
    win: 'win.mp3',
    chongpao: 'chongpao.mp3',          // 重炮杀
    shuangchecuo: 'shuangchecuo.mp3',  // 双车错杀
    duimianxiao: 'duimianxiao.mp3',    // 禁着提示音（不是绝杀音，不参与 playWin 判定）

    cache: {},
    currentAudio: null,
    unlocked: false,
    debug: false,          // 出问题改 true，控制台会打印判定过程
    moves: [],
    lastWinKind: '',

    /* ===== 2. 初始化：预加载 + 首次交互解锁自动播放 ===== */
    init() {
        Object.keys(this).forEach(k => {
            if (typeof this[k] === 'string' && /\.(mp3|wav|m4a)$/i.test(this[k])) this._get(k);
        });
        const unlock = () => this.unlock();
        ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
            document.addEventListener(ev, unlock, { once: true, passive: true }));
    },

    _get(name) {
        const url = this[name];
        if (!url) return null;
        if (!this.cache[name]) {
            const a = new Audio(url);
            a.preload = 'auto';
            this.cache[name] = a;
        }
        return this.cache[name];
    },

    _hasAudio(name) { return typeof this[name] === 'string' && !!this._get(name); },

    unlock() {
        if (this.unlocked) return;
        this.unlocked = true;
        Object.keys(this.cache).forEach(k => {
            const a = this.cache[k]; if (!a) return;
            a.muted = true;
            const p = a.play();
            if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
                            .catch(() => { a.muted = false; });
            else a.muted = false;
        });
    },

    play(name) {
        const a = this._get(name);
        if (!a) return false;
        if (this.currentAudio && this.currentAudio !== a) {
            try { this.currentAudio.pause(); this.currentAudio.currentTime = 0; } catch (e) {}
        }
        try { a.currentTime = 0; } catch (e) {}
        const p = a.play();
        if (p && p.catch) p.catch(err => {
            if (this.debug) console.warn('[SFX] 播放失败:', name, err && err.name);
        });
        this.currentAudio = a;
        return true;
    },

    /* ===== 3. 走子记录（双车错判定依赖，每步都要喂） ===== */
    onMove(move) {
        if (!move) return;
        this.moves.push(move);
        if (this.moves.length > 240) this.moves.shift();
    },

    resetMoves() { this.moves = []; this.lastWinKind = ''; },

    /* ===== 4. 胜负音效入口 ===== */
    playWin(board, color, lastMove, history) {
        const winner = this._c(color) || 'r';
        const hist = history || this.moves;
        const last = lastMove || hist[hist.length - 1] || null;
        const nb = this._norm(board);
        let kind = 'win';

        if (nb) {
            const kingPos = this._findPos(nb, 'K', winner === 'r' ? 'b' : 'r');

            if (kingPos) {
                const lt = (this._meta(last) || {}).type;
                const list = [
                    { name: 'chongpao',     hint: 'C', test: () => this._chongpao(nb, winner, kingPos) },
                    { name: 'shuangchecuo', hint: 'R', test: () => this._shuangche(nb, winner, kingPos) || this._shuangcheHist(hist, winner) }
                ].filter(d => this._hasAudio(d.name));

                list.sort((a, b) => (b.hint === lt) - (a.hint === lt));
                for (const d of list) {
                    try { if (d.test()) { kind = d.name; break; } }
                    catch (e) { if (this.debug) console.warn('[SFX] 检测器异常:', d.name, e); }
                }
            } else if (last && this._to(last)) {
                kind = this._kingCaptured(nb, winner, this._to(last)) || 'win';
            }
        }

        if (kind !== 'win' && !this._hasAudio(kind)) kind = 'win';
        this.lastWinKind = kind;
        if (this.debug) console.log('[SFX] 绝杀判定 →', kind);
        return this.play(kind);
    },

    /* ===== 5. 禁着校验用（放在走子合法性里，不参与胜负判定） ===== */
    illegalFacing(boardAfterMove) {
        const nb = this._norm(boardAfterMove);
        return nb ? this._facingKings(nb) : false;
    },

    _facingKings(nb) {
        const { g, rows, cols } = nb;
        let kr = null, kb = null;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const p = g[r][c]; if (!p || p.type !== 'K') continue;
            if (p.color === 'r') kr = [r, c];
            if (p.color === 'b') kb = [r, c];
        }
        if (!kr || !kb || kr[1] !== kb[1]) return false;
        const col = kr[1], s = Math.min(kr[0], kb[0]) + 1, e = Math.max(kr[0], kb[0]);
        for (let r = s; r < e; r++) if (g[r][col]) return false;
        return true;
    },

    /* ===== 6. 重炮：将帅同线上最近两颗子都是自己的炮 ===== */
    _chongpao(nb, winner, kingPos) {
        const { g, rows, cols } = nb, [kr, kc] = kingPos;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            let r = kr + dr, c = kc + dc, found = [];
            while (r >= 0 && r < rows && c >= 0 && c < cols && found.length < 2) {
                const p = g[r][c];
                if (p && p.type) found.push(p);
                r += dr; c += dc;
            }
            if (found.length === 2 &&
                found[0].type === 'C' && found[0].color === winner &&
                found[1].type === 'C' && found[1].color === winner) return true;
        }
        return false;
    },

    /* ===== 7. 双车错 ===== */
    _shuangche(nb, winner, kingPos) {
        const { g, rows, cols } = nb, [kr, kc] = kingPos;
        const rooks = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const p = g[r][c];
            if (p && p.type === 'R' && p.color === winner) rooks.push([r, c]);
        }
        if (rooks.length < 2) return false;
        for (const [r1, c1] of rooks) {
            if (!this._open(g, rows, cols, r1, c1, kr, kc)) continue;
            for (const [r2, c2] of rooks) {
                if (r1 === r2 && c1 === c2) continue;
                if ((r2 === kr || c2 === kc) && this._open(g, rows, cols, r2, c2, kr, kc)) return true;
            }
        }
        return false;
    },

    _shuangcheHist(hist, winner) {
        const wm = [];
        for (const m of hist) { const t = this._meta(m); if (t && t.color === winner) wm.push({ m, t }); }
        if (wm.length < 2) return false;
        const a = wm[wm.length - 1], b = wm[wm.length - 2];
        if (a.t.type !== 'R' || b.t.type !== 'R') return false;
        const ca = this._coords(a.m), cb = this._coords(b.m);
        if (!ca || !cb || !ca.from || !cb.from) return false;
        return ca.from[0] !== cb.from[0] || ca.from[1] !== cb.from[1];
    },

    /* ===== 8. 吃王即胜的引擎 ===== */
    _kingCaptured(nb, winner, to) {
        const { g, rows, cols } = nb, [kr, kc] = to;
        const p = g[kr] ? g[kr][kc] : null;
        if (!p || p.color !== winner) return null;

        if (p.type === 'C') {
            for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                let r = kr + dr, c = kc + dc;
                while (r >= 0 && r < rows && c >= 0 && c < cols) {
                    const q = g[r][c];
                    if (q && q.type) {
                        if (q.type === 'C' && q.color === winner) return 'chongpao';
                        break;
                    }
                    r += dr; c += dc;
                }
            }
        }
        if (p.type === 'R') {
            let other = 0, sameLine = false;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const q = g[r][c];
                if (!q || q.type !== 'R' || q.color !== winner) continue;
                if (r === kr && c === kc) continue;
                other++; if (r === kr || c === kc) sameLine = true;
            }
            if (other >= 1 && sameLine) return 'shuangchecuo';
        }
        return null;
    },

    /* ===== 9. 基础工具 ===== */
    _findPos(nb, type, color) {
        const { g, rows, cols } = nb;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const p = g[r][c];
            if (p && p.type === type && p.color === color) return [r, c];
        }
        return null;
    },

    _open(g, rows, cols, r1, c1, r2, c2) {
        if (r1 !== r2 && c1 !== c2) return false;
        if (r1 === r2) {
            const s = Math.min(c1, c2) + 1, e = Math.max(c1, c2);
            for (let c = s; c < e; c++) if (g[r1][c]) return false;
        } else {
            const s = Math.min(r1, r2) + 1, e = Math.max(r1, r2);
            for (let r = s; r < e; r++) if (g[r][c1]) return false;
        }
        return true;
    },

    _norm(src) {
        let b = src;
        if (b && !Array.isArray(b)) b = b.board || b.grid || b.data || b.pieces || b.chessboard || null;
        if (!b || !Array.isArray(b)) return null;

        if (b.length && Array.isArray(b[0])) {
            const rows = b.length, cols = b[0].length, g = [];
            for (let r = 0; r < rows; r++) { g[r] = []; for (let c = 0; c < cols; c++) g[r][c] = this._p(b[r][c]); }
            return { g, rows, cols };
        }

        let mr = -1, mc = -1;
        const items = [];
        for (const it of b) {
            if (!it) continue;
            let r, c, p;
            if (Array.isArray(it)) {
                if (it.length < 2) continue;
                if (typeof it[0] === 'number') { r = it[0]; c = it[1]; p = this._p(it[2]); }
                else { p = this._p(it[0]); r = it[1]; c = it[2]; }
            } else {
                r = it.r !== undefined ? it.r : (it.row !== undefined ? it.row : it.y);
                c = it.c !== undefined ? it.c : (it.col !== undefined ? it.col : it.x);
                p = this._p(it);
            }
            if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
            if (r > mr) mr = r;
            if (c > mc) mc = c;
            items.push([r, c, p]);
        }
        if (mr < 0 || mc < 0) return null;

        const rows = mr + 1, cols = mc + 1, g = [];
        for (let r = 0; r < rows; r++) g[r] = new Array(cols).fill(null);
        for (const [r, c, p] of items) if (p) g[r][c] = p;
        return { g, rows, cols };
    },

    _p(v) {
        if (!v) return null;
        if (typeof v === 'string') {
            if (v.length === 2) { const c = this._c(v[0]), t = this._t(v[1]); if (t) return { type: t, color: c }; }
            const t = this._t(v);
            return t ? { type: t, color: null } : null;
        }
        const t = this._t(v.type || v.name || v.text || v.kind || v.code || '');
        const c = this._c(v.color || v.side || v.owner || v.c || '');
        return t ? { type: t, color: c } : null;
    },

    _t(v) {
        const s = String(v).toUpperCase();
        const map = {
            K: 'K', KING: 'K', 帅: 'K', 帥: 'K', 将: 'K', 將: 'K',
            A: 'A', ADVISOR: 'A', 仕: 'A', 士: 'A',
            B: 'B', BISHOP: 'B', ELEPHANT: 'B', 相: 'B', 象: 'B',
            N: 'N', KNIGHT: 'N', 傌: 'N', 馬: 'N', 马: 'N',
            R: 'R', ROOK: 'R', CHARIOT: 'R', 俥: 'R', 車: 'R', 车: 'R',
            C: 'C', CANNON: 'C', 炮: 'C', 砲: 'C',
            P: 'P', PAWN: 'P', 兵: 'P', 卒: 'P'
        };
        return map[s] || null;
    },

    _c(v) {
        const s = String(v).toLowerCase();
        if (s === 'r' || s === 'red' || s === '红' || s === '红方') return 'r';
        if (s === 'b' || s === 'black' || s === '黑' || s === '黑方') return 'b';
        return null;
    },

    _meta(m) {
        if (!m) return null;
        const p = m.piece || m.moved || m.p || m;
        const t = this._t(p.type || p.name || m.type || '');
        const c = this._c(p.color || m.color || '');
        return t ? { type: t, color: c } : null;
    },

    _coords(m) {
        if (!m) return null;
        const f = m.from || m.start, t = m.to || m.end;
        if (!f || !t) return null;
        const fr = f[0] !== undefined ? f[0] : (f.r !== undefined ? f.r : f.row);
        const fc = f[1] !== undefined ? f[1] : (f.c !== undefined ? f.c : f.col);
        const tr = t[0] !== undefined ? t[0] : (t.r !== undefined ? t.r : t.row);
        const tc = t[1] !== undefined ? t[1] : (t.c !== undefined ? t.c : t.col);
        if (!Number.isFinite(fr) || !Number.isFinite(tr)) return null;
        return { from: [fr, fc], to: [tr, tc] };
    },

    _to(m) { const cd = this._coords(m); return cd ? cd.to : null; }
};

SFX.init();