import json, sys, wave, numpy as np
ev_file, total, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
SR = 48000
def load(n):
    w = wave.open(f'sfx/{n}.wav')
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    if w.getnchannels() == 2: a = a[::2]
    return a
GAIN = {'whoosh': .55, 'paper': .45, 'tap': .30, 'pop': .30, 'rise': .25, 'tick': .30, 'scribble': .22, 'tape': .22}
S = {k: load(k) for k in GAIN}
buf = np.zeros(int(SR * (total + 1)), np.float32)
rng = np.random.default_rng(3)
for t, k in json.load(open(ev_file)):
    s = S[k] * GAIN[k] * (0.85 + 0.3 * rng.random())
    i = int((t + 0.5 - (0.15 if k == 'whoosh' else 0)) * SR)  # +0.5 = narration offset already in timeline? no: scene times are absolute
    i = int(t * SR) - (int(0.15 * SR) if k == 'whoosh' else 0)
    if i < 0: i = 0
    e = min(len(buf), i + len(s)); buf[i:e] += s[:e - i]
buf = np.clip(buf, -0.95, 0.95)
w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((buf * 32767).astype(np.int16).tobytes()); w.close()
print('events', len(json.load(open(ev_file))))
