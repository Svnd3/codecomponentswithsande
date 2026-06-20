/**
 * ─────────────────────────────────────────────────────────────
 *  Underwater Water Ripple — Custom WebGL Wave Engine
 *  Part of codecomponentswithsande by Hezron Sandé
 * ─────────────────────────────────────────────────────────────
 *  github.com/Svnd3/codecomponentswithsande
 *  instagram: @_svnd3
 *
 *  Free to use in personal and commercial projects.
 *  If you copy or build on this, please keep this comment block
 *  and give credit where it's due:
 *
 *    ★  Star the repo  →  github.com/Svnd3/codecomponentswithsande
 *    @  Mention @Svnd3 on GitHub  |  @_svnd3 on Instagram
 *
 *  No frameworks. No libraries. Pure WebGL written from scratch.
 * ─────────────────────────────────────────────────────────────
 */

const VERT = `
attribute vec2 pos;
varying vec2 uv;
void main() {
    uv = pos * 0.5 + 0.5;
    gl_Position = vec4(pos, 0.0, 1.0);
}`;

const SIM_FRAG = `
precision highp float;
uniform sampler2D tWave;
uniform vec2 delta;
varying vec2 uv;
void main() {
    vec4 s = texture2D(tWave, uv);
    float avg = (
        texture2D(tWave, uv - vec2(delta.x, 0.0)).r +
        texture2D(tWave, uv + vec2(delta.x, 0.0)).r +
        texture2D(tWave, uv - vec2(0.0, delta.y)).r +
        texture2D(tWave, uv + vec2(0.0, delta.y)).r
    ) * 0.25;
    s.g += (avg - s.r) * 2.0;
    s.g *= 0.99;
    s.r += s.g;
    gl_FragColor = s;
}`;

const DROP_FRAG = `
precision highp float;
const float PI = 3.14159265;
uniform sampler2D tWave;
uniform vec2 center;
uniform float radius;
uniform float strength;
varying vec2 uv;
void main() {
    vec4 s = texture2D(tWave, uv);
    float dist = distance(uv, center);
    float drop = max(0.0, 1.0 - dist / radius);
    drop = 0.5 - cos(drop * PI) * 0.5;
    s.r += drop * strength;
    gl_FragColor = s;
}`;

const RENDER_FRAG = `
precision highp float;
uniform sampler2D tWave;
uniform sampler2D tBg;
uniform vec2 delta;
uniform float perturbance;
varying vec2 uv;
void main() {
    float h  = texture2D(tWave, uv).r;
    float hR = texture2D(tWave, vec2(uv.x + delta.x, uv.y)).r;
    float hD = texture2D(tWave, vec2(uv.x, uv.y + delta.y)).r;
    vec2 offset = vec2(hR - h, hD - h) * (perturbance / delta.x);
    vec4 color = texture2D(tBg, clamp(uv + offset, 0.0, 1.0));
    float spec = pow(max(0.0, length(offset) * 8.0), 2.0);
    color.rgb += spec * vec3(0.7, 0.85, 1.0);
    gl_FragColor = color;
}`;

class WaterRipple {
    constructor(el, src) {
        this.el = el;
        this.perturbance = 0.04;
        this.simRes = 256;
        this._src = src;
        this._cur = 0;

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;';
        el.style.backgroundImage = 'none';
        el.appendChild(this.canvas);

        const gl = this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!gl) { console.error('WebGL not supported'); return; }

        this._texType = this._detectFloatType();
        if (!this._texType) { console.error('Float render targets not supported'); return; }

        this._resize();
        window.addEventListener('resize', () => this._resize(true));

        this._prog = {
            sim:    this._compile(VERT, SIM_FRAG),
            drop:   this._compile(VERT, DROP_FRAG),
            render: this._compile(VERT, RENDER_FRAG),
        };

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
        this._quadBuf = buf;

        this._wt  = [this._simTex(), this._simTex()];
        this._wfb = [this._makeFB(this._wt[0]), this._makeFB(this._wt[1])];

        this._bgTex = this._blankTex();
        this._loadBg(src);

        el.addEventListener('mousemove', e => {
            const b = el.getBoundingClientRect();
            this.drop(e.clientX - b.left, e.clientY - b.top, 25, 0.04);
        });
        el.addEventListener('mousedown', e => {
            const b = el.getBoundingClientRect();
            this.drop(e.clientX - b.left, e.clientY - b.top, 55, 0.14);
        });

