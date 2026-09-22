const qrcode = (function() {
    var qrcode = function() {
        function i(t, r) {
            function a(t, r) {
                g = function(t) {
                    for (var r = new Array(t), e = 0; e < t; e += 1) {
                        r[e] = new Array(t);
                        for (var n = 0; n < t; n += 1) r[e][n] = null;
                    }
                    return r;
                }(l = 4 * u + 17);
                e(0, 0); e(l - 7, 0); e(0, l - 7); i(); o(); v(t, r);
                7 <= u && h(t);
                null == n && (n = w(u, f, c));
                d(n, r);
            }
            var u = t, f = y[r], g = null, l = 0, n = null, c = [], s = {},
                e = function(t, r) {
                    for (var e = -1; e <= 7; e += 1)
                        if (!(t + e <= -1 || l <= t + e))
                            for (var n = -1; n <= 7; n += 1)
                                r + n <= -1 || l <= r + n || (g[t + e][r + n] = 0 <= e && e <= 6 && (0 == n || 6 == n) || 0 <= n && n <= 6 && (0 == e || 6 == e) || 2 <= e && e <= 4 && 2 <= n && n <= 4);
                },
                o = function() {
                    for (var t = 8; t < l - 8; t += 1) null == g[t][6] && (g[t][6] = t % 2 == 0);
                    for (var r = 8; r < l - 8; r += 1) null == g[6][r] && (g[6][r] = r % 2 == 0);
                },
                i = function() {
                    for (var t = B.getPatternPosition(u), r = 0; r < t.length; r += 1)
                        for (var e = 0; e < t.length; e += 1) {
                            var n = t[r], o = t[e];
                            if (null == g[n][o])
                                for (var i = -2; i <= 2; i += 1)
                                    for (var a = -2; a <= 2; a += 1)
                                        g[n + i][o + a] = -2 == i || 2 == i || -2 == a || 2 == a || 0 == i && 0 == a;
                        }
                },
                h = function(t) {
                    for (var r = B.getBCHTypeNumber(u), e = 0; e < 18; e += 1) {
                        var n = !t && 1 == (r >>> e & 1);
                        g[Math.floor(e / 3)][e % 3 + l - 8 - 3] = n;
                    }
                    for (e = 0; e < 18; e += 1) {
                        n = !t && 1 == (r >>> e & 1);
                        g[e % 3 + l - 8 - 3][Math.floor(e / 3)] = n;
                    }
                },
                v = function(t, r) {
                    for (var e = f << 3 | r, n = B.getBCHTypeInfo(e), o = 0; o < 15; o += 1) {
                        var i = !t && 1 == (n >>> o & 1);
                        o < 6 ? g[o][8] = i : o < 8 ? g[o + 1][8] = i : g[l - 15 + o][8] = i;
                    }
                    for (o = 0; o < 15; o += 1) {
                        i = !t && 1 == (n >>> o & 1);
                        o < 8 ? g[8][l - o - 1] = i : o < 9 ? g[8][15 - o - 1 + 1] = i : g[8][15 - o - 1] = i;
                    }
                    g[l - 8][8] = !t;
                },
                d = function(t, r) {
                    for (var e = -1, n = l - 1, o = 7, i = 0, a = B.getMaskFunction(r), u = l - 1; 0 < u; u -= 2)
                        for (6 == u && (u -= 1); ;) {
                            for (var f = 0; f < 2; f += 1)
                                if (null == g[n][u - f]) {
                                    var c = !1;
                                    i < t.length && (c = 1 == (t[i] >>> o & 1));
                                    a(n, u - f) && (c = !c);
                                    g[n][u - f] = c;
                                    -1 == (o -= 1) && (i += 1, o = 7);
                                }
                            if ((n += e) < 0 || l <= n) { n -= e; e = -e; break; }
                        }
                },
                w = function(t, r, e) {
                    for (var n = b.getRSBlocks(t, r), o = M(), i = 0; i < e.length; i += 1) {
                        var a = e[i];
                        o.put(a.getMode(), 4);
                        o.put(a.getLength(), B.getLengthInBits(a.getMode(), t));
                        a.write(o);
                    }
                    var u = 0;
                    for (i = 0; i < n.length; i += 1) u += n[i].dataCount;
                    if (o.getLengthInBits() > 8 * u) throw "code length overflow. (" + o.getLengthInBits() + ">" + 8 * u + ")";
                    for (o.getLengthInBits() + 4 <= 8 * u && o.put(0, 4); o.getLengthInBits() % 8 != 0;) o.putBit(!1);
                    for (; !(o.getLengthInBits() >= 8 * u || (o.put(236, 8), o.getLengthInBits() >= 8 * u));) o.put(17, 8);
                    return function(t, r) {
                        for (var e = 0, n = 0, o = 0, i = new Array(r.length), a = new Array(r.length), u = 0; u < r.length; u += 1) {
                            var f = r[u].dataCount, c = r[u].totalCount - f;
                            n = Math.max(n, f); o = Math.max(o, c);
                            i[u] = new Array(f);
                            for (var g = 0; g < i[u].length; g += 1) i[u][g] = 255 & t.getBuffer()[g + e];
                            e += f;
                            var l = B.getErrorCorrectPolynomial(c), h = C(i[u], l.getLength() - 1).mod(l);
                            a[u] = new Array(l.getLength() - 1);
                            for (g = 0; g < a[u].length; g += 1) {
                                var s = g + h.getLength() - a[u].length;
                                a[u][g] = 0 <= s ? h.getAt(s) : 0;
                            }
                        }
                        var v = 0;
                        for (g = 0; g < r.length; g += 1) v += r[g].totalCount;
                        var d = new Array(v), w = 0;
                        for (g = 0; g < n; g += 1)
                            for (u = 0; u < r.length; u += 1) g < i[u].length && (d[w] = i[u][g], w += 1);
                        for (g = 0; g < o; g += 1)
                            for (u = 0; u < r.length; u += 1) g < a[u].length && (d[w] = a[u][g], w += 1);
                        return d;
                    }(o, n);
                };
            s.addData = function(t, r) {
                var e = null;
                switch (r = r || "Byte") {
                    case "Numeric": e = x(t); break;
                    case "Alphanumeric": e = m(t); break;
                    case "Byte": e = L(t); break;
                    case "Kanji": e = D(t); break;
                    default: throw "mode:" + r;
                }
                c.push(e); n = null;
            };
            s.isDark = function(t, r) {
                if (t < 0 || l <= t || r < 0 || l <= r) throw t + "," + r;
                return g[t][r];
            };
            s.getModuleCount = function() { return l; };
            s.make = function() {
                if (u < 1) {
                    for (var t = 1; t < 40; t++) {
                        for (var r = b.getRSBlocks(t, f), e = M(), n = 0; n < c.length; n++) {
                            var o = c[n];
                            e.put(o.getMode(), 4);
                            e.put(o.getLength(), B.getLengthInBits(o.getMode(), t));
                            o.write(e);
                        }
                        var i = 0;
                        for (n = 0; n < r.length; n++) i += r[n].dataCount;
                        if (e.getLengthInBits() <= 8 * i) break;
                    }
                    u = t;
                }
                a(!1, function() {
                    for (var t = 0, r = 0, e = 0; e < 8; e += 1) {
                        a(!0, e);
                        var n = B.getLostPoint(s);
                        (0 == e || n < t) && (t = n, r = e);
                    }
                    return r;
                }());
            };
            s.createDataURL = function(o, t) {
                o = o || 2; t = void 0 === t ? 4 * o : t;
                var r = s.getModuleCount() * o + 2 * t, i = t, a = r - t;
                return I(r, r, function(t, r) {
                    if (i <= t && t < a && i <= r && r < a) {
                        var e = Math.floor((t - i) / o), n = Math.floor((r - i) / o);
                        return s.isDark(n, e) ? 0 : 1;
                    }
                    return 1;
                });
            };
            return s;
        }
        var r, t, a = 1, u = 2, o = 4, f = 8, y = { L: 1, M: 0, Q: 3, H: 2 },
            e = 0, n = 1, c = 2, g = 3, l = 4, h = 5, s = 6, v = 7,
            B = (r = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]],
                (t = {}).getBCHTypeInfo = function(t) {
                    for (var r = t << 10; 0 <= d(r) - d(1335);) r ^= 1335 << d(r) - d(1335);
                    return 21522 ^ (t << 10 | r);
                },
                t.getBCHTypeNumber = function(t) {
                    for (var r = t << 12; 0 <= d(r) - d(7973);) r ^= 7973 << d(r) - d(7973);
                    return t << 12 | r;
                },
                t.getPatternPosition = function(t) { return r[t - 1]; },
                t.getMaskFunction = function(t) {
                    switch (t) {
                        case e: return function(t, r) { return (t + r) % 2 == 0; };
                        case n: return function(t, r) { return t % 2 == 0; };
                        case c: return function(t, r) { return r % 3 == 0; };
                        case g: return function(t, r) { return (t + r) % 3 == 0; };
                        case l: return function(t, r) { return (Math.floor(t / 2) + Math.floor(r / 3)) % 2 == 0; };
                        case h: return function(t, r) { return t * r % 2 + t * r % 3 == 0; };
                        case s: return function(t, r) { return (t * r % 2 + t * r % 3) % 2 == 0; };
                        case v: return function(t, r) { return (t * r % 3 + (t + r) % 2) % 2 == 0; };
                        default: throw "bad maskPattern:" + t;
                    }
                },
                t.getErrorCorrectPolynomial = function(t) {
                    for (var r = C([1], 0), e = 0; e < t; e += 1) r = r.multiply(C([1, w.gexp(e)], 0));
                    return r;
                },
                t.getLengthInBits = function(t, r) {
                    if (1 <= r && r < 10) switch (t) { case a: return 10; case u: return 9; case o: case f: return 8; default: throw "mode:" + t; }
                    else if (r < 27) switch (t) { case a: return 12; case u: return 11; case o: return 16; case f: return 10; default: throw "mode:" + t; }
                    else { if (!(r < 41)) throw "type:" + r; switch (t) { case a: return 14; case u: return 13; case o: return 16; case f: return 12; default: throw "mode:" + t; } }
                },
                t.getLostPoint = function(t) {
                    for (var r = t.getModuleCount(), e = 0, n = 0; n < r; n += 1)
                        for (var o = 0; o < r; o += 1) {
                            for (var i = 0, a = t.isDark(n, o), u = -1; u <= 1; u += 1)
                                if (!(n + u < 0 || r <= n + u))
                                    for (var f = -1; f <= 1; f += 1)
                                        o + f < 0 || r <= o + f || 0 == u && 0 == f || a == t.isDark(n + u, o + f) && (i += 1);
                            5 < i && (e += 3 + i - 5);
                        }
                    for (n = 0; n < r - 1; n += 1)
                        for (o = 0; o < r - 1; o += 1) {
                            var c = 0;
                            t.isDark(n, o) && (c += 1); t.isDark(n + 1, o) && (c += 1);
                            t.isDark(n, o + 1) && (c += 1); t.isDark(n + 1, o + 1) && (c += 1);
                            0 != c && 4 != c || (e += 3);
                        }
                    for (n = 0; n < r; n += 1)
                        for (o = 0; o < r - 6; o += 1)
                            t.isDark(n, o) && !t.isDark(n, o + 1) && t.isDark(n, o + 2) && t.isDark(n, o + 3) && t.isDark(n, o + 4) && !t.isDark(n, o + 5) && t.isDark(n, o + 6) && (e += 40);
                    for (o = 0; o < r; o += 1)
                        for (n = 0; n < r - 6; n += 1)
                            t.isDark(n, o) && !t.isDark(n + 1, o) && t.isDark(n + 2, o) && t.isDark(n + 3, o) && t.isDark(n + 4, o) && !t.isDark(n + 5, o) && t.isDark(n + 6, o) && (e += 40);
                    var g = 0;
                    for (o = 0; o < r; o += 1)
                        for (n = 0; n < r; n += 1) t.isDark(n, o) && (g += 1);
                    return e += Math.abs(100 * g / r / r - 50) / 5 * 10;
                }, t);
        function d(t) { for (var r = 0; 0 != t;) r += 1, t >>>= 1; return r; }
        var w = function() {
            for (var r = new Array(256), e = new Array(256), t = 0; t < 8; t += 1) r[t] = 1 << t;
            for (t = 8; t < 256; t += 1) r[t] = r[t - 4] ^ r[t - 5] ^ r[t - 6] ^ r[t - 8];
            for (t = 0; t < 255; t += 1) e[r[t]] = t;
            var n = {
                glog: function(t) { if (t < 1) throw "glog(" + t + ")"; return e[t]; },
                gexp: function(t) { for (; t < 0;) t += 255; for (; 256 <= t;) t -= 255; return r[t]; }
            };
            return n;
        }();
        function C(n, o) {
            if (void 0 === n.length) throw n.length + "/" + o;
            var r = function() {
                for (var t = 0; t < n.length && 0 == n[t];) t += 1;
                for (var r = new Array(n.length - t + o), e = 0; e < n.length - t; e += 1) r[e] = n[e + t];
                return r;
            }(), i = {
                getAt: function(t) { return r[t]; },
                getLength: function() { return r.length; },
                multiply: function(t) {
                    for (var r = new Array(i.getLength() + t.getLength() - 1), e = 0; e < i.getLength(); e += 1)
                        for (var n = 0; n < t.getLength(); n += 1) r[e + n] ^= w.gexp(w.glog(i.getAt(e)) + w.glog(t.getAt(n)));
                    return C(r, 0);
                },
                mod: function(t) {
                    if (i.getLength() - t.getLength() < 0) return i;
                    for (var r = w.glog(i.getAt(0)) - w.glog(t.getAt(0)), e = new Array(i.getLength()), n = 0; n < i.getLength(); n += 1) e[n] = i.getAt(n);
                    for (n = 0; n < t.getLength(); n += 1) e[n] ^= w.gexp(w.glog(t.getAt(n)) + r);
                    return C(e, 0).mod(t);
                }
            };
            return i;
        }
        function p() {
            var e = [], o = {
                writeByte: function(t) { e.push(255 & t); },
                writeShort: function(t) { o.writeByte(t); o.writeByte(t >>> 8); },
                writeBytes: function(t, r, e) { r = r || 0; e = e || t.length; for (var n = 0; n < e; n += 1) o.writeByte(t[n + r]); },
                writeString: function(t) { for (var r = 0; r < t.length; r += 1) o.writeByte(t.charCodeAt(r)); },
                toByteArray: function() { return e; }
            };
            return o;
        }
        var k, A, b = (k = [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9], [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16], [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13], [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9], [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12], [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15], [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14], [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15], [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13], [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16], [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13], [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15], [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12], [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13]],
            (A = {}).getRSBlocks = function(t, r) {
                var e = function(t, r) {
                    switch (r) { case y.L: return k[4 * (t - 1) + 0]; case y.M: return k[4 * (t - 1) + 1]; case y.Q: return k[4 * (t - 1) + 2]; case y.H: return k[4 * (t - 1) + 3]; default: return; }
                }(t, r);
                if (void 0 === e) throw "bad rs block @ typeNumber:" + t + "/errorCorrectionLevel:" + r;
                for (var n, o, i = e.length / 3, a = [], u = 0; u < i; u += 1)
                    for (var f = e[3 * u + 0], c = e[3 * u + 1], g = e[3 * u + 2], l = 0; l < f; l += 1) a.push((n = g, o = void 0, (o = {}).totalCount = c, o.dataCount = n, o));
                return a;
            }, A),
            M = function() {
                var e = [], n = 0, o = {
                    getBuffer: function() { return e; },
                    getAt: function(t) { var r = Math.floor(t / 8); return 1 == (e[r] >>> 7 - t % 8 & 1); },
                    put: function(t, r) { for (var e = 0; e < r; e += 1) o.putBit(1 == (t >>> r - e - 1 & 1)); },
                    getLengthInBits: function() { return n; },
                    putBit: function(t) { var r = Math.floor(n / 8); e.length <= r && e.push(0); t && (e[r] |= 128 >>> n % 8); n += 1; }
                };
                return o;
            },
            x = function(t) {
                var r = a, n = t, e = {
                    getMode: function() { return r; },
                    getLength: function(t) { return n.length; },
                    write: function(t) {
                        for (var r = n, e = 0; e + 2 < r.length;) t.put(o(r.substring(e, e + 3)), 10), e += 3;
                        e < r.length && (r.length - e == 1 ? t.put(o(r.substring(e, e + 1)), 4) : r.length - e == 2 && t.put(o(r.substring(e, e + 2)), 7));
                    }
                }, o = function(t) { for (var r = 0, e = 0; e < t.length; e += 1) r = 10 * r + i(t.charAt(e)); return r; },
                    i = function(t) { if ("0" <= t && t <= "9") return t.charCodeAt(0) - "0".charCodeAt(0); throw "illegal char :" + t; };
                return e;
            },
            m = function(t) {
                var r = u, n = t, e = {
                    getMode: function() { return r; },
                    getLength: function(t) { return n.length; },
                    write: function(t) {
                        for (var r = n, e = 0; e + 1 < r.length;) t.put(45 * o(r.charAt(e)) + o(r.charAt(e + 1)), 11), e += 2;
                        e < r.length && t.put(o(r.charAt(e)), 6);
                    }
                }, o = function(t) {
                    if ("0" <= t && t <= "9") return t.charCodeAt(0) - "0".charCodeAt(0);
                    if ("A" <= t && t <= "Z") return t.charCodeAt(0) - "A".charCodeAt(0) + 10;
                    switch (t) { case " ": return 36; case "$": return 37; case "%": return 38; case "*": return 39; case "+": return 40; case "-": return 41; case ".": return 42; case "/": return 43; case ":": return 44; default: throw "illegal char :" + t; }
                };
                return e;
            },
            L = function(t) {
                var r = o, e = i.stringToBytes(t), n = {
                    getMode: function() { return r; },
                    getLength: function(t) { return e.length; },
                    write: function(t) { for (var r = 0; r < e.length; r += 1) t.put(e[r], 8); }
                };
                return n;
            },
            D = function(t) { throw "Kanji not supported"; },
            I = function(t, r, e) {
                for (var n = function(t, r) {
                    var n = t, o = r, l = new Array(t * r), e = {
                        setPixel: function(t, r, e) { l[r * n + t] = e; },
                        write: function(t) {
                            t.writeString("GIF87a"); t.writeShort(n); t.writeShort(o);
                            t.writeByte(128); t.writeByte(0); t.writeByte(0);
                            t.writeByte(0); t.writeByte(0); t.writeByte(0);
                            t.writeByte(255); t.writeByte(255); t.writeByte(255);
                            t.writeString(","); t.writeShort(0); t.writeShort(0); t.writeShort(n); t.writeShort(o);
                            t.writeByte(0);
                            var r = i(2);
                            t.writeByte(2);
                            for (var e = 0; 255 < r.length - e;) t.writeByte(255), t.writeBytes(r, e, 255), e += 255;
                            t.writeByte(r.length - e); t.writeBytes(r, e, r.length - e);
                            t.writeByte(0); t.writeString(";");
                        }
                    }, i = function(t) {
                        for (var r = 1 << t, e = 1 + (1 << t), n = t + 1, o = h(), i = 0; i < r; i += 1) o.add(String.fromCharCode(i));
                        o.add(String.fromCharCode(r)); o.add(String.fromCharCode(e));
                        var a = p(), u = function(t) {
                            var e = t, n = 0, o = 0, r = {
                                write: function(t, r) {
                                    for (; 8 <= n + r;) e.writeByte(255 & (t << n | o)), r -= 8 - n, t >>>= 8 - n, n = o = 0;
                                    o |= t << n; n += r;
                                },
                                flush: function() { 0 < n && e.writeByte(o); }
                            };
                            return r;
                        }(a);
                        u.write(r, n);
                        var f = 0, c = String.fromCharCode(l[f]);
                        for (f += 1; f < l.length;) {
                            var g = String.fromCharCode(l[f]); f += 1;
                            o.contains(c + g) ? c += g : (u.write(o.indexOf(c), n), o.size() < 4095 && (o.size() == 1 << n && (n += 1), o.add(c + g)), c = g);
                        }
                        return u.write(o.indexOf(c), n), u.write(e, n), u.flush(), a.toByteArray();
                    }, h = function() {
                        var r = {}, e = 0, n = {
                            add: function(t) { r[t] = e; e += 1; },
                            size: function() { return e; },
                            indexOf: function(t) { return r[t]; },
                            contains: function(t) { return void 0 !== r[t]; }
                        };
                        return n;
                    };
                    return e;
                }(t, r), o = 0; o < r; o += 1)
                    for (var i = 0; i < t; i += 1) n.setPixel(i, o, e(i, o));
                var a = p(); n.write(a);
                for (var u = function() {
                    function e(t) { a += String.fromCharCode(r(63 & t)); }
                    var n = 0, o = 0, i = 0, a = "", t = {}, r = function(t) {
                        if (t < 0); else {
                            if (t < 26) return 65 + t;
                            if (t < 52) return t - 26 + 97;
                            if (t < 62) return t - 52 + 48;
                            if (62 == t) return 43;
                            if (63 == t) return 47;
                        }
                        throw "n:" + t;
                    };
                    return t.writeByte = function(t) { for (n = n << 8 | 255 & t, o += 8, i += 1; 6 <= o;) e(n >>> o - 6), o -= 6; },
                        t.flush = function() { if (0 < o && (e(n << 6 - o), o = n = 0), i % 3 != 0) for (var t = 3 - i % 3, r = 0; r < t; r += 1) a += "="; },
                        t.toString = function() { return a; }, t;
                }(), f = a.toByteArray(), c = 0; c < f.length; c += 1) u.writeByte(f[c]);
                return u.flush(), "data:image/gif;base64," + u;
            };
        return i;
    }();
    qrcode.stringToBytes = function(t) {
        for (var r = [], e = 0; e < t.length; e += 1) {
            var n = t.charCodeAt(e);
            n < 128 ? r.push(n) : n < 2048 ? r.push(192 | n >>> 6, 128 | 63 & n) : r.push(224 | n >>> 12, 128 | n >>> 6 & 63, 128 | 63 & n);
        }
        return r;
    };
    return qrcode;
})();

export function generateQRCodeDataURL(text) {
    try {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();

        // En navegadores con soporte de canvas, generamos un PNG nítido nativo
        if (typeof document !== 'undefined') {
            const count = qr.getModuleCount();
            const margin = 2;
            const cellSize = 3;
            const size = (count + margin * 2) * cellSize;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = '#000000';
                for (let r = 0; r < count; r++) {
                    for (let c = 0; c < count; c++) {
                        if (qr.isDark(r, c)) {
                            ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
                        }
                    }
                }
                return canvas.toDataURL('image/png');
            }
        }
        // Respaldo sin canvas
        return qr.createDataURL(4, 2);
    } catch (e) {
        console.error("Error generando QR DataURL:", e);
        return "";
    }
}