        this._loop();
    }

    _detectFloatType() {
        const gl = this.gl;
        if (gl.getExtension('OES_texture_float')) {
            this._linearOk = !!gl.getExtension('OES_texture_float_linear');
            const t = gl.createTexture(), fb = gl.createFramebuffer();
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, gl.FLOAT, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
            const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
            gl.deleteTexture(t); gl.deleteFramebuffer(fb);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            if (ok) return gl.FLOAT;
        }
        const hf = gl.getExtension('OES_texture_half_float');
        if (hf) {
            this._linearOk = !!gl.getExtension('OES_texture_half_float_linear');
            const t = gl.createTexture(), fb = gl.createFramebuffer();
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, hf.HALF_FLOAT_OES, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
            const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
            gl.deleteTexture(t); gl.deleteFramebuffer(fb);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            if (ok) return hf.HALF_FLOAT_OES;
        }
        return null;
    }

    _resize(reload) {
        this.w = this.el.offsetWidth;
        this.h = this.el.offsetHeight;
        this.canvas.width  = this.w;
        this.canvas.height = this.h;
        if (reload) this._loadBg(this._src);
    }

    _simTex() {
        const gl = this.gl, N = this.simRes;
        const filter = this._linearOk ? gl.LINEAR : gl.NEAREST;
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, this._texType, null);
        return t;
    }

    _blankTex() {
        const gl = this.gl;
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
        return t;
    }

    _makeFB(tex) {
        const gl = this.gl;
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return fb;
    }

    _loadBg(src) {
        const img = new Image();
        img.onload = () => {
            const oc = document.createElement('canvas');
            oc.width = this.w; oc.height = this.h;
            const c = oc.getContext('2d');
            const s = Math.max(this.w / img.width, this.h / img.height);
            c.drawImage(img, (this.w - img.width * s) / 2, (this.h - img.height * s) / 2, img.width * s, img.height * s);
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, this._bgTex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, oc);
        };
        img.src = src;
    }

    drop(x, y, radius, strength) {
        const gl = this.gl, N = this.simRes, next = 1 - this._cur;
        gl.viewport(0, 0, N, N);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._wfb[next]);
        const p = this._prog.drop;
        gl.useProgram(p);
        this._quad(p);
        this._tex(p, 'tWave', this._wt[this._cur], 0);
        gl.uniform2f(this._ul(p, 'center'), x / this.w, 1.0 - y / this.h);
        gl.uniform1f(this._ul(p, 'radius'), radius / Math.max(this.w, this.h));
        gl.uniform1f(this._ul(p, 'strength'), strength);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        this._cur = next;
    }

    _step() {
        const gl = this.gl, N = this.simRes, next = 1 - this._cur;
        gl.viewport(0, 0, N, N);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._wfb[next]);
        const p = this._prog.sim;
        gl.useProgram(p);
        this._quad(p);
        this._tex(p, 'tWave', this._wt[this._cur], 0);
        gl.uniform2f(this._ul(p, 'delta'), 1 / N, 1 / N);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        this._cur = next;
    }

    _render() {
        const gl = this.gl, N = this.simRes;
        gl.viewport(0, 0, this.w, this.h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const p = this._prog.render;
        gl.useProgram(p);
        this._quad(p);
        this._tex(p, 'tWave', this._wt[this._cur], 0);
        this._tex(p, 'tBg',   this._bgTex,         1);
        gl.uniform2f(this._ul(p, 'delta'), 1 / N, 1 / N);
        gl.uniform1f(this._ul(p, 'perturbance'), this.perturbance);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    _tex(prog, name, tex, unit) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(this._ul(prog, name), unit);
    }

    _ul(prog, name) { return this.gl.getUniformLocation(prog, name); }

    _quad(prog) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuf);
        const loc = gl.getAttribLocation(prog, 'pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }

    _compile(vertSrc, fragSrc) {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vertSrc); gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs));
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fragSrc); gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(fs));
        const prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        return prog;
    }

    _loop() {
        this._step();
        this._render();
        requestAnimationFrame(() => this._loop());
    }
}
